import { db, products_cache, seo_versions, stores } from "@seo/db";
import { eq } from "drizzle-orm";
import { tnClient, tnLocalized } from "../lib/tn.js";

export type ApplyResult = { success: boolean; error?: string };

export interface ApplyPlan {
  // Body del PUT al producto (campos en formato localizado de Tienda Nube).
  productPayload: Record<string, any>;
  // Updates de alt text, uno por imagen: PUT /products/:id/images/:imgId { alt: [...] }
  imageUpdates: { id: string; alt: string }[];
}

/**
 * Construye —sin efectos secundarios— el plan exacto de lo que se escribiría en
 * Tienda Nube a partir del `after` de una versión. Compartido por applyVersion
 * (escribe) y previewVersion (dry-run), para que nunca se desincronicen.
 */
export function buildApplyPlan(after: Record<string, any>): ApplyPlan {
  const productPayload: Record<string, any> = {};
  if (after.seo_title) productPayload.seo_title = tnLocalized(after.seo_title);
  if (after.seo_description) productPayload.seo_description = tnLocalized(after.seo_description);
  if (after.handle) productPayload.handle = tnLocalized(after.handle);
  if (after.description) productPayload.description = tnLocalized(after.description);
  // Marca sugerida por el mejorador de ficha (campo plano en TN).
  if (after.ficha?.brand) productPayload.brand = after.ficha.brand;

  const imageUpdates = Array.isArray(after.images_alt)
    ? after.images_alt
        .filter((img: any) => img?.id && img?.alt)
        .map((img: any) => ({ id: String(img.id), alt: String(img.alt) }))
    : [];

  return { productPayload, imageUpdates };
}

/**
 * Dry-run: devuelve exactamente lo que se enviaría a Tienda Nube para una versión,
 * sin escribir nada. Útil para validar el formato antes de activar el modo auto.
 */
export async function previewVersion(
  versionId: string
): Promise<{ success: boolean; error?: string; plan?: ApplyPlan; tn_product_id?: string }> {
  const version = await db.query.seo_versions.findFirst({
    where: eq(seo_versions.id, versionId),
  });
  if (!version) return { success: false, error: "Versión no encontrada" };

  const product = await db.query.products_cache.findFirst({
    where: eq(products_cache.id, version.product_id),
  });
  if (!product) return { success: false, error: "Producto no encontrado" };

  return {
    success: true,
    tn_product_id: product.tn_product_id,
    plan: buildApplyPlan(version.after as Record<string, any>),
  };
}

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
    const { productPayload, imageUpdates } = buildApplyPlan(after);

    // ── Campos de producto ──────────────────────────────────────────────────
    if (Object.keys(productPayload).length > 0) {
      await client.put(`/products/${product.tn_product_id}`, productPayload);
    }

    // ── Alt text de imágenes (opcional) ───────────────────────────────────────
    if (imageUpdates.length > 0) {
      for (const img of imageUpdates) {
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
