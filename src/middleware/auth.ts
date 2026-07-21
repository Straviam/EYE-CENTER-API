import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.accessToken;

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
