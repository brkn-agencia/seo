import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import storesRouter from "./routes/stores.js";
import seoRouter from "./routes/seo.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`🚀 SEO Agency API corriendo en puerto ${PORT}`);
  console.log(`   Health:  https://seo.bruda.io/health`);
  console.log(`   Stores:  https://seo.bruda.io/api/stores`);
  console.log(`   Generate: POST /api/stores/:id/products/:id/generate`);
});

export default app;
