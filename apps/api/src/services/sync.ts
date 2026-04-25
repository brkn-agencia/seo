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
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString();
}

// Tienda Nube devuelve campos multiidioma como objeto {es: "valor"} o null
function tnText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      return parsed?.es || parsed?.en || Object.values(parsed)[0] || "";
    } catch {
      return field;
    }
  }
  if (typeof field === "object") {
    return field?.es || field?.en || Object.values(field)[0] || "";
  }
  return String(field);
}

function calcScore(p: any): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const seoTitle   = tnText(p.seo_title);
  const seoDesc    = tnText(p.seo_description);
  const handle     = tnText(p.handle);
  const description = tnText(p.description);
  const variants   = p.variants || [];

  // SEO Title (30 pts)
  if (!seoTitle) {
    issues.push("Sin SEO title"); score -= 30;
  } else if (seoTitle.length < 20) {
    issues.push("SEO title muy corto (menos de 20 chars)"); score -= 15;
  } else if (seoTitle.length > 60) {
    issues.push("SEO title muy largo (más de 60 chars)"); score -= 10;
  }

  // Meta description (25 pts)
  if (!seoDesc) {
    issues.push("Sin meta description"); score -= 25;
  } else if (seoDesc.length < 50) {
    issues.push("Meta description muy corta (menos de 50 chars)"); score -= 12;
  } else if (seoDesc.length > 160) {
    issues.push("Meta description muy larga (más de 160 chars)"); score -= 5;
  }

  // Handle/URL (10 pts)
  if (!handle) {
    issues.push("Sin URL handle"); score -= 10;
  } else if (/\d{4,}/.test(handle)) {
    issues.push("URL con código numérico interno"); score -= 8;
  }

  // Descripción (20 pts)
  if (!description || description.length < 50) {
    issues.push("Sin descripción del producto"); score -= 20;
  }

  // Variantes (5 pts)
  if (variants.length > 1) {
    const hasColorNames = variants.some((v: any) =>
      v.values?.some((val: any) => tnText(val) || val.es || val.name)
    );
    if (!hasColorNames) {
      issues.push("Variantes sin nombre descriptivo"); score -= 5;
    }
  }

  return { score: Math.max(0, score), issues };
}

export async function syncStore(storeId: string): Promise<{ synced: number; errors: number }> {
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
  });

  if (!store?.tn_access_token_enc || !store?.tn_store_id) {
    throw new Error("Tienda no encontrada o sin token");
  }

  const accessToken = decrypt(store.tn_access_token_enc);
  const tnStoreId = store.tn_store_id;
  const headers = {
    Authentication: `bearer ${accessToken}`,
    "User-Agent": `Bruda SEO App (${TN_CLIENT_ID})`,
  };

  let page = 1;
  let synced = 0;
  let errors = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await axios.get(
      `https://api.tiendanube.com/v1/${tnStoreId}/products`,
      { headers, params: { page, per_page: 50 } }
    );

    const products = res.data;
    if (!products?.length) { hasMore = false; break; }

    for (const p of products) {
      try {
        const { score, issues } = calcScore(p);
        const productId = `${storeId}_${p.id}`;

        await db.insert(products_cache).values({
          id: productId,
          store_id: storeId,
          tn_product_id: String(p.id),
          name: tnText(p.name),
          description: tnText(p.description),
          seo_title: tnText(p.seo_title),
          seo_description: tnText(p.seo_description),
          handle: tnText(p.handle),
          brand: p.brand || "",
          variants: p.variants || [],
          images: p.images || [],
          seo_score: score,
          seo_issues: issues,
          last_analyzed_at: new Date(),
        }).onConflictDoUpdate({
          target: products_cache.id,
          set: {
            name: tnText(p.name),
            description: tnText(p.description),
            seo_title: tnText(p.seo_title),
            seo_description: tnText(p.seo_description),
            handle: tnText(p.handle),
            brand: p.brand || "",
            variants: p.variants || [],
            images: p.images || [],
            seo_score: score,
            seo_issues: issues,
            last_analyzed_at: new Date(),
            updated_at: new Date(),
          },
        });
        synced++;
      } catch (err: any) {
        console.error(`Error producto ${p.id}:`, err.message);
        errors++;
      }
    }

    if (products.length < 50) hasMore = false;
    else page++;
  }

  await db.update(stores).set({ last_sync_at: new Date() }).where(eq(stores.id, storeId));
  return { synced, errors };
}
