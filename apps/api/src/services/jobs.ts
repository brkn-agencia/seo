import { db, jobs, products_cache } from "@seo/db";
import { and, eq, lte } from "drizzle-orm";
import crypto from "crypto";
import { generateSEO } from "./claude.js";
import { applyVersion } from "./apply.js";

export type JobType = "bulk_generate" | "bulk_apply";

export interface RunOptions {
  // Solo procesar productos con score <= este umbral (default 70).
  scoreThreshold?: number;
  // Aplicar automáticamente cada versión generada (modo "auto").
  autoApply?: boolean;
  // Límite de productos por corrida (para controlar costo). 0 = sin límite.
  limit?: number;
}

/**
 * Lanza un job de optimización masiva para una tienda. Devuelve el id del job
 * inmediatamente y procesa en segundo plano (fire-and-forget).
 */
export async function startBulkOptimization(
  storeId: string,
  opts: RunOptions = {}
): Promise<string> {
  const jobId = crypto.randomUUID();
  const threshold = opts.scoreThreshold ?? 70;

  const candidates = await db
    .select({ id: products_cache.id })
    .from(products_cache)
    .where(
      and(
        eq(products_cache.store_id, storeId),
        eq(products_cache.is_locked, false),
        lte(products_cache.seo_score, threshold)
      )
    );

  const targets = opts.limit && opts.limit > 0 ? candidates.slice(0, opts.limit) : candidates;

  await db.insert(jobs).values({
    id: jobId,
    store_id: storeId,
    type: opts.autoApply ? "bulk_apply" : "bulk_generate",
    status: "running",
    total: targets.length,
    started_at: new Date(),
  });

  // Procesamiento en segundo plano — no bloqueamos la respuesta HTTP.
  void runJob(jobId, storeId, targets.map((t) => t.id), opts);

  return jobId;
}

async function runJob(
  jobId: string,
  storeId: string,
  productIds: string[],
  opts: RunOptions
): Promise<void> {
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const errorLog: { product_id: string; error: string }[] = [];

  for (const productId of productIds) {
    try {
      const result = await generateSEO(productId, storeId);
      if (!result.success) {
        failed++;
        errorLog.push({ product_id: productId, error: result.error || "generate falló" });
      } else if (opts.autoApply && result.data?.version_id) {
        const applied = await applyVersion(result.data.version_id);
        if (applied.success) {
          processed++;
        } else {
          skipped++;
          errorLog.push({ product_id: productId, error: applied.error || "apply falló" });
        }
      } else {
        processed++;
      }
    } catch (err: any) {
      failed++;
      errorLog.push({ product_id: productId, error: err.message });
    }

    // Actualizamos progreso cada pocos productos para no saturar la DB.
    if ((processed + failed + skipped) % 5 === 0) {
      await db
        .update(jobs)
        .set({ processed, failed, skipped, error_log: errorLog })
        .where(eq(jobs.id, jobId));
    }
  }

  await db
    .update(jobs)
    .set({
      status: "done",
      processed,
      failed,
      skipped,
      error_log: errorLog,
      finished_at: new Date(),
    })
    .where(eq(jobs.id, jobId));
}
