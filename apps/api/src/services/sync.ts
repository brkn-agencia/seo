import axios from "axios";
import { db, stores, products_cache } from "@seo/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const TN_CLIENT_ID = process.env.TN_CLIENT_ID!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString();
}

function tnText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") {
    try { const p = JSON.parse(field); return p?.es || p?.en || Object.values(p)[0] as string || ""; }
    catch { return field; }
  }
  if (typeof field === "object") return field?.es || field?.en || Object.values(field)[0] as string || "";
  return String(field);
}

function calcScore(p: any): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const name        = tnText(p.name);
  const seoTitle    = tnText(p.seo_title);
  const seoDesc     = tnText(p.seo_description);
  const handle      = tnText(p.handle);
  const description = tnText(p.description);
  const variants    = p.variants || [];
  const images      = p.images || [];

  // Nombre del producto (5 pts)
  if (!name || name.length < 10) { issues.push("Nombre del producto muy corto"); score -= 5; }

  // SEO Title (25 pts)
  if (!seoTitle) { issues.push("Sin SEO title"); score -= 25; }
  else if (seoTitle.length < 20) { issues.push("SEO title muy corto (menos de 20 chars)"); score -= 12; }
  else if (seoTitle.length > 60) { issues.push("SEO title muy largo (más de 60 chars)"); score -= 8; }

  // Meta description (20 pts)
  if (!seoDesc) { issues.push("Sin meta description"); score -= 20; }
  else if (seoDesc.length < 50) { issues.push("Meta description muy corta"); score -= 10; }
  else if (seoDesc.length > 160) { issues.push("Meta description muy larga"); score -= 5; }

  // Handle (10 pts)
  if (!handle) { issues.push("Sin URL handle"); score -= 10; }
  else if (/\d{4,}/.test(handle)) { issues.push("URL con código numérico interno"); score -= 8; }

  // Descripción (20 pts)
  if (!description || description.length < 50) { issues.push("Sin descripción del producto"); score -= 20; }
  else if (description.length < 150) { issues.push("Descripción muy corta (menos de 150 chars)"); score -= 8; }

  // Imágenes (10 pts)
  if (!images.length) { issues.push("Sin imágenes"); score -= 10; }
  else if (images.length < 2) { issues.push("Solo una imagen — recomendado 3+"); score -= 5; }

  // Variantes con nombre descriptivo (10 pts)
  if (variants.length > 1) {
    const hasNames = variants.some((v: any) =>
      v.values?.some((val: any) => tnText(val) || val.es || val.name)
    );
    if (!hasNames) { issues.push("Variantes sin nombre descriptivo"); score -= 10; }
  }

  return { score: Math.max(0, score), issues };
}

export async function syncStore(storeId: string): Promise<{ synced: number; errors: number }> {
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store?.tn_access_token_enc || !store?.tn_store_id) throw new Error("Tienda sin token");

  const accessToken = decrypt(store.tn_access_token_enc);
  const headers = {
    Authentication: `bearer ${accessToken}`,
    "User-Agent": `Bruda SEO App (${TN_CLIENT_ID})`,
  };

  let page = 1, synced = 0, errors = 0, hasMore = true;

  while (hasMore) {
    const res = await axios.get(
      `https://api.tiendanube.com/v1/${store.tn_store_id}/products`,
      { headers, params: { page, per_page: 50 } }
    );
    const products = res.data;
    if (!products?.length) { hasMore = false; break; }

    for (const p of products) {
      try {
        const { score, issues } = calcScore(p);
        const productId = `${storeId}_${p.id}`;
        await db.insert(products_cache).values({
          id: productId, store_id: storeId, tn_product_id: String(p.id),
          name: tnText(p.name), description: tnText(p.description),
          seo_title: tnText(p.seo_title), seo_description: tnText(p.seo_description),
          handle: tnText(p.handle), brand: p.brand || "",
          variants: p.variants || [], images: p.images || [],
          seo_score: score, seo_issues: issues, last_analyzed_at: new Date(),
        }).onConflictDoUpdate({
          target: products_cache.id,
          set: {
            name: tnText(p.name), description: tnText(p.description),
            seo_title: tnText(p.seo_title), seo_description: tnText(p.seo_description),
            handle: tnText(p.handle), brand: p.brand || "",
            variants: p.variants || [], images: p.images || [],
            seo_score: score, seo_issues: issues,
            last_analyzed_at: new Date(), updated_at: new Date(),
          },
        });
        synced++;
      } catch (err: any) { console.error(`Error ${p.id}:`, err.message); errors++; }
    }
    if (products.length < 50) hasMore = false; else page++;
  }

  await db.update(stores).set({ last_sync_at: new Date() }).where(eq(stores.id, storeId));
  return { synced, errors };
}
