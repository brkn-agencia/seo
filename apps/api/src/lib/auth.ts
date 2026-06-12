import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db, users, user_stores } from "@seo/db";
import { eq, and } from "drizzle-orm";

const SECRET = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || "dev-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

// ── HASH DE CONTRASEÑAS (scrypt nativo) ───────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const a = Buffer.from(hashHex, "hex");
  return a.length === hash.length && crypto.timingSafeEqual(a, hash);
}

// ── TOKENS FIRMADOS (JWT-lite con HMAC) ───────────────────────────────────────
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signToken(payload: { uid: string; role: string }): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const data = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string): { uid: string; role: string } | null {
  const [data, sig] = (token || "").split(".");
  if (!data || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const body = JSON.parse(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: body.uid, role: body.role };
  } catch {
    return null;
  }
}

// Genera una contraseña legible para entregarle al cliente.
export function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
}

// ── HELPERS DE ACCESO ─────────────────────────────────────────────────────────
export async function userCanAccessStore(user: { uid: string; role: string }, storeId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const link = await db.query.user_stores.findFirst({
    where: and(eq(user_stores.user_id, user.uid), eq(user_stores.store_id, storeId)),
  });
  return !!link;
}

export async function storeIdsForUser(user: { uid: string; role: string }): Promise<string[] | "all"> {
  if (user.role === "admin") return "all";
  const links = await db.select().from(user_stores).where(eq(user_stores.user_id, user.uid));
  return links.map((l) => l.store_id);
}

// Tipado mínimo de req.user
export interface AuthedRequest extends Request {
  user?: { uid: string; role: string };
}
