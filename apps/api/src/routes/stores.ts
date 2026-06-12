import { Router, Request, Response } from "express";
import { db, stores, products_cache, product_ops } from "@seo/db";
import { eq, desc, asc } from "drizzle-orm";
import { syncStore } from "../services/sync.js";
import { syncOrders } from "../services/orders.js";
import { encrypt, tnClient, tnLocalized } from "../lib/tn.js";
import { storeIdsForUser, type AuthedRequest } from "../lib/auth.js";
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

// ── LISTAR TIENDAS (scope por usuario) ────────────────────────────────────────
router.get("/api/stores", async (req: AuthedRequest, res: Response) => {
  try {
    const result = await db.select().from(stores).orderBy(asc(stores.created_at));
    const allowed = req.user ? await storeIdsForUser(req.user) : "all";
    const scoped = allowed === "all" ? result : result.filter((s) => allowed.includes(s.id));
    res.json({ data: scoped.map(publicStore), total: scoped.length });
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

// ── EDITAR MARCA DE UN PRODUCTO ───────────────────────────────────────────────
router.patch("/api/stores/:storeId/products/:productId/brand", async (req: Request, res: Response) => {
  try {
    const { storeId, productId } = req.params;
    const { brand } = req.body || {};
    if (typeof brand !== "string") { res.status(400).json({ error: "Marca inválida" }); return; }

    const product = await db.query.products_cache.findFirst({ where: eq(products_cache.id, productId) });
    if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }

    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store?.tn_access_token_enc || !store?.tn_store_id) {
      res.status(400).json({ error: "Tienda sin token" }); return;
    }

    const client = tnClient(store.tn_store_id, store.tn_access_token_enc);
    await client.put(`/products/${product.tn_product_id}`, { brand });
    await db.update(products_cache).set({ brand, updated_at: new Date() }).where(eq(products_cache.id, productId));

    res.json({ success: true, brand });
  } catch (err: any) {
    console.error("Brand update error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
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
    // Filtros: order, q (búsqueda), visibility (all|visible|hidden), stock (all|in|out), category
    const {
      order = "score_asc", q = "", visibility = "all", stock = "all", category = "",
    } = req.query as Record<string, string>;

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
        variants: products_cache.variants,
        seo_score: products_cache.seo_score,
        seo_issues: products_cache.seo_issues,
        is_locked: products_cache.is_locked,
        last_analyzed_at: products_cache.last_analyzed_at,
      })
      .from(products_cache)
      .where(eq(products_cache.store_id, storeId))
      .orderBy(orderBy);

    // Stock calculado desde las variantes (funciona aunque falte product_ops).
    const stockOf = (variants: any): number | null => {
      const vs = Array.isArray(variants) ? variants : [];
      if (!vs.length) return null;
      const stocks = vs.map((v: any) => v.stock);
      const anyInfinite = stocks.some((s: any) => s === null || s === undefined);
      return anyInfinite ? null : stocks.reduce((a: number, s: any) => a + (Number(s) || 0), 0);
    };

    // Estado operativo (tabla separada; si no existe aún, degrada).
    const opsMap = new Map<string, { published: boolean; categories: string[]; ficha_score: number; ficha_missing: string[] }>();
    let opsSynced = false;
    try {
      const ops = await db.select().from(product_ops).where(eq(product_ops.store_id, storeId));
      for (const o of ops) opsMap.set(o.tn_product_id, {
        published: o.published ?? true, categories: (o.categories as string[]) || [],
        ficha_score: o.ficha_score ?? 0, ficha_missing: (o.ficha_missing as string[]) || [],
      });
      opsSynced = ops.length > 0;
    } catch { /* product_ops sin migrar */ }

    const enriched = rows.map((p) => {
      const o = opsMap.get(p.tn_product_id);
      const st = stockOf(p.variants);
      const published = o ? o.published : true;
      const hasStock = st === null || st > 0;
      const { variants, ...rest } = p; // no mandamos las variantes crudas al cliente
      return {
        ...rest, published, stock: st, has_stock: hasStock,
        categories: o?.categories || [],
        ficha_score: o?.ficha_score ?? null, ficha_missing: o?.ficha_missing || [],
      };
    });

    // Categorías disponibles para el selector de filtros.
    const categories = [...new Set(enriched.flatMap((p) => p.categories))].sort();

    let data = enriched;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      data = data.filter((p) => (p.name || "").toLowerCase().includes(needle));
    }
    if (visibility === "visible") data = data.filter((p) => p.published);
    else if (visibility === "hidden") data = data.filter((p) => !p.published);
    if (stock === "in") data = data.filter((p) => p.has_stock);
    else if (stock === "out") data = data.filter((p) => !p.has_stock);
    if (category) data = data.filter((p) => p.categories.includes(category));

    const visibleInStock = enriched.filter((p) => p.published && p.has_stock);
    const avgScore = visibleInStock.length
      ? Math.round(visibleInStock.reduce((a, p) => a + (p.seo_score || 0), 0) / visibleInStock.length)
      : 0;
    const critical = visibleInStock.filter((p) => (p.seo_score || 0) < 30).length;

    res.json({
      data,
      total: data.length,
      total_catalog: enriched.length,
      operative_count: visibleInStock.length,
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
