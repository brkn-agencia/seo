import { Router, Request, Response } from "express";
import { computeMetrics } from "../services/metrics.js";

const router = Router();

// ── MÉTRICAS DE LA TIENDA (vista cliente) ─────────────────────────────────────
router.get("/api/stores/:storeId/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = await computeMetrics(req.params.storeId);
    res.json({ data: metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
