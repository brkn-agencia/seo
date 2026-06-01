import cron from "node-cron";
import { db, stores } from "@seo/db";
import { syncStore } from "./sync.js";
import { startBulkOptimization } from "./jobs.js";

/**
 * Corre una pasada de automatización sobre todas las tiendas, respetando el
 * automation_mode de cada una:
 *   - "manual":  no hace nada automático (solo acciones desde la UI).
 *   - "suggest": sincroniza y genera sugerencias (quedan en estado "pending").
 *   - "auto":    sincroniza, genera y aplica los cambios en Tienda Nube.
 */
export async function runAutomationPass(): Promise<void> {
  const allStores = await db.select().from(stores);

  for (const store of allStores) {
    const mode = store.automation_mode || "manual";
    if (mode === "manual") continue;
    if (!store.tn_access_token_enc || !store.tn_store_id) continue;

    try {
      console.log(`⏳ [auto] Sincronizando ${store.name} (${mode})...`);
      await syncStore(store.id);

      const jobId = await startBulkOptimization(store.id, {
        scoreThreshold: 70,
        autoApply: mode === "auto",
      });
      console.log(`✅ [auto] ${store.name}: job ${jobId} lanzado (autoApply=${mode === "auto"})`);
    } catch (err: any) {
      console.error(`❌ [auto] ${store.name}:`, err.message);
    }
  }
}

/**
 * Programa la pasada de automatización. Por defecto, todos los días a las 03:00.
 * Sobreescribible con la env var AUTOMATION_CRON.
 */
export function startScheduler(): void {
  const schedule = process.env.AUTOMATION_CRON || "0 3 * * *";

  if (!cron.validate(schedule)) {
    console.error(`⚠️  AUTOMATION_CRON inválido ("${schedule}") — scheduler no iniciado`);
    return;
  }

  cron.schedule(schedule, () => {
    console.log("🕒 [auto] Iniciando pasada de automatización...");
    runAutomationPass().catch((err) => console.error("[auto] pasada falló:", err));
  });

  console.log(`🗓️  Scheduler activo (cron: "${schedule}")`);
}
