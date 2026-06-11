import { Router, Request, Response } from "express";
import { db, products_cache, seo_versions } from "@seo/db";
import { eq } from "drizzle-orm";
import { generateSEO } from "../services/claude.js";
import { applyVersion, previewVersion } from "../services/apply.js";

const router = Router();

// ── GENERAR SEO PARA UN PRODUCTO ──────────────────────────────────────────────
router.post("/api/stores/:storeId/products/:productId/generate", async (req: Request, res: Response) => {
  try {
    const { storeId, productId } = req.params;
    const { api_key } = req.body || {};

    console.log(`Generando SEO para producto ${productId}...`);
    const result = await generateSEO(productId, storeId, api_key);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── APLICAR (APROBAR) UNA VERSIÓN ─────────────────────────────────────────────
// Escribe la versión generada de vuelta a Tienda Nube.
router.post("/api/stores/:storeId/versions/:versionId/apply", async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    const result = await applyVersion(versionId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true, message: "Cambios aplicados en Tienda Nube" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DRY-RUN: VER QUÉ SE ENVIARÍA A TIENDA NUBE ────────────────────────────────
router.get("/api/stores/:storeId/versions/:versionId/preview", async (req: Request, res: Response) => {
  try {
    const result = await previewVersion(req.params.versionId);
    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── RECHAZAR UNA VERSIÓN ──────────────────────────────────────────────────────
router.post("/api/stores/:storeId/versions/:versionId/reject", async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    await db
      .update(seo_versions)
      .set({ status: "rejected" })
      .where(eq(seo_versions.id, versionId));
    res.json({ success: true, message: "Versión rechazada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── HISTORIAL DE VERSIONES ────────────────────────────────────────────────────
router.get("/api/stores/:storeId/products/:productId/versions", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const versions = await db
      .select()
      .from(seo_versions)
      .where(eq(seo_versions.product_id, productId));
    res.json({ data: versions, total: versions.length });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener versiones" });
  }
});

// ── DETALLE DE PRODUCTO ───────────────────────────────────────────────────────
router.get("/api/stores/:storeId/products/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await db.query.products_cache.findFirst({
      where: eq(products_cache.id, productId),
    });
    if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    res.json({ data: product });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

export default router;
