import { Router, Request, Response } from "express";
import { db, stores, products_cache } from "@seo/db";
import { eq, desc, asc } from "drizzle-orm";
import { syncStore } from "../services/sync.js";

const router = Router();

// ── LISTAR TIENDAS ────────────────────────────────────────────────────────────
router.get("/api/stores", async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(stores).orderBy(asc(stores.created_at));
    res.json({ data: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tiendas" });
  }
});

// ── DETALLE DE TIENDA ─────────────────────────────────────────────────────────
router.get("/api/stores/:storeId", async (req: Request, res: Response) => {
  try {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, req.params.storeId),
    });
    if (!store) { res.status(404).json({ error: "Tienda no encontrada" }); return; }
    res.json({ data: store });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tienda" });
  }
});

// ── SYNC DE PRODUCTOS ─────────────────────────────────────────────────────────
router.post("/api/stores/:storeId/sync", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    console.log(`Iniciando sync para tienda ${storeId}...`);
    const result = await syncStore(storeId);
    res.json({
      success: true,
      message: `Sync completado`,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error("Sync error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PRODUCTOS DE LA TIENDA ────────────────────────────────────────────────────
router.get("/api/stores/:storeId/products", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { order = "score_asc" } = req.query;

    const orderBy = order === "score_asc"
      ? asc(products_cache.seo_score)
      : order === "score_desc"
      ? desc(products_cache.seo_score)
      : desc(products_cache.created_at);

    const products = await db
      .select({
        id: products_cache.id,
        tn_product_id: products_cache.tn_product_id,
        name: products_cache.name,
        seo_title: products_cache.seo_title,
        seo_description: products_cache.seo_description,
        handle: products_cache.handle,
        brand: products_cache.brand,
        seo_score: products_cache.seo_score,
        seo_issues: products_cache.seo_issues,
        is_locked: products_cache.is_locked,
        last_analyzed_at: products_cache.last_analyzed_at,
      })
      .from(products_cache)
      .where(eq(products_cache.store_id, storeId))
      .orderBy(orderBy);

    const avgScore = products.length
      ? Math.round(products.reduce((a, p) => a + (p.seo_score || 0), 0) / products.length)
      : 0;

    const critical = products.filter(p => (p.seo_score || 0) < 30).length;

    res.json({
      data: products,
      total: products.length,
      avg_score: avgScore,
      critical,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

export default router;
