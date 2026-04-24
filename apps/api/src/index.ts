import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    service: "seo-agency-api",
    db: "neon-connected",
  });
});

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use("/", authRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`🚀 SEO Agency API corriendo en puerto ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   OAuth:  http://localhost:${PORT}/auth/install`);
});

export default app;
