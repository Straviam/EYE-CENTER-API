import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// List appointments (with filters)
router.get("/", async (req: Request, res: Response) => {
  const { date, doctorId, status, search } = req.query;

  const where: Record<string, unknown> = {};

  if (date) {
    const d = new Date(String(date));
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));
    where.scheduledAt = { gte: startOfDay, lte: endOfDay };
  }
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;

  if (search) {
    where.OR = [
      { patient: { name: { contains: String(search), mode: "insensitive" } } },
      { patient: { mrNumber: { contains: String(search), mode: "insensitive" } } },
      { patient: { phone: { contains: String(search) } } },
    ];
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: { patient: true, doctor: true },
  });

  res.json({ appointments });
});

// Get appointment by ID
router.get("/:id", async (req: Request, res: Response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: String(req.params.id) },
    include: { patient: true, doctor: true, visit: { include: { tests: true } } },
  });

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json({ appointment });
});

// Create appointment (from confirmed transcript)
router.post("/", async (req: Request, res: Response) => {
  const { patientId, doctorId, scheduledAt, visitType, dilutionRequired, notes, vapiCallId } = req.body;

  if (!patientId || !doctorId || !scheduledAt || !visitType) {
    res.status(400).json({ error: "patientId, doctorId, scheduledAt, and visitType required" });
    return;
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      scheduledAt: new Date(scheduledAt),
      visitType,
      dilutionRequired: dilutionRequired ?? false,
      notes,
      vapiCallId,
      status: "CONFIRMED",
    },
    include: { patient: true, doctor: true },
  });

  res.status(201).json({ appointment });
});

// Update appointment status
router.patch("/:id/status", async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: "Status required" });
    return;
  }

  const appointment = await prisma.appointment.update({
    where: { id: String(req.params.id) },
    data: { status },
    include: { patient: true, doctor: true },
  });

  // When patient arrives, create room routings automatically
  if (status === "ARRIVED") {
    await createRoomRoutings(String(req.params.id));
  }

  res.json({ appointment });
});

// Mark patient as arrived + create room routings
router.patch("/:id/arrive", async (req: Request, res: Response) => {
  const appointment = await prisma.appointment.update({
    where: { id: String(req.params.id) },
    data: { status: "ARRIVED" },
    include: { patient: true, doctor: true },
  });

  await createRoomRoutings(String(req.params.id));

  res.json({ appointment });
});

// Helper: create room routings for an appointment when patient arrives
async function createRoomRoutings(appointmentId: string) {
  // Get the appointment with visit
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { visit: true },
  });
  if (!appointment) return;

  // Check if routings already exist
  const existing = await prisma.roomRouting.findFirst({
    where: { visitId: appointment.visit?.id || "" },
  });
  if (existing) return;

  // If no visit yet, create one
  let visitId = appointment.visit?.id;
  if (!visitId) {
    const visit = await prisma.visit.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
      },
    });
    visitId = visit.id;
  }

  // Get active rooms with an operator assigned (skip waiting/temp rooms)
  const rooms = await prisma.room.findMany({
    where: { isActive: true, operatorId: { not: null } },
    orderBy: { sequence: "asc" },
  });

  if (rooms.length === 0) return;

  // Create routing for each room, first one ACTIVE, rest PENDING
  await prisma.roomRouting.createMany({
    data: rooms.map((room, i) => ({
      visitId: visitId!,
      roomId: room.id,
      sequence: i + 1,
      status: i === 0 ? "ACTIVE" : "PENDING",
      messageSentAt: i === 0 ? new Date() : null,
    })),
  });
}

export { router as appointmentRoutes };
