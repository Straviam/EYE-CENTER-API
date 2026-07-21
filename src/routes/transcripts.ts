import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// List transcripts (with search)
router.get("/", async (req: Request, res: Response) => {
  const { search, status, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { patientName: { contains: String(search), mode: "insensitive" } },
      { patientPhone: { contains: String(search) } },
    ];
  }

  const [transcripts, total] = await Promise.all([
    prisma.callTranscript.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.callTranscript.count({ where }),
  ]);

  res.json({ transcripts, total, page: Number(page), limit: Number(limit) });
});

// Get transcript by ID
router.get("/:id", async (req: Request, res: Response) => {
  const transcript = await prisma.callTranscript.findUnique({
    where: { id: String(req.params.id) },
  });

  if (!transcript) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }

  res.json({ transcript });
});

export { router as transcriptRoutes };
