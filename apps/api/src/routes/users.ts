import { Router, Response } from "express";
import { db, users, user_stores, stores } from "@seo/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  hashPassword, verifyPassword, signToken, generatePassword, type AuthedRequest,
} from "../lib/auth.js";

const router = Router();

function requireAdmin(req: AuthedRequest, res: Response): boolean {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Solo el administrador puede hacer esto" });
    return false;
  }
  return true;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post("/api/auth/login", async (req: AuthedRequest, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const user = await db.query.users.findFirst({
      where: eq(users.email, (email || "").toLowerCase().trim()),
    });
    if (!user || !verifyPassword(password || "", user.password_hash)) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }
    const token = signToken({ uid: user.id, role: user.role });
    res.json({ token, role: user.role, email: user.email, name: user.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── USUARIO ACTUAL ────────────────────────────────────────────────────────────
router.get("/api/auth/me", async (req: AuthedRequest, res: Response) => {
  if (!req.user) { res.status(401).json({ error: "No autorizado" }); return; }
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.uid) });
  if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
});

// ── ADMIN: CREAR CLIENTE ──────────────────────────────────────────────────────
router.post("/api/admin/users", async (req: AuthedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { email, name, store_id } = req.body || {};
    if (!email) { res.status(400).json({ error: "Email requerido" }); return; }
    const norm = email.toLowerCase().trim();
    const existing = await db.query.users.findFirst({ where: eq(users.email, norm) });
    if (existing) { res.status(409).json({ error: "Ya existe un usuario con ese email" }); return; }

    const password = generatePassword();
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id, email: norm, password_hash: hashPassword(password), role: "client", name: name || null,
    });
    if (store_id) {
      await db.insert(user_stores).values({ id: crypto.randomUUID(), user_id: id, store_id });
    }
    // La contraseña se devuelve UNA sola vez para que se la pases al cliente.
    res.json({ success: true, user: { id, email: norm, name: name || null }, password });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: LISTAR USUARIOS ────────────────────────────────────────────────────
router.get("/api/admin/users", async (req: AuthedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const all = await db.select().from(users);
    const links = await db.select().from(user_stores);
    const data = all.map((u) => ({
      id: u.id, email: u.email, role: u.role, name: u.name,
      store_ids: links.filter((l) => l.user_id === u.id).map((l) => l.store_id),
    }));
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: RESETEAR CONTRASEÑA ────────────────────────────────────────────────
router.post("/api/admin/users/:id/reset-password", async (req: AuthedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const password = generatePassword();
    await db.update(users).set({ password_hash: hashPassword(password) }).where(eq(users.id, req.params.id));
    res.json({ success: true, password });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: ASIGNAR TIENDA A UN CLIENTE ────────────────────────────────────────
router.post("/api/admin/users/:id/stores", async (req: AuthedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { store_id } = req.body || {};
    if (!store_id) { res.status(400).json({ error: "store_id requerido" }); return; }
    const exists = await db.query.user_stores.findFirst({
      where: eq(user_stores.user_id, req.params.id),
    });
    // evita duplicados simples (un cliente normalmente tiene una tienda)
    if (exists && exists.store_id === store_id) { res.json({ success: true }); return; }
    await db.insert(user_stores).values({ id: crypto.randomUUID(), user_id: req.params.id, store_id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: ELIMINAR USUARIO ───────────────────────────────────────────────────
router.delete("/api/admin/users/:id", async (req: AuthedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.delete(user_stores).where(eq(user_stores.user_id, req.params.id));
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
