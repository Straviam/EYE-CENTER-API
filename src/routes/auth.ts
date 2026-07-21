import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db/index.js";
import { generateToken } from "../middleware/auth.js";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = generateToken(tokenPayload);

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000, // 12h
  });

  res.json({ user: tokenPayload, token });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("accessToken");
  res.setHeader("Clear-Site-Data", '"cookies"');
  res.json({ message: "Logged out" });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

export async function listUsers(req: Request, res: Response) {
  const { role } = req.query;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  res.json({ users });
}

export async function createUser(req: Request, res: Response) {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, name, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  res.status(201).json({ user });
}
