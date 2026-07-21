import { Router } from "express";
import prisma from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

const router = Router();

// List doctors
router.get("/", async (_req: Request, res: Response) => {
  const doctors = await prisma.doctor.findMany({
    include: { schedule: true, user: { select: { id: true, email: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ doctors });
});

// Get today's appointments for logged-in doctor
router.get("/me/today-appointments", async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    res.status(404).json({ error: "Doctor profile not found" });
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: true,
      visit: { include: { tests: true, roomEntries: true } },
    },
  });

  res.json({ doctor, appointments });
});

// Get doctor by ID
router.get("/:id", async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: String(req.params.id) },
    include: {
      schedule: true,
      user: { select: { id: true, email: true, name: true } },
      appointments: {
        where: {
          scheduledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { in: ["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"] },
        },
        orderBy: { scheduledAt: "asc" },
        include: { patient: true },
      },
    },
  });

  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  res.json({ doctor });
});

// Create doctor (with optional user account)
router.post("/", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { name, specialization, email, password } = req.body;

  if (!name || !specialization) {
    res.status(400).json({ error: "Name and specialization required" });
    return;
  }

  let userId: string | undefined;

  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: "DOCTOR" },
    });
    userId = user.id;
  }

  const doctor = await prisma.doctor.create({
    data: { name, specialization, userId },
    include: { schedule: true, user: { select: { id: true, email: true, name: true } } },
  });

  res.status(201).json({ doctor });
});

// Update doctor
router.put("/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { name, specialization, email, password } = req.body;

  const doctor = await prisma.doctor.findUnique({
    where: { id: String(req.params.id) },
    include: { user: true },
  });

  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  // Update or create linked user account
  if (email && !doctor.userId) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = password ? await bcrypt.hash(password, 12) : await bcrypt.hash("doctor123", 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name || doctor.name, role: "DOCTOR" },
    });
    await prisma.doctor.update({
      where: { id: String(req.params.id) },
      data: { userId: user.id },
    });
  } else if (email && doctor.userId) {
    // Update existing user email
    await prisma.user.update({
      where: { id: doctor.userId },
      data: { email, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    });
  }

  const updated = await prisma.doctor.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined && { name }),
      ...(specialization !== undefined && { specialization }),
    },
    include: { schedule: true, user: { select: { id: true, email: true, name: true } } },
  });

  res.json({ doctor: updated });
});

// Update doctor schedule
router.put("/:id/schedule", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { schedule } = req.body;

  if (!Array.isArray(schedule)) {
    res.status(400).json({ error: "Schedule array required" });
    return;
  }

  await prisma.$transaction([
    prisma.doctorSchedule.deleteMany({ where: { doctorId: String(req.params.id) } }),
    prisma.doctorSchedule.createMany({
      data: schedule.map((s: { dayOfWeek: number; startTime: string; endTime: string; avgConsultationMins?: number }) => ({
        doctorId: String(req.params.id),
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        avgConsultationMins: s.avgConsultationMins ?? 15,
      })),
    }),
  ]);

  const doctor = await prisma.doctor.findUnique({
    where: { id: String(req.params.id) },
    include: { schedule: true },
  });

  res.json({ doctor });
});

// Delete doctor
router.delete("/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: String(req.params.id) },
    include: { user: true },
  });

  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  await prisma.doctor.delete({ where: { id: String(req.params.id) } });

  // Optionally unlink user account
  if (doctor.userId) {
    await prisma.user.update({
      where: { id: doctor.userId },
      data: { role: "RECEPTIONIST" },
    });
  }

  res.json({ success: true });
});

export { router as doctorRoutes };
