const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v19.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";

interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: {
    type: string;
    parameters: { type: string; text: string }[];
  }[];
}

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: "template" | "text" | "document";
  template?: WhatsAppTemplate;
  text?: { body: string };
  document?: {
    link: string;
    filename: string;
    caption?: string;
  };
}

async function sendWhatsAppMessage(to: string, message: WhatsAppMessage) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn("WhatsApp not configured, skipping message to", to);
    return null;
  }

  const res = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.error("WhatsApp API error:", error);
    throw new Error(`WhatsApp API error: ${res.status}`);
  }

  return res.json();
}

// ─── Booking Confirmation ────────────────────────────────────

export async function sendBookingConfirmation(params: {
  to: string;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  visitType: string;
  dilutionRequired: boolean;
  registrationLink?: string;
}) {
  const { to, patientName, doctorName, date, time, visitType, dilutionRequired, registrationLink } = params;

  const dilutionText = dilutionRequired ? "Please bring someone to accompany you for eye dilution." : "";
  const registrationText = registrationLink
    ? `\n\nPlease complete your registration online before arrival:\n${registrationLink}`
    : "";

  const body = `Dear ${patientName},

Your appointment has been confirmed:

Doctor: ${doctorName}
Date: ${date}
Time: ${time}
Type: ${visitType === "NEW" ? "New Patient" : "Follow-up"}

${dilutionText}${registrationText}

Please arrive 15 minutes early.
For cancellations, call us.

— The Eye Center`;

  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

// ─── Room Routing ────────────────────────────────────────────

export async function sendRoomRouting(params: {
  to: string;
  patientName: string;
  roomName: string;
  instruction: string;
}) {
  const { to, patientName, roomName, instruction } = params;

  const body = `Hi ${patientName},

Please proceed to ${roomName}.
${instruction}

— The Eye Center`;

  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

// ─── Surgery Reminder ────────────────────────────────────────

export async function sendSurgeryReminder(params: {
  to: string;
  patientName: string;
  surgeryType: string;
  surgeryDate: string;
}) {
  const { to, patientName, surgeryType, surgeryDate } = params;

  const body = `Dear ${patientName},

This is a reminder for your scheduled surgery:

Procedure: ${surgeryType}
Date: ${surgeryDate}

Please follow all pre-operative instructions.
If you have any questions, please contact us.

— The Eye Center`;

  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

// ─── Invoice / Receipt PDF ───────────────────────────────────

export async function sendInvoicePdf(params: {
  to: string;
  patientName: string;
  pdfUrl: string;
  invoiceNumber: string;
}) {
  const { to, patientName, pdfUrl, invoiceNumber } = params;

  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link: pdfUrl,
      filename: `${invoiceNumber}.pdf`,
      caption: `Dear ${patientName}, here is your invoice ${invoiceNumber} from The Eye Center.`,
    },
  });
}

// ─── General Text Message ────────────────────────────────────

export async function sendTextMessage(to: string, body: string) {
  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}
