import express from "express";
import cors from "cors";

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
  });
});

// ── STORES ────────────────────────────────────────────────────────────────────
app.get("/api/stores", async (req, res) => {
  try {
    const { db, stores } = await import("@seo/db");
    const result = await db.select().from(stores);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tiendas" });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`🚀 SEO Agency API corriendo en puerto ${PORT}`);
});

export default app;
