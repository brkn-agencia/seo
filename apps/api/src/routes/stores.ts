import { Router, Request, Response } from "express";
import { db, stores, products_cache, product_ops } from "@seo/db";
import { eq, desc, asc } from "drizzle-orm";
import { syncStore } from "../services/sync.js";
import { syncOrders } from "../services/orders.js";
import { encrypt } from "../lib/tn.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Quita campos sensibles de una tienda antes de mandarla al frontend y agrega
// flags derivados (sin exponer nunca la API key encriptada).
function publicStore(store: any) {
  const { anthropic_api_key_enc, tn_access_token_enc, ...rest } = store;
  return {
    ...rest,
    has_anthropic_key: !!anthropic_api_key_enc,
    is_connected: !!tn_access_token_enc,
  };
}

// ── LISTAR TIENDAS ────────────────────────────────────────────────────────────
router.get("/api/stores", async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(stores).orderBy(asc(stores.created_at));
    res.json({ data: result.map(publicStore), total: result.length });
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
    res.json({ data: publicStore(store) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tienda" });
  }
});

// ── CARGAR / VERIFICAR API KEY DE ANTHROPIC (POR CLIENTE) ─────────────────────
// Cada tienda usa sus propios créditos de IA. Verificamos la key con un llamado
// gratuito (models.list) antes de guardarla encriptada.
router.put("/api/stores/:storeId/anthropic-key", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { api_key } = req.body || {};

    if (!api_key || typeof api_key !== "string" || !api_key.startsWith("sk-")) {
      res.status(400).json({ error: "API key inválida" });
      return;
    }

    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store) { res.status(404).json({ error: "Tienda no encontrada" }); return; }

    // Verificación sin gastar tokens.
    try {
      await new Anthropic({ apiKey: api_key }).models.list();
    } catch (err: any) {
      res.status(400).json({ error: "La API key no es válida o no tiene acceso", detail: err.message });
      return;
    }

    await db
      .update(stores)
      .set({
        anthropic_api_key_enc: encrypt(api_key),
        anthropic_key_verified_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(stores.id, storeId));

    res.json({ success: true, message: "API key verificada y guardada", verified_at: new Date() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── QUITAR API KEY ────────────────────────────────────────────────────────────
router.delete("/api/stores/:storeId/anthropic-key", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    await db
      .update(stores)
      .set({ anthropic_api_key_enc: null, anthropic_key_verified_at: null, updated_at: new Date() })
      .where(eq(stores.id, storeId));
    res.json({ success: true, message: "API key eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CONFIGURAR AUTOMATIZACIÓN / AJUSTES ───────────────────────────────────────
router.patch("/api/stores/:storeId/settings", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { automation_mode, preferred_model } = req.body || {};

    const valid = ["manual", "suggest", "auto"];
    if (automation_mode && !valid.includes(automation_mode)) {
      res.status(400).json({ error: `automation_mode inválido. Use: ${valid.join(", ")}` });
      return;
    }

    const updates: Record<string, any> = { updated_at: new Date() };
    if (automation_mode) updates.automation_mode = automation_mode;
    if (preferred_model) updates.preferred_model = preferred_model;

    await db.update(stores).set(updates).where(eq(stores.id, storeId));
    res.json({ success: true, message: "Ajustes actualizados" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// ── SYNC DE ÓRDENES (ventas por producto) ─────────────────────────────────────
router.post("/api/stores/:storeId/sync-orders", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const result = await syncOrders(storeId);
    res.json({ success: true, message: "Ventas actualizadas", ...result });
  } catch (err: any) {
    console.error("Sync orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PRODUCTOS DE LA TIENDA ────────────────────────────────────────────────────
router.get("/api/stores/:storeId/products", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // Filtros: order, status (all|operative|hidden|no_stock), category
    const { order = "score_asc", status = "all", category = "" } = req.query as Record<string, string>;

    const orderBy = order === "score_asc"
      ? asc(products_cache.seo_score)
      : order === "score_desc"
      ? desc(products_cache.seo_score)
      : desc(products_cache.created_at);

    const rows = await db
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

    // Estado operativo (tabla separada; si no existe aún, degrada sin filtros).
    const opsMap = new Map<string, { published: boolean; stock: number | null; categories: string[]; ficha_score: number; ficha_missing: string[] }>();
    try {
      const ops = await db.select().from(product_ops).where(eq(product_ops.store_id, storeId));
      for (const o of ops) opsMap.set(o.tn_product_id, {
        published: o.published ?? true, stock: o.stock, categories: (o.categories as string[]) || [],
        ficha_score: o.ficha_score ?? 0, ficha_missing: (o.ficha_missing as string[]) || [],
      });
    } catch { /* product_ops sin migrar */ }

    const enriched = rows.map((p) => {
      const o = opsMap.get(p.tn_product_id);
      const stock = o ? o.stock : null;
      const published = o ? o.published : true;
      const operative = published && (stock === null || (stock ?? 0) > 0);
      return {
        ...p, published, stock, categories: o?.categories || [], operative,
        ficha_score: o?.ficha_score ?? null, ficha_missing: o?.ficha_missing || [],
      };
    });

    // Categorías disponibles para el selector de filtros.
    const categories = [...new Set(enriched.flatMap((p) => p.categories))].sort();

    let data = enriched;
    if (status === "operative") data = data.filter((p) => p.operative);
    else if (status === "hidden") data = data.filter((p) => !p.published);
    else if (status === "no_stock") data = data.filter((p) => p.stock !== null && (p.stock ?? 0) <= 0);
    if (category) data = data.filter((p) => p.categories.includes(category));

    const operativeRows = enriched.filter((p) => p.operative);
    const avgScore = operativeRows.length
      ? Math.round(operativeRows.reduce((a, p) => a + (p.seo_score || 0), 0) / operativeRows.length)
      : 0;
    const critical = operativeRows.filter((p) => (p.seo_score || 0) < 30).length;

    res.json({
      data,
      total: data.length,
      total_catalog: enriched.length,
      operative_count: operativeRows.length,
      avg_score: avgScore,
      critical,
      categories,
      ops_synced: opsMap.size > 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

export default router;
