import { Router } from "express";
import prisma from "../db/index.js";
import type { Request, Response } from "express";

const router = Router();

// VAPI webhook handler
router.post("/vapi/events", async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message?.type) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  const { type, call, artifact } = message;

  try {
    switch (type) {
      case "end-of-call-report": {
        const callId = call?.id;
        if (!callId) break;

        await prisma.callTranscript.upsert({
          where: { vapiCallId: callId },
          create: {
            vapiCallId: callId,
            patientPhone: call?.customer?.number || call?.phoneNumber || "unknown",
            patientName: call?.customer?.name || null,
            transcript: artifact?.transcript || "",
            messages: artifact?.messages || [],
            recordingUrl: artifact?.recording?.recordingUrl || null,
            status: "completed",
            startedAt: call?.startedAt ? new Date(call.startedAt) : null,
            endedAt: new Date(),
          },
          update: {
            transcript: artifact?.transcript || "",
            messages: artifact?.messages || [],
            recordingUrl: artifact?.recording?.recordingUrl || null,
            status: "completed",
            endedAt: new Date(),
          },
        });

        // TODO: Notify admin dashboard via SSE
        break;
      }

      case "transcript": {
        // Partial/final transcript — could push to SSE for live feed
        // For now, just log; we store the full transcript in end-of-call-report
        console.log(`Transcript [${message.transcriptType}]: ${message.transcript}`);
        break;
      }

      case "status-update": {
        console.log(`Call ${call?.id} status: ${message.status}`);
        break;
      }

      default:
        // Ignore other event types
        break;
    }
  } catch (error) {
    console.error("VAPI webhook error:", error);
  }

  // Always respond 200 to VAPI
  res.status(200).json({ received: true });
});

// WhatsApp delivery status callback
router.post("/whatsapp/callback", async (req: Request, res: Response) => {
  // WhatsApp sends delivery/read status updates here
  console.log("WhatsApp callback:", JSON.stringify(req.body));
  res.status(200).json({ received: true });
});

export { router as webhookRoutes };
