import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// List patients (with search)
router.get("/", async (req: Request, res: Response) => {
  const { search, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = search
    ? {
        OR: [
          { name: { contains: String(search), mode: "insensitive" as const } },
          { mrNumber: { contains: String(search), mode: "insensitive" as const } },
          { phone: { contains: String(search) } },
        ],
      }
    : {};

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { visits: { take: 1, orderBy: { visitDate: "desc" } } },
    }),
    prisma.patient.count({ where }),
  ]);

  res.json({ patients, total, page: Number(page), limit: Number(limit) });
});

// Get patient by ID
router.get("/:id", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findUnique({
    where: { id: String(req.params.id) },
    include: {
      visits: {
        orderBy: { visitDate: "desc" },
        include: { tests: true, doctor: true },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
        include: { doctor: true },
      },
    },
  });

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  res.json({ patient });
});

// Create patient (from registration form or admin)
router.post("/", async (req: Request, res: Response) => {
  const {
    name, phone, whatsappPhone, email, dateOfBirth, gender, cnic,
    allergies, hypertension, diabetes, cad, copd, otherConditions,
    ocularTrauma, ocularSurgery, familyEyeHistory, currentMeds, referredBy,
  } = req.body;

  if (!name || !phone || !dateOfBirth || !gender) {
    res.status(400).json({ error: "Name, phone, date of birth, and gender are required" });
    return;
  }

  // Generate MR number
  const year = new Date().getFullYear();
  const lastPatient = await prisma.patient.findFirst({
    where: { mrNumber: { startsWith: `MR-${year}` } },
    orderBy: { mrNumber: "desc" },
  });

  const seq = lastPatient
    ? Number(lastPatient.mrNumber.split("-")[2]) + 1
    : 1;
  const mrNumber = `MR-${year}-${String(seq).padStart(4, "0")}`;

  const patient = await prisma.patient.create({
    data: {
      mrNumber,
      name,
      phone,
      whatsappPhone,
      email,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      cnic,
      allergies,
      hypertension: hypertension ?? false,
      diabetes: diabetes ?? false,
      cad: cad ?? false,
      copd: copd ?? false,
      otherConditions,
      ocularTrauma: ocularTrauma ?? false,
      ocularSurgery,
      familyEyeHistory,
      currentMeds,
      referredBy,
      registrationSource: req.body.registrationSource ?? "admin",
    },
  });

  res.status(201).json({ patient });
});

// Update patient
router.put("/:id", async (req: Request, res: Response) => {
  const patient = await prisma.patient.update({
    where: { id: String(req.params.id) },
    data: req.body,
  });

  res.json({ patient });
});

// Get patient timeline
router.get("/:id/timeline", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, name: true, mrNumber: true },
  });

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [visits, appointments, invoices] = await Promise.all([
    prisma.visit.findMany({
      where: { patientId: String(req.params.id) },
      orderBy: { visitDate: "desc" },
      include: { doctor: true, tests: true },
    }),
    prisma.appointment.findMany({
      where: { patientId: String(req.params.id) },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      include: { doctor: true },
    }),
    prisma.invoice.findMany({
      where: { patientId: String(req.params.id) },
      orderBy: { createdAt: "desc" },
      include: { items: true, payments: true },
    }),
  ]);

  res.json({ patient, visits, appointments, invoices });
});

export { router as patientRoutes };
