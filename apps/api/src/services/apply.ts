import { db, products_cache, seo_versions, stores } from "@seo/db";
import { eq } from "drizzle-orm";
import { tnClient, tnLocalized } from "../lib/tn.js";

export type ApplyResult = { success: boolean; error?: string };

/**
 * Aplica una versión de SEO aprobada escribiendo los cambios de vuelta a Tienda Nube.
 * Actualiza el producto (title/meta/handle/description) y, si la versión trae
 * alt text de imágenes, también las parcha una por una.
 */
export async function applyVersion(versionId: string): Promise<ApplyResult> {
  try {
    const version = await db.query.seo_versions.findFirst({
      where: eq(seo_versions.id, versionId),
    });
    if (!version) return { success: false, error: "Versión no encontrada" };
    if (version.status === "applied")
      return { success: false, error: "Esta versión ya fue aplicada" };

    const product = await db.query.products_cache.findFirst({
      where: eq(products_cache.id, version.product_id),
    });
    if (!product) return { success: false, error: "Producto no encontrado" };
    if (product.is_locked)
      return { success: false, error: "Producto bloqueado — no se puede modificar" };

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, version.store_id),
    });
    if (!store?.tn_access_token_enc || !store?.tn_store_id)
      return { success: false, error: "Tienda sin token de acceso" };

    const after = version.after as Record<string, any>;
    const client = tnClient(store.tn_store_id, store.tn_access_token_enc);

    // ── Campos de producto ──────────────────────────────────────────────────
    const payload: Record<string, any> = {};
    if (after.seo_title) payload.seo_title = tnLocalized(after.seo_title);
    if (after.seo_description) payload.seo_description = tnLocalized(after.seo_description);
    if (after.handle) payload.handle = tnLocalized(after.handle);
    if (after.description) payload.description = tnLocalized(after.description);

    if (Object.keys(payload).length > 0) {
      await client.put(`/products/${product.tn_product_id}`, payload);
    }

    // ── Alt text de imágenes (opcional) ───────────────────────────────────────
    // after.images_alt = [{ id: "<image_id>", alt: "texto" }, ...]
    if (Array.isArray(after.images_alt)) {
      for (const img of after.images_alt) {
        if (!img?.id || !img?.alt) continue;
        try {
          await client.put(`/products/${product.tn_product_id}/images/${img.id}`, {
            alt: [img.alt],
          });
        } catch (err: any) {
          console.error(`Alt text falló (img ${img.id}):`, err.response?.data || err.message);
        }
      }
    }

    // ── Persistir estado local ────────────────────────────────────────────────
    await db
      .update(seo_versions)
      .set({ status: "applied", applied_at: new Date() })
      .where(eq(seo_versions.id, versionId));

    await db
      .update(products_cache)
      .set({
        seo_title: after.seo_title ?? product.seo_title,
        seo_description: after.seo_description ?? product.seo_description,
        handle: after.handle ?? product.handle,
        description: after.description ?? product.description,
        last_optimized_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(products_cache.id, product.id));

    return { success: true };
  } catch (err: any) {
    console.error("Apply error:", err.response?.data || err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
}
