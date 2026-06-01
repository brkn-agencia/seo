import { Router, Request, Response } from "express";
import { db, jobs, stores } from "@seo/db";
import { eq, desc } from "drizzle-orm";
import { startBulkOptimization } from "../services/jobs.js";

const router = Router();

// ── LANZAR OPTIMIZACIÓN MASIVA ────────────────────────────────────────────────
router.post("/api/stores/:storeId/optimize", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { scoreThreshold, autoApply, limit } = req.body || {};

    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store) { res.status(404).json({ error: "Tienda no encontrada" }); return; }

    // Si no se especifica autoApply, lo derivamos del modo de la tienda.
    const resolvedAutoApply =
      typeof autoApply === "boolean" ? autoApply : store.automation_mode === "auto";

    const jobId = await startBulkOptimization(storeId, {
      scoreThreshold,
      autoApply: resolvedAutoApply,
      limit,
    });

    res.json({ success: true, job_id: jobId, auto_apply: resolvedAutoApply });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ESTADO DE UN JOB ──────────────────────────────────────────────────────────
router.get("/api/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, req.params.jobId) });
    if (!job) { res.status(404).json({ error: "Job no encontrado" }); return; }
    res.json({ data: job });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── JOBS DE UNA TIENDA ────────────────────────────────────────────────────────
router.get("/api/stores/:storeId/jobs", async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.store_id, req.params.storeId))
      .orderBy(desc(jobs.created_at));
    res.json({ data: result, total: result.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
