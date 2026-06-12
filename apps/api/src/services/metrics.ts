import { db, products_cache, seo_versions, product_sales, product_ops } from "@seo/db";
import { eq } from "drizzle-orm";

// Estimación de trabajo manual que evita cada producto optimizado por IA
// (investigar keyword + escribir title, meta, descripción y alts).
const MINUTES_PER_PRODUCT = 12;
// Costo por defecto de optimizar un producto cuando todavía no hay historial.
const DEFAULT_COST_PER_PRODUCT = 0.002;

export interface StoreMetrics {
  seo: {
    total: number; // SOLO productos operativos (visibles + con stock)
    total_catalog: number; // todo el catálogo
    excluded: number; // ocultos o sin stock (no cuentan para las stats)
    avg_score: number;
    optimized: number; // score >= 80
    optimization_pct: number; // % de productos operativos con score >= 80
    needs_work: number; // score < 70
    critical: number; // score < 30
    distribution: { excellent: number; good: number; poor: number };
  };
  ops_synced: boolean; // true si hay datos de stock/visibilidad sincronizados
  ai_cost: {
    total_usd: number;
    this_month_usd: number;
    total_tokens: number;
    versions_generated: number;
    applied: number;
    avg_cost_per_product: number;
    estimated_cost_to_finish_usd: number;
    by_model: { model: string; versions: number; cost_usd: number }[];
  };
  time_saved: {
    hours: number;
    minutes_per_product: number;
    products_optimized: number;
  };
  suggestions: { type: string; title: string; detail: string }[];
  // true si hay datos de ventas: las alertas se rankean por popularidad real.
  // false: ranking por severidad SEO (fallback).
  sales_synced: boolean;
  priority_alerts: {
    id: string;
    name: string;
    handle: string | null;
    seo_score: number;
    issues: number;
    units_sold: number;
  }[];
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export async function computeMetrics(storeId: string): Promise<StoreMetrics> {
  const products = await db
    .select()
    .from(products_cache)
    .where(eq(products_cache.store_id, storeId));

  const versions = await db
    .select()
    .from(seo_versions)
    .where(eq(seo_versions.store_id, storeId));

  // Ventas por producto (opcional): si la tabla aún no existe (sin db:push),
  // degradamos a ranking por severidad SEO.
  const salesByTnId = new Map<string, number>();
  let sales_synced = false;
  try {
    const sales = await db
      .select()
      .from(product_sales)
      .where(eq(product_sales.store_id, storeId));
    for (const s of sales) salesByTnId.set(s.tn_product_id, s.units_sold || 0);
    sales_synced = sales.length > 0;
  } catch {
    sales_synced = false;
  }

  // Estado operativo (opcional): visibilidad + stock. Si la tabla no existe,
  // tratamos todo como operativo (no falsea las stats hacia abajo).
  const opsByTnId = new Map<string, { published: boolean; stock: number | null }>();
  let ops_synced = false;
  try {
    const ops = await db
      .select()
      .from(product_ops)
      .where(eq(product_ops.store_id, storeId));
    for (const o of ops) opsByTnId.set(o.tn_product_id, { published: o.published ?? true, stock: o.stock });
    ops_synced = ops.length > 0;
  } catch {
    ops_synced = false;
  }

  // Operativo = visible en la web Y con stock (o sin control de stock).
  // Si no hay dato de ops para ese producto, se asume operativo.
  const isOperative = (p: any): boolean => {
    const o = opsByTnId.get(p.tn_product_id);
    if (!o) return true;
    const hasStock = o.stock === null || (o.stock ?? 0) > 0;
    return o.published && hasStock;
  };

  // ── SEO (solo productos operativos) ─────────────────────────────────────────
  const operative = products.filter(isOperative);
  const total = operative.length;
  const total_catalog = products.length;
  const excluded = total_catalog - total;
  const scores = operative.map((p) => p.seo_score || 0);
  const avg_score = total ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const optimized = scores.filter((s) => s >= 80).length;
  const needs_work = scores.filter((s) => s < 70).length;
  const critical = scores.filter((s) => s < 30).length;
  const distribution = {
    excellent: scores.filter((s) => s >= 80).length,
    good: scores.filter((s) => s >= 50 && s < 80).length,
    poor: scores.filter((s) => s < 50).length,
  };

  // ── COSTOS DE IA ─────────────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const total_usd = round(versions.reduce((a, v) => a + (v.cost_usd || 0), 0), 4);
  const this_month_usd = round(
    versions
      .filter((v) => v.created_at && new Date(v.created_at) >= monthStart)
      .reduce((a, v) => a + (v.cost_usd || 0), 0),
    4
  );
  const total_tokens = versions.reduce((a, v) => a + (v.tokens_used || 0), 0);
  const versions_generated = versions.length;
  const applied = versions.filter((v) => v.status === "applied").length;
  const avg_cost_per_product = versions_generated
    ? round(total_usd / versions_generated, 4)
    : DEFAULT_COST_PER_PRODUCT;

  // Pendientes = SOLO operativos sin optimizar (no tiene sentido priorizar
  // productos ocultos o sin stock).
  const pending = operative.filter((p) => !p.last_optimized_at && (p.seo_score || 0) < 70);
  const estimated_cost_to_finish_usd = round(pending.length * avg_cost_per_product, 4);

  const byModelMap = new Map<string, { versions: number; cost_usd: number }>();
  for (const v of versions) {
    const m = v.model_used || "desconocido";
    const e = byModelMap.get(m) || { versions: 0, cost_usd: 0 };
    e.versions++;
    e.cost_usd = round(e.cost_usd + (v.cost_usd || 0), 4);
    byModelMap.set(m, e);
  }
  const by_model = [...byModelMap.entries()].map(([model, e]) => ({ model, ...e }));

  // ── TIEMPO AHORRADO ──────────────────────────────────────────────────────────
  const hours = round((applied * MINUTES_PER_PRODUCT) / 60, 1);

  // ── ALERTAS PRIORITARIAS ──────────────────────────────────────────────────
  // Con datos de ventas: prioriza los que MÁS venden y peor SEO tienen (mayor
  // pérdida de oportunidad). Sin ventas: cae a severidad SEO (peor score primero).
  const priority_alerts = pending
    .map((p) => ({ p, units: salesByTnId.get(p.tn_product_id) || 0 }))
    .sort((a, b) =>
      sales_synced && b.units !== a.units
        ? b.units - a.units
        : (a.p.seo_score || 0) - (b.p.seo_score || 0)
    )
    .slice(0, 10)
    .map(({ p, units }) => ({
      id: p.id,
      name: p.name,
      handle: p.handle,
      seo_score: p.seo_score || 0,
      issues: ((p.seo_issues as string[]) || []).length,
      units_sold: units,
    }));

  // ── SUGERENCIAS AUTOMÁTICAS ──────────────────────────────────────────────────
  const suggestions: { type: string; title: string; detail: string }[] = [];

  // Quick wins: a un paso de un score excelente (solo operativos).
  const quickWins = operative.filter(
    (p) => !p.last_optimized_at && (p.seo_score || 0) >= 50 && (p.seo_score || 0) < 80
  ).length;
  if (quickWins > 0) {
    suggestions.push({
      type: "quick_win",
      title: `${quickWins} quick wins disponibles`,
      detail: `Productos con score 50-79 que pasarían a "óptimo" con una sola optimización. Bajo costo, alto impacto.`,
    });
  }
  if (critical > 0) {
    suggestions.push({
      type: "critical",
      title: `${critical} productos críticos`,
      detail: `Score por debajo de 30 — son los que más penalizan el SEO del sitio. Priorizá estos.`,
    });
  }
  if (pending.length > 0) {
    suggestions.push({
      type: "finish",
      title: `Optimizá lo pendiente por ~$${estimated_cost_to_finish_usd} USD`,
      detail: `Quedan ${pending.length} productos sin optimizar. Lanzá una optimización masiva para cerrarlos.`,
    });
  }
  // Alto valor: producto que vende y está sin optimizar (mayor pérdida).
  if (sales_synced) {
    const topPending = pending
      .map((p) => ({ p, units: salesByTnId.get(p.tn_product_id) || 0 }))
      .filter((x) => x.units > 0)
      .sort((a, b) => b.units - a.units)[0];
    if (topPending) {
      suggestions.push({
        type: "critical",
        title: `"${topPending.p.name}" vende y está sin optimizar`,
        detail: `${topPending.units} unidades vendidas (90 días) con score ${topPending.p.seo_score}. Optimizarlo es la mayor oportunidad de impacto.`,
      });
    }
  }
  if (total > 0 && optimization_pctOf(optimized, total) >= 90) {
    suggestions.push({
      type: "healthy",
      title: "Sitio en excelente estado",
      detail: `${optimization_pctOf(optimized, total)}% de los productos están óptimos. Mantené el modo automático para sostenerlo.`,
    });
  }

  return {
    seo: {
      total,
      total_catalog,
      excluded,
      avg_score,
      optimized,
      optimization_pct: optimization_pctOf(optimized, total),
      needs_work,
      critical,
      distribution,
    },
    ops_synced,
    ai_cost: {
      total_usd,
      this_month_usd,
      total_tokens,
      versions_generated,
      applied,
      avg_cost_per_product,
      estimated_cost_to_finish_usd,
      by_model,
    },
    time_saved: { hours, minutes_per_product: MINUTES_PER_PRODUCT, products_optimized: applied },
    suggestions,
    sales_synced,
    priority_alerts,
  };
}

function optimization_pctOf(optimized: number, total: number): number {
  return total ? Math.round((optimized / total) * 100) : 0;
}
