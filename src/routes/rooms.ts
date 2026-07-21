import { Router } from "express";
import prisma from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import type { Request, Response } from "express";

const router = Router();

// List rooms
router.get("/", async (_req: Request, res: Response) => {
  const rooms = await prisma.room.findMany({
    orderBy: { sequence: "asc" },
    include: { operator: { select: { id: true, name: true, email: true } } },
  });
  res.json({ rooms });
});

// Create room (ADMIN only)
router.post("/", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { name, type, sequence } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: "Name and type required" });
    return;
  }

  const room = await prisma.room.create({
    data: { name, type, sequence: sequence ?? 0 },
  });

  res.status(201).json({ room });
});

// Update room (ADMIN only)
router.put("/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { name, type, isActive, operatorId } = req.body;

  const room = await prisma.room.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(isActive !== undefined && { isActive }),
      ...(operatorId !== undefined && { operatorId: operatorId || null }),
    },
    include: { operator: { select: { id: true, name: true, email: true } } },
  });

  res.json({ room });
});

// Delete room (ADMIN only)
router.delete("/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await prisma.room.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

// Toggle room active status (ADMIN only)
router.patch("/:id/toggle", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const room = await prisma.room.findUnique({ where: { id: String(req.params.id) } });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const updated = await prisma.room.update({
    where: { id: String(req.params.id) },
    data: { isActive: !room.isActive },
  });

  res.json({ room: updated });
});

// Reorder rooms (ADMIN only) — accepts [{ id, sequence }]
router.post("/reorder", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { rooms: roomOrder } = req.body;

  if (!Array.isArray(roomOrder)) {
    res.status(400).json({ error: "rooms array required" });
    return;
  }

  await prisma.$transaction(
    roomOrder.map((r: { id: string; sequence: number }) =>
      prisma.room.update({
        where: { id: r.id },
        data: { sequence: r.sequence },
      })
    )
  );

  const rooms = await prisma.room.findMany({ orderBy: { sequence: "asc" } });
  res.json({ rooms });
});

// Assign operator to room (ADMIN only)
router.patch("/:id/assign-operator", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const { operatorId } = req.body;

  const room = await prisma.room.update({
    where: { id: String(req.params.id) },
    data: { operatorId: operatorId || null },
    include: { operator: { select: { id: true, name: true, email: true } } },
  });

  res.json({ room });
});

// Get room queue — patients currently routed to this room (ACTIVE status)
router.get("/:roomId/queue", async (req: Request, res: Response) => {
  const roomId = String(req.params.roomId);

  const routings = await prisma.roomRouting.findMany({
    where: { roomId, status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: { sequence: "asc" },
    include: {
      visit: {
        include: {
          patient: true,
          doctor: true,
          roomEntries: { where: { roomId }, orderBy: { enteredAt: "desc" }, take: 1 },
        },
      },
    },
  });

  res.json({ queue: routings });
});

// Submit room entry form (OPERATOR)
router.post("/:roomId/entries", async (req: Request, res: Response) => {
  const roomId = String(req.params.roomId);
  const { visitId, formData, roomType } = req.body;

  if (!visitId || !formData || !roomType) {
    res.status(400).json({ error: "visitId, formData, and roomType required" });
    return;
  }

  const entry = await prisma.roomEntry.create({
    data: {
      visitId,
      roomId,
      operatorId: req.user!.id,
      roomType,
      formData,
      completedAt: new Date(),
    },
  });

  // Mark this room's routing as COMPLETED
  await prisma.roomRouting.updateMany({
    where: { visitId, roomId, status: { in: ["ACTIVE", "PENDING"] } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Advance the next room to ACTIVE
  const currentRouting = await prisma.roomRouting.findFirst({
    where: { visitId, roomId },
  });
  if (currentRouting) {
    const nextRouting = await prisma.roomRouting.findFirst({
      where: { visitId, sequence: currentRouting.sequence + 1 },
    });
    if (nextRouting && nextRouting.status === "PENDING") {
      await prisma.roomRouting.update({
        where: { id: nextRouting.id },
        data: { status: "ACTIVE", messageSentAt: new Date() },
      });
    }
  }

  res.status(201).json({ entry });
});

// Get entries for a visit
router.get("/entries/:visitId", async (req: Request, res: Response) => {
  const entries = await prisma.roomEntry.findMany({
    where: { visitId: String(req.params.visitId) },
    orderBy: { enteredAt: "asc" },
    include: { room: true, operator: { select: { id: true, name: true } } },
  });

  res.json({ entries });
});

// Get routing for a visit
router.get("/routing/:visitId", async (req: Request, res: Response) => {
  const routings = await prisma.roomRouting.findMany({
    where: { visitId: String(req.params.visitId) },
    orderBy: { sequence: "asc" },
    include: { room: true },
  });

  res.json({ routings });
});

// Trigger next room for a visit (admin)
router.post("/routing/:visitId/next", async (req: Request, res: Response) => {
  const visitId = String(req.params.visitId);

  const currentActive = await prisma.roomRouting.findFirst({
    where: { visitId, status: "ACTIVE" },
    orderBy: { sequence: "asc" },
  });

  if (currentActive) {
    await prisma.roomRouting.update({
      where: { id: currentActive.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  const nextPending = await prisma.roomRouting.findFirst({
    where: { visitId, status: "PENDING" },
    orderBy: { sequence: "asc" },
  });

  if (nextPending) {
    await prisma.roomRouting.update({
      where: { id: nextPending.id },
      data: { status: "ACTIVE", messageSentAt: new Date() },
    });
  }

  const nextRoom = nextPending
    ? await prisma.room.findUnique({ where: { id: nextPending.roomId } })
    : null;

  res.json({ message: "Advanced to next room", nextRoom });
});

export { router as roomRoutes };
