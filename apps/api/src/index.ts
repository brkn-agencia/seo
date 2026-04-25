import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import storesRouter from "./routes/stores.js";
import seoRouter from "./routes/seo.js";

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
});

export default app;
