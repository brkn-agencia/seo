import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import authRouter from "./routes/auth.js";
import storesRouter from "./routes/stores.js";
import seoRouter from "./routes/seo.js";
import jobsRouter from "./routes/jobs.js";
import metricsRouter from "./routes/metrics.js";
import usersRouter from "./routes/users.js";
import { startScheduler } from "./services/scheduler.js";
import { runMigrations, db, users } from "@seo/db";
import { eq } from "drizzle-orm";
import { verifyToken, userCanAccessStore, hashPassword, type AuthedRequest } from "./lib/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "https://seo-web-13yk.onrender.com",
    "https://seo.bruda.io",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── AUTENTICACIÓN POR TOKEN ───────────────────────────────────────────────────
// El panel (HTML/JS), el OAuth de TN, el health y el login quedan públicos.
// Todo lo demás bajo /api requiere un token válido (login por usuario).
function isPublic(p: string): boolean {
  if (p === "/health" || p === "/auth/install" || p === "/auth/callback" || p === "/api/auth/login") return true;
  // estáticos del panel y rutas del SPA: públicos (el SPA pide login por su cuenta)
  if (!p.startsWith("/api") && !p.startsWith("/auth/stores")) return true;
  return false;
}

app.use((req: AuthedRequest, res, next) => {
  if (isPublic(req.path)) return next();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = verifyToken(token);
  if (!user) { res.status(401).json({ error: "No autorizado" }); return; }
  req.user = user;
  next();
});

// Control de acceso por tienda: un cliente solo accede a sus tiendas.
app.use(async (req: AuthedRequest, res, next) => {
  const m = req.path.match(/^\/api\/stores\/([^/]+)/);
  if (!m || !req.user) return next();
  const storeId = decodeURIComponent(m[1]);
  if (await userCanAccessStore(req.user, storeId)) return next();
  res.status(403).json({ error: "No tenés acceso a esta tienda" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    service: "seo-agency-api",
    url: "https://seo.bruda.io",
  });
});

app.use("/", usersRouter);
app.use("/", authRouter);
app.use("/", storesRouter);
app.use("/", seoRouter);
app.use("/", jobsRouter);
app.use("/", metricsRouter);

// ── PANEL (frontend compilado) servido desde el mismo servicio ────────────────
const webDist = path.join(process.cwd(), "apps/web/dist");
app.use(express.static(webDist));

// Rutas de API/auth desconocidas → 404 JSON. Cualquier otra → index.html (SPA).
app.use((req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path === "/health") {
    res.status(404).json({ error: "Ruta no encontrada" });
    return;
  }
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, async () => {
  console.log(`🚀 SEO Agency API corriendo en puerto ${PORT}`);
  console.log(`   Health:  https://seo.bruda.io/health`);
  console.log(`   Stores:  https://seo.bruda.io/api/stores`);
  await runMigrations();
  await seedAdmin();
  startScheduler();
});

// Crea el admin inicial si no existe. Usa ADMIN_EMAIL + (ADMIN_PASSWORD o AGENCY_PASSWORD).
async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || "admin@bruda.io").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.env.AGENCY_PASSWORD;
  try {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return;
    if (!password) {
      console.log("⚠️  No hay admin y falta ADMIN_PASSWORD/AGENCY_PASSWORD — no se creó el admin.");
      return;
    }
    await db.insert(users).values({
      id: crypto.randomUUID(), email, password_hash: hashPassword(password), role: "admin", name: "Agencia",
    });
    console.log(`✅ Admin creado: ${email}`);
  } catch (err: any) {
    console.error("seedAdmin:", err.message);
  }
}

export default app;
