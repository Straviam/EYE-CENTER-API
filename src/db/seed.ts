import { PrismaClient, Role, Gender, RoomType, VisitType, AppointmentStatus, TestType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.orderedTest.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.roomEntry.deleteMany();
  await prisma.roomRouting.deleteMany();
  await prisma.callTranscript.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.room.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  console.log("  Cleaned existing data");

  // ─── Passwords ──────────────────────────────────────────────
  const adminPw = await bcrypt.hash("admin123", 12);
  const receptionPw = await bcrypt.hash("reception123", 12);
  const operatorPw = await bcrypt.hash("operator123", 12);
  const doctorPw = await bcrypt.hash("doctor123", 12);

  // ─── Users ───────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: { email: "admin@eyecenter.pk", passwordHash: adminPw, name: "Admin", role: Role.ADMIN },
  });

  const receptionist = await prisma.user.create({
    data: { email: "reception@eyecenter.pk", passwordHash: receptionPw, name: "Front Desk", role: Role.RECEPTIONIST },
  });

  // One operator per room type
  const opDilution = await prisma.user.create({
    data: { email: "op-dilution@eyecenter.pk", passwordHash: operatorPw, name: "Dilution Operator", role: Role.OPERATOR },
  });
  const opSLE = await prisma.user.create({
    data: { email: "op-sle@eyecenter.pk", passwordHash: operatorPw, name: "SLE Operator", role: Role.OPERATOR },
  });
  const opTono = await prisma.user.create({
    data: { email: "op-tono@eyecenter.pk", passwordHash: operatorPw, name: "Tonometry Operator", role: Role.OPERATOR },
  });
  const opRetina = await prisma.user.create({
    data: { email: "op-retina@eyecenter.pk", passwordHash: operatorPw, name: "Retina Operator", role: Role.OPERATOR },
  });
  const opOCT = await prisma.user.create({
    data: { email: "op-oct@eyecenter.pk", passwordHash: operatorPw, name: "OCT Operator", role: Role.OPERATOR },
  });

  // Doctor users
  const drMahnazUser = await prisma.user.create({
    data: { email: "mahnaz@eyecenter.pk", passwordHash: doctorPw, name: "Dr. Mahnaz Naveed Shah", role: Role.DOCTOR },
  });
  const drAliUser = await prisma.user.create({
    data: { email: "ali@eyecenter.pk", passwordHash: doctorPw, name: "Dr. Ali", role: Role.DOCTOR },
  });

  // ─── Doctors ─────────────────────────────────────────────────
  const drMahnaz = await prisma.doctor.create({
    data: { name: "Dr. Mahnaz Naveed Shah", specialization: "Ophthalmology", userId: drMahnazUser.id },
  });
  const drAli = await prisma.doctor.create({
    data: { name: "Dr. Ali", specialization: "Retina Specialist", userId: drAliUser.id },
  });

  // Doctor schedules
  const scheduleData = [
    { doctorId: drMahnaz.id, dayOfWeek: 6, startTime: "09:00", endTime: "17:00" },
    { doctorId: drMahnaz.id, dayOfWeek: 0, startTime: "09:00", endTime: "17:00" },
    { doctorId: drMahnaz.id, dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
    { doctorId: drMahnaz.id, dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
    { doctorId: drMahnaz.id, dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
    { doctorId: drMahnaz.id, dayOfWeek: 4, startTime: "09:00", endTime: "13:00" },
    { doctorId: drAli.id, dayOfWeek: 6, startTime: "10:00", endTime: "16:00" },
    { doctorId: drAli.id, dayOfWeek: 0, startTime: "10:00", endTime: "16:00" },
    { doctorId: drAli.id, dayOfWeek: 1, startTime: "10:00", endTime: "16:00" },
    { doctorId: drAli.id, dayOfWeek: 2, startTime: "10:00", endTime: "16:00" },
    { doctorId: drAli.id, dayOfWeek: 3, startTime: "10:00", endTime: "16:00" },
  ];
  for (const s of scheduleData) {
    await prisma.doctorSchedule.create({ data: s });
  }

  // ─── Rooms (with operators assigned) ─────────────────────────
  const room1 = await prisma.room.create({ data: { name: "Room 1 - Dilution", type: RoomType.DILUTION, sequence: 1, operatorId: opDilution.id } });
  const room2 = await prisma.room.create({ data: { name: "Room 2 - Waiting", type: RoomType.WAITING, sequence: 2, isActive: false } });
  const room3 = await prisma.room.create({ data: { name: "Room 3 - SLE", type: RoomType.DIAGNOSTIC, sequence: 3, operatorId: opSLE.id } });
  const room4 = await prisma.room.create({ data: { name: "Room 4 - Tonometry", type: RoomType.DIAGNOSTIC, sequence: 4, operatorId: opTono.id } });
  const room5 = await prisma.room.create({ data: { name: "Room 5 - Retina", type: RoomType.RETINA, sequence: 5, operatorId: opRetina.id } });
  const room6 = await prisma.room.create({ data: { name: "Room 6 - OCT/FFA", type: RoomType.DIAGNOSTIC, sequence: 6, operatorId: opOCT.id } });
  const room7 = await prisma.room.create({ data: { name: "Room 7 - Doctor Consultation", type: RoomType.DOCTOR, sequence: 7, isActive: false } });

  // Only rooms with operators participate in the routing pipeline
  const operatorRooms = [room1, room3, room4, room5, room6];

  // ─── Patients ────────────────────────────────────────────────
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const patientAhmed = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0001", name: "Ahmed Khan", phone: "0300-1234567", whatsappPhone: "0300-1234567",
      email: "ahmed.khan@gmail.com", dateOfBirth: new Date("1971-05-15"), gender: Gender.MALE,
      cnic: "42101-1234567-1", hypertension: true, diabetes: true,
      ocularSurgery: "Phacoemulsification + PCIOL RE (2024)",
      currentMeds: "Metformin 500mg BD, Amlodipine 5mg OD", referredBy: "Dr. Saeed Clinic",
      registrationSource: "phone",
    },
  });

  const patientFatima = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0002", name: "Fatima Ali", phone: "0321-9876543", whatsappPhone: "0321-9876543",
      dateOfBirth: new Date("1984-08-22"), gender: Gender.FEMALE, registrationSource: "website",
    },
  });

  const patientMohammad = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0003", name: "Mohammad Raza", phone: "0333-5551234", whatsappPhone: "0333-5551234",
      dateOfBirth: new Date("1958-01-30"), gender: Gender.MALE, cnic: "42101-7654321-2",
      hypertension: true, cad: true,
      currentMeds: "Aspirin 75mg OD, Atenolol 50mg OD, Timolol 0.5% eye drops BD RE",
      familyEyeHistory: "Father had glaucoma", registrationSource: "phone",
    },
  });

  const patientAyesha = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0004", name: "Ayesha Begum", phone: "0345-6789012",
      dateOfBirth: new Date("1991-03-10"), gender: Gender.FEMALE, copd: true,
      currentMeds: "Salbutamol inhaler PRN", registrationSource: "website",
    },
  });

  const patientHassan = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0005", name: "Hassan Shah", phone: "0312-3456789", whatsappPhone: "0312-3456789",
      dateOfBirth: new Date("1954-11-25"), gender: Gender.MALE, diabetes: true,
      currentMeds: "Insulin Glargine 20 units OD, Gliclazide 80mg BD", registrationSource: "phone",
    },
  });

  const patientSara = await prisma.patient.create({
    data: {
      mrNumber: "MR-2026-0006", name: "Sara Malik", phone: "0300-9998877", whatsappPhone: "0300-9998877",
      dateOfBirth: new Date("1998-07-04"), gender: Gender.FEMALE, allergies: "Penicillin",
      registrationSource: "website",
    },
  });

  // ─── Appointments ────────────────────────────────────────────
  //
  // WORKFLOW SCENARIOS:
  //
  // Routing order: Room 1 (Dilution) → Room 3 (SLE) → Room 4 (Tonometry) → Room 5 (Retina) → Room 6 (OCT/FFA)
  // Waiting (Room 2) and Doctor Consultation (Room 7) are not part of the operator routing pipeline.
  //
  // 1. Ahmed Khan — COMPLETED: arrived, went through all rooms, saw doctor, done
  // 2. Mohammad Raza — IN ROOMS: arrived, completed dilution+SLE, at tonometry (ACTIVE)
  // 3. Fatima Ali — JUST ARRIVED: arrived, routings created, at dilution (ACTIVE)
  // 4. Hassan Shah — WITH DOCTOR: already saw doctor, appointment IN_PROGRESS
  // 5. Ayesha Begum — CONFIRMED: hasn't arrived yet
  // 6. Sara Malik — PENDING: waiting for confirmation

  const aptAhmed = await prisma.appointment.create({
    data: {
      patientId: patientAhmed.id, doctorId: drMahnaz.id,
      scheduledAt: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      visitType: VisitType.FOLLOW_UP, dilutionRequired: true,
      status: AppointmentStatus.COMPLETED, confirmationSent: true,
    },
  });

  const aptMohammad = await prisma.appointment.create({
    data: {
      patientId: patientMohammad.id, doctorId: drAli.id,
      scheduledAt: new Date(today.getTime() + 10.5 * 60 * 60 * 1000),
      visitType: VisitType.FOLLOW_UP, dilutionRequired: true,
      status: AppointmentStatus.ARRIVED, confirmationSent: true,
    },
  });

  const aptFatima = await prisma.appointment.create({
    data: {
      patientId: patientFatima.id, doctorId: drMahnaz.id,
      scheduledAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      visitType: VisitType.NEW, dilutionRequired: true,
      status: AppointmentStatus.ARRIVED, confirmationSent: true,
    },
  });

  const aptHassan = await prisma.appointment.create({
    data: {
      patientId: patientHassan.id, doctorId: drAli.id,
      scheduledAt: new Date(today.getTime() + 11.5 * 60 * 60 * 1000),
      visitType: VisitType.FOLLOW_UP, dilutionRequired: false,
      status: AppointmentStatus.IN_PROGRESS, confirmationSent: true,
    },
  });

  const aptAyesha = await prisma.appointment.create({
    data: {
      patientId: patientAyesha.id, doctorId: drMahnaz.id,
      scheduledAt: new Date(today.getTime() + 11 * 60 * 60 * 1000),
      visitType: VisitType.NEW, dilutionRequired: true,
      status: AppointmentStatus.CONFIRMED, confirmationSent: true,
    },
  });

  const aptSara = await prisma.appointment.create({
    data: {
      patientId: patientSara.id, doctorId: drMahnaz.id,
      scheduledAt: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      visitType: VisitType.NEW, dilutionRequired: true,
      status: AppointmentStatus.PENDING,
    },
  });

  // ─── Visits ──────────────────────────────────────────────────

  // Ahmed — completed visit (doctor saw him, everything done)
  const visitAhmed = await prisma.visit.create({
    data: {
      patientId: patientAhmed.id, appointmentId: aptAhmed.id, doctorId: drMahnaz.id,
      vaRight: "6/12", vaLeft: "6/9",
      sleRight: "PCIOL in situ, quiet AC, clear graft", sleLeft: "PCIOL in situ, quiet AC",
      taRight: "14", taLeft: "15", lensRight: "PCIOL", lensLeft: "PCIOL",
      fundusRight: "Healthy disc, no neovascularization", fundusLeft: "Healthy disc, mild ARMA",
      pachymetryRight: "530", pachymetryLeft: "535",
      systemicRx: "Metformin 500mg BD\nAmlodipine 5mg OD",
      ocularRx: "Prednisolone acetate 1% QID RE x 2 weeks\nTimolol 0.5% BD both eyes",
      assessmentPlan: "Post-cataract follow-up RE. Graft quiet. IOP well controlled. Continue current medications.",
      treatmentPlan: "Continue drops, review in 4 weeks",
    },
  });
  await prisma.orderedTest.createMany({
    data: [
      { visitId: visitAhmed.id, testType: TestType.OCT, ordered: true },
      { visitId: visitAhmed.id, testType: TestType.VF, ordered: true },
    ],
  });

  // Mohammad — in-progress visit (visit created, doctor hasn't filled clinical exam yet)
  const visitMohammad = await prisma.visit.create({
    data: {
      patientId: patientMohammad.id, appointmentId: aptMohammad.id, doctorId: drAli.id,
    },
  });

  // Fatima — just arrived, visit will be created when routings are set up
  const visitFatima = await prisma.visit.create({
    data: {
      patientId: patientFatima.id, appointmentId: aptFatima.id, doctorId: drMahnaz.id,
    },
  });

  // Hassan — doctor already saw him
  const visitHassan = await prisma.visit.create({
    data: {
      patientId: patientHassan.id, appointmentId: aptHassan.id, doctorId: drAli.id,
      vaRight: "CF 1m", vaLeft: "6/36",
      sleRight: "Dense cataract, hard to view fundus", sleLeft: "PCIOL in situ, quiet AC",
      taRight: "18", taLeft: "16",
      fundusLeft: "Moderate NPDR, DME present",
      systemicRx: "Insulin Glargine 20 units OD\nGliclazide 80mg BD",
      assessmentPlan: "Poorly controlled DM with diabetic retinopathy. RE dense cataract needing surgery. LE DME needs anti-VEGF.",
      surgeryRecommended: true,
      surgeryDetails: "Phacoemulsification + PCIOL RE — schedule for next week",
    },
  });
  await prisma.orderedTest.createMany({
    data: [
      { visitId: visitHassan.id, testType: TestType.OCT, ordered: true },
      { visitId: visitHassan.id, testType: TestType.FFA, ordered: true },
      { visitId: visitHassan.id, testType: TestType.B_SCAN, ordered: true },
    ],
  });

  // ─── Room Routings (only for operator-staffed rooms) ──────────
  //
  // Ahmed (COMPLETED): all 5 rooms COMPLETED
  for (let i = 0; i < operatorRooms.length; i++) {
    await prisma.roomRouting.create({
      data: {
        visitId: visitAhmed.id, roomId: operatorRooms[i].id, sequence: i + 1,
        status: "COMPLETED", completedAt: new Date(), messageSentAt: new Date(),
      },
    });
  }

  // Mohammad (ARRIVED): rooms 1-2 COMPLETED, room 3 (tonometry) ACTIVE, rooms 4-5 PENDING
  const mohammadRoomStatuses: ("COMPLETED" | "ACTIVE" | "PENDING")[] = [
    "COMPLETED", "COMPLETED", "ACTIVE", "PENDING", "PENDING",
  ];
  for (let i = 0; i < operatorRooms.length; i++) {
    await prisma.roomRouting.create({
      data: {
        visitId: visitMohammad.id, roomId: operatorRooms[i].id, sequence: i + 1,
        status: mohammadRoomStatuses[i],
        completedAt: mohammadRoomStatuses[i] === "COMPLETED" ? new Date() : null,
        messageSentAt: mohammadRoomStatuses[i] !== "PENDING" ? new Date() : null,
      },
    });
  }

  // Fatima (ARRIVED): room 1 (dilution) ACTIVE, rooms 2-5 PENDING
  const fatimaRoomStatuses: ("COMPLETED" | "ACTIVE" | "PENDING")[] = [
    "ACTIVE", "PENDING", "PENDING", "PENDING", "PENDING",
  ];
  for (let i = 0; i < operatorRooms.length; i++) {
    await prisma.roomRouting.create({
      data: {
        visitId: visitFatima.id, roomId: operatorRooms[i].id, sequence: i + 1,
        status: fatimaRoomStatuses[i],
        completedAt: fatimaRoomStatuses[i] === "COMPLETED" ? new Date() : null,
        messageSentAt: fatimaRoomStatuses[i] === "ACTIVE" ? new Date() : null,
      },
    });
  }

  // ─── Room Entries (operator form submissions for completed rooms) ──

  // Ahmed — entries for all rooms he visited
  await prisma.roomEntry.create({
    data: {
      visitId: visitAhmed.id, roomId: room1.id, operatorId: opDilution.id, roomType: "DILUTION",
      formData: { drops: "Tropicamide 1%", time: "08:30", eyes: "Both", pupilSize: "3mm" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 9 * 60 * 60 * 1000),
    },
  });
  await prisma.roomEntry.create({
    data: {
      visitId: visitAhmed.id, roomId: room3.id, operatorId: opSLE.id, roomType: "SLE",
      formData: { right: "PCIOL in situ, quiet AC, clear cornea", left: "PCIOL in situ, quiet AC" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 9.5 * 60 * 60 * 1000),
    },
  });
  await prisma.roomEntry.create({
    data: {
      visitId: visitAhmed.id, roomId: room4.id, operatorId: opTono.id, roomType: "TONOMETRY",
      formData: { right: "14", left: "15" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 9.75 * 60 * 60 * 1000),
    },
  });
  await prisma.roomEntry.create({
    data: {
      visitId: visitAhmed.id, roomId: room5.id, operatorId: opRetina.id, roomType: "RETINA",
      formData: { right: "Healthy disc, sharp margins, no hemorrhages", left: "Healthy disc, mild ARMA" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
    },
  });
  await prisma.roomEntry.create({
    data: {
      visitId: visitAhmed.id, roomId: room6.id, operatorId: opOCT.id, roomType: "OCT_FFA",
      formData: { tests: ["OCT", "VF"], findings: "OCT: within normal limits" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 10.25 * 60 * 60 * 1000),
    },
  });

  // Mohammad — entries for completed rooms (dilution, SLE done; at tonometry)
  await prisma.roomEntry.create({
    data: {
      visitId: visitMohammad.id, roomId: room1.id, operatorId: opDilution.id, roomType: "DILUTION",
      formData: { drops: "Tropicamide 1% + Phenylephrine 2.5%", time: "10:15", eyes: "Both", pupilSize: "7mm" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 10.25 * 60 * 60 * 1000),
    },
  });
  await prisma.roomEntry.create({
    data: {
      visitId: visitMohammad.id, roomId: room3.id, operatorId: opSLE.id, roomType: "SLE",
      formData: { right: "Deep AC, open angle, lens clear", left: "Deep AC, open angle, mild nuclear sclerosis" },
      completedAt: new Date(), enteredAt: new Date(today.getTime() + 10.75 * 60 * 60 * 1000),
    },
  });

  // ─── Call Transcripts ────────────────────────────────────────
  await prisma.callTranscript.createMany({
    data: [
      {
        vapiCallId: "call-seed-001", patientPhone: "0300-1234567", patientName: "Ahmed Khan",
        transcript: "AI: Hello, this is The Eye Center. How can I help you?\nPatient: Hi, I have an appointment with Dr. Mahnaz next week, I want to confirm the time.\nAI: Sure, I can help with that. Can you tell me your name and phone number?\nPatient: Ahmed Khan, 0300-1234567.\nAI: Thank you Ahmed. I can see your appointment is confirmed for next Saturday at 9:00 AM with Dr. Mahnaz. It's a follow-up visit. Please bring someone with you as eye dilution will be needed.\nPatient: Okay, thank you.\nAI: You're welcome. Is there anything else I can help with?\nPatient: No, that's all. Thank you.\nAI: Have a great day!",
        messages: [
          { role: "assistant", message: "Hello, this is The Eye Center. How can I help you?" },
          { role: "user", message: "Hi, I have an appointment with Dr. Mahnaz next week, I want to confirm the time." },
          { role: "assistant", message: "Sure, I can help with that. Can you tell me your name and phone number?" },
          { role: "user", message: "Ahmed Khan, 0300-1234567." },
          { role: "assistant", message: "Thank you Ahmed. I can see your appointment is confirmed for next Saturday at 9:00 AM with Dr. Mahnaz. It's a follow-up visit. Please bring someone with you as eye dilution will be needed." },
        ],
        status: "completed",
        startedAt: new Date(today.getTime() + 8 * 60 * 60 * 1000),
        endedAt: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 3 * 60 * 1000),
      },
      {
        vapiCallId: "call-seed-002", patientPhone: "0321-9876543", patientName: "Fatima Ali",
        transcript: "AI: Hello, thank you for calling The Eye Center. How may I assist you?\nPatient: Hi, I need to book an appointment. I've been having headaches and blurry vision.\nAI: I'm sorry to hear that. Let me help you book an appointment. Are you a new patient or have you visited us before?\nPatient: This would be my first time.\nAI: Okay, as a new patient, I'll need some details. Can you tell me your name, age, and preferred doctor?\nPatient: Fatima Ali, I'm 42. I don't have a preference.\nAI: Thank you Fatima. I'll book you with Dr. Mahnaz Naveed Shah, our lead ophthalmologist. She has availability next Saturday at 10:00 AM. Would that work?\nPatient: Yes, that works.\nAI: Great. I've noted blurry vision and headaches as your reason for visit. Since this is your first visit, eye dilution will be needed, so please bring someone with you.",
        messages: [
          { role: "assistant", message: "Hello, thank you for calling The Eye Center. How may I assist you?" },
          { role: "user", message: "Hi, I need to book an appointment. I've been having headaches and blurry vision." },
          { role: "assistant", message: "I'm sorry to hear that. Let me help you book an appointment. Are you a new patient or have you visited us before?" },
          { role: "user", message: "This would be my first time." },
          { role: "assistant", message: "Okay, as a new patient, I'll need some details. Can you tell me your name, age, and preferred doctor?" },
        ],
        status: "completed",
        startedAt: new Date(today.getTime() + 8.5 * 60 * 60 * 1000),
        endedAt: new Date(today.getTime() + 8.5 * 60 * 60 * 1000 + 4 * 60 * 1000),
      },
      {
        vapiCallId: "call-seed-003", patientPhone: "0345-6789012", patientName: "Ayesha Begum",
        transcript: "AI: Hello, this is The Eye Center. How can I help you?\nPatient: Hi, I'd like to book an eye checkup.\nAI: Of course. Are you a new or existing patient?\nPatient: New patient.\nAI: Great. Can I have your name and a contact number?\nPatient: Ayesha Begum, 0345-6789012.\nAI: Thank you Ayesha. What brings you in? Any specific symptoms?\nPatient: Just a routine checkup, it's been over a year since my last eye exam.\nAI: Understood. I'll book you with Dr. Mahnaz. She has openings next Saturday at 11:00 AM. Since you're a new patient, eye dilution will be needed — please bring a companion.",
        messages: [
          { role: "assistant", message: "Hello, this is The Eye Center. How can I help you?" },
          { role: "user", message: "Hi, I'd like to book an eye checkup." },
          { role: "assistant", message: "Of course. Are you a new or existing patient?" },
          { role: "user", message: "New patient." },
          { role: "assistant", message: "Great. Can I have your name and a contact number?" },
        ],
        status: "completed",
        startedAt: new Date(today.getTime() + 7 * 60 * 60 * 1000),
        endedAt: new Date(today.getTime() + 7 * 60 * 60 * 1000 + 2 * 60 * 1000),
      },
    ],
  });

  // ─── Summary ─────────────────────────────────────────────────
  console.log("\nSeed completed!\n");
  console.log("Login Credentials:");
  console.log("  Admin:        admin@eyecenter.pk / admin123");
  console.log("  Receptionist: reception@eyecenter.pk / reception123");
  console.log("  Dr. Mahnaz:   mahnaz@eyecenter.pk / doctor123");
  console.log("  Dr. Ali:      ali@eyecenter.pk / doctor123");
  console.log("  Dilution Op:  op-dilution@eyecenter.pk / operator123");
  console.log("  SLE Op:       op-sle@eyecenter.pk / operator123");
  console.log("  Tono Op:      op-tono@eyecenter.pk / operator123");
  console.log("  Retina Op:    op-retina@eyecenter.pk / operator123");
  console.log("  OCT Op:       op-oct@eyecenter.pk / operator123");
  console.log("\nPatient Workflow Today (5 rooms: Dilution → SLE → Tonometry → Retina → OCT/FFA):");
  console.log("  1. Ahmed Khan   — COMPLETED (all rooms done, doctor visited)");
  console.log("  2. Mohammad Raza — IN ROOMS   (completed dilution+SLE, at tonometry)");
  console.log("  3. Fatima Ali    — JUST ARRIVED (at dilution)");
  console.log("  4. Hassan Shah   — WITH DOCTOR (doctor saw him, IN_PROGRESS)");
  console.log("  5. Ayesha Begum  — CONFIRMED (not arrived yet)");
  console.log("  6. Sara Malik    — PENDING (waiting for confirmation)");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
