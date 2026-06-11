import { db, stores, product_sales } from "@seo/db";
import { eq } from "drizzle-orm";
import { tnClient } from "../lib/tn.js";

// Solo consideramos órdenes de los últimos N días para reflejar popularidad actual.
const WINDOW_DAYS = 90;

/**
 * Sincroniza las órdenes recientes de una tienda y agrega las unidades vendidas
 * por producto en la tabla product_sales. Se usa para priorizar la optimización
 * SEO por popularidad real (los que más venden y peor SEO tienen = mayor pérdida).
 */
export async function syncOrders(storeId: string): Promise<{ products: number; orders: number }> {
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store?.tn_access_token_enc || !store?.tn_store_id) throw new Error("Tienda sin token");

  const client = tnClient(store.tn_store_id, store.tn_access_token_enc);
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();

  // Acumulado por tn_product_id.
  const agg = new Map<string, { units: number; orders: number; last: Date | null }>();

  let page = 1, orders = 0, hasMore = true;
  while (hasMore) {
    const res = await client.get(`/orders`, {
      params: { page, per_page: 50, created_at_min: since, fields: "id,created_at,products" },
    });
    const batch = res.data;
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const order of batch) {
      orders++;
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      for (const line of order.products || []) {
        const pid = String(line.product_id ?? "");
        if (!pid) continue;
        const qty = Number(line.quantity) || 0;
        const e = agg.get(pid) || { units: 0, orders: 0, last: null };
        e.units += qty;
        e.orders += 1;
        if (createdAt && (!e.last || createdAt > e.last)) e.last = createdAt;
        agg.set(pid, e);
      }
    }
    if (batch.length < 50) hasMore = false; else page++;
  }

  // Upsert de cada producto agregado.
  for (const [tnProductId, e] of agg) {
    const id = `${storeId}_${tnProductId}`;
    await db
      .insert(product_sales)
      .values({
        id, store_id: storeId, tn_product_id: tnProductId,
        units_sold: e.units, orders_count: e.orders, last_order_at: e.last, updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: product_sales.id,
        set: { units_sold: e.units, orders_count: e.orders, last_order_at: e.last, updated_at: new Date() },
      });
  }

  return { products: agg.size, orders };
}
