import { Router } from "express";
import { login, logout, me, listUsers, createUser } from "../routes/auth.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { patientRoutes } from "./patients.js";
import { doctorRoutes } from "./doctors.js";
import { appointmentRoutes } from "./appointments.js";
import { visitRoutes } from "./visits.js";
import { transcriptRoutes } from "./transcripts.js";
import { webhookRoutes } from "./webhooks.js";
import { roomRoutes } from "./rooms.js";
import { invoiceRoutes } from "./invoices.js";
import { whatsappRoutes } from "./whatsapp.js";

const router = Router();

// Auth
router.post("/auth/login", login);
router.post("/auth/logout", logout);
router.get("/auth/me", authMiddleware, me);
router.get("/auth/users", authMiddleware, requireRole("ADMIN"), listUsers);
router.post("/auth/users", authMiddleware, requireRole("ADMIN"), createUser);

// Protected routes
router.use("/patients", authMiddleware, patientRoutes);
router.use("/doctors", authMiddleware, doctorRoutes);
router.use("/appointments", authMiddleware, appointmentRoutes);
router.use("/visits", authMiddleware, visitRoutes);
router.use("/transcripts", authMiddleware, transcriptRoutes);
router.use("/rooms", authMiddleware, roomRoutes);
router.use("/invoices", authMiddleware, invoiceRoutes);
router.use("/whatsapp", authMiddleware, whatsappRoutes);

// Webhooks (no auth — verified by VAPI secret or WhatsApp signature)
router.use("/webhooks", webhookRoutes);

export default router;
