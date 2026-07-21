import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// List visits for a patient
router.get("/", async (req: Request, res: Response) => {
  const { patientId } = req.query;

  if (!patientId) {
    res.status(400).json({ error: "patientId query parameter required" });
    return;
  }

  const visits = await prisma.visit.findMany({
    where: { patientId: String(patientId) },
    orderBy: { visitDate: "desc" },
    include: { tests: true, doctor: true, attachments: true },
  });

  res.json({ visits });
});

// Get visit by ID
router.get("/:id", async (req: Request, res: Response) => {
  const visit = await prisma.visit.findUnique({
    where: { id: String(req.params.id) },
    include: {
      tests: true,
      doctor: true,
      patient: true,
      attachments: true,
      appointment: true,
    },
  });

  if (!visit) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }

  res.json({ visit });
});

// Create visit (clinical examination entry)
router.post("/", async (req: Request, res: Response) => {
  const {
    patientId, appointmentId, doctorId,
    vaRight, vaLeft, sleRight, sleLeft, taRight, taLeft,
    lensRight, lensLeft, fundusRight, fundusLeft,
    gonioRight, gonioLeft, pachymetryRight, pachymetryLeft,
    systemicRx, ocularRx, assessmentPlan, treatmentPlan,
    surgeryRecommended, surgeryDetails, tests,
  } = req.body;

  if (!patientId || !doctorId) {
    res.status(400).json({ error: "patientId and doctorId required" });
    return;
  }

  const visit = await prisma.$transaction(async (tx) => {
    const newVisit = await tx.visit.create({
      data: {
        patientId,
        appointmentId,
        doctorId,
        vaRight, vaLeft, sleRight, sleLeft, taRight, taLeft,
        lensRight, lensLeft, fundusRight, fundusLeft,
        gonioRight, gonioLeft, pachymetryRight, pachymetryLeft,
        systemicRx, ocularRx, assessmentPlan, treatmentPlan,
        surgeryRecommended: surgeryRecommended ?? false,
        surgeryDetails,
      },
    });

    // Create ordered tests
    if (Array.isArray(tests) && tests.length > 0) {
      await tx.orderedTest.createMany({
        data: tests.map((t: { testType: string; ordered?: boolean; resultUrl?: string }) => ({
          visitId: newVisit.id,
          testType: t.testType as any,
          ordered: t.ordered ?? true,
          resultUrl: t.resultUrl,
        })),
      });
    }

    // Mark appointment as completed if linked
    if (appointmentId) {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "COMPLETED" },
      });
    }

    return newVisit;
  });

  const fullVisit = await prisma.visit.findUnique({
    where: { id: visit.id },
    include: { tests: true, doctor: true },
  });

  res.status(201).json({ visit: fullVisit });
});

// Update visit
router.put("/:id", async (req: Request, res: Response) => {
  const visit = await prisma.visit.update({
    where: { id: String(req.params.id) },
    data: req.body,
    include: { tests: true },
  });

  res.json({ visit });
});

export { router as visitRoutes };
