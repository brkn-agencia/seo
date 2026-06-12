import express from "express";
import cors from "cors";
import path from "path";
import authRouter from "./routes/auth.js";
import storesRouter from "./routes/stores.js";
import seoRouter from "./routes/seo.js";
import jobsRouter from "./routes/jobs.js";
import metricsRouter from "./routes/metrics.js";
import { startScheduler } from "./services/scheduler.js";

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

// ── PROTECCIÓN DE AGENCIA (Basic Auth) ────────────────────────────────────────
// Una sola contraseña protege panel + API. Se excluyen los endpoints de OAuth
// (vienen redirigidos desde Tienda Nube) y el health check. Si no se configura
// AGENCY_PASSWORD, no bloquea nada (para no dejarte afuera antes de setearla).
const AGENCY_PASSWORD = process.env.AGENCY_PASSWORD;
const OPEN_PATHS = ["/health", "/auth/install", "/auth/callback"];

app.use((req, res, next) => {
  if (!AGENCY_PASSWORD || OPEN_PATHS.includes(req.path)) return next();

  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === AGENCY_PASSWORD) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Bruda SEO"');
  res.status(401).send("Autenticación requerida");
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

app.listen(PORT, () => {
  console.log(`🚀 SEO Agency API corriendo en puerto ${PORT}`);
  console.log(`   Health:  https://seo.bruda.io/health`);
  console.log(`   Stores:  https://seo.bruda.io/api/stores`);
  startScheduler();
});

export default app;
