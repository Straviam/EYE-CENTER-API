import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${year}` } },
    orderBy: { invoiceNumber: "desc" },
  });

  const seq = lastInvoice
    ? Number(lastInvoice.invoiceNumber.split("-")[2]) + 1
    : 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

// List invoices
router.get("/", async (req: Request, res: Response) => {
  const { status, patientId, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { patient: true, items: true, payments: true },
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({ invoices, total, page: Number(page), limit: Number(limit) });
});

// Get invoice by ID
router.get("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: String(req.params.id) },
    include: { patient: true, items: true, payments: true, visit: true },
  });

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json({ invoice });
});

// Create invoice
router.post("/", async (req: Request, res: Response) => {
  const { patientId, visitId, items, discount } = req.body;

  if (!patientId || !items?.length) {
    res.status(400).json({ error: "patientId and items required" });
    return;
  }

  const invoiceNumber = await generateInvoiceNumber();

  const totalAmount = items.reduce(
    (sum: number, item: { amount: number }) => sum + item.amount,
    0,
  );
  const discountAmount = discount ?? 0;
  const payableAmount = totalAmount - discountAmount;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        patientId,
        visitId,
        totalAmount,
        discount: discountAmount,
        payableAmount,
        status: "DRAFT",
      },
    });

    await tx.invoiceItem.createMany({
      data: items.map((item: { description: string; amount: number }) => ({
        invoiceId: inv.id,
        description: item.description,
        amount: item.amount,
      })),
    });

    return inv;
  });

  const fullInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { items: true, patient: true },
  });

  res.status(201).json({ invoice: fullInvoice });
});

// Mark invoice as issued
router.patch("/:id/issue", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.update({
    where: { id: String(req.params.id) },
    data: { status: "ISSUED" },
    include: { items: true, patient: true },
  });

  res.json({ invoice });
});

// Record payment
router.post("/:id/payments", async (req: Request, res: Response) => {
  const { amount, method, reference, collectedBy } = req.body;

  if (!amount || !method) {
    res.status(400).json({ error: "Amount and method required" });
    return;
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        invoiceId: String(req.params.id),
        amount,
        method,
        reference,
        collectedBy,
      },
    });

    // Check if fully paid
    const invoice = await tx.invoice.findUnique({
      where: { id: String(req.params.id) },
      include: { payments: true },
    });

    if (invoice) {
      const totalPaid = (invoice as typeof invoice & { payments: { amount: any }[] }).payments.reduce(
        (sum: number, pay: { amount: any }) => sum + Number(pay.amount),
        0,
      );

      if (totalPaid >= Number(invoice.payableAmount)) {
        await tx.invoice.update({
          where: { id: String(req.params.id) },
          data: { status: "PAID" },
        });
      }
    }

    return p;
  });

  res.status(201).json({ payment });
});

export { router as invoiceRoutes };
