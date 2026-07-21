import { Router } from "express";
import {
  sendBookingConfirmation,
  sendRoomRouting,
  sendTextMessage,
} from "../services/whatsapp.js";
import type { Request, Response } from "express";

const router = Router();

// Send booking confirmation
router.post("/send-confirmation", async (req: Request, res: Response) => {
  const { to, patientName, doctorName, date, time, visitType, dilutionRequired, registrationLink } = req.body;

  if (!to || !patientName || !doctorName || !date || !time) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    await sendBookingConfirmation({
      to, patientName, doctorName, date, time,
      visitType, dilutionRequired, registrationLink,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

// Send room routing
router.post("/send-room-routing", async (req: Request, res: Response) => {
  const { to, patientName, roomName, instruction } = req.body;

  if (!to || !roomName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    await sendRoomRouting({ to, patientName, roomName, instruction: instruction || "Please proceed." });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

// Send generic text message
router.post("/send-text", async (req: Request, res: Response) => {
  const { to, body: messageBody } = req.body;

  if (!to || !messageBody) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    await sendTextMessage(to, messageBody);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

export { router as whatsappRoutes };
