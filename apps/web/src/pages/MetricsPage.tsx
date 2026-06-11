import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getStore, getMetrics } from "../api";

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardVal, color: color || "#2C2C2A" }}>{value}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  );
}

const SUGG_COLORS: Record<string, string> = {
  quick_win: "#534AB7", critical: "#E24B4A", finish: "#BA7517", healthy: "#1D9E75",
};

export default function MetricsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const { data: storeData } = useQuery({ queryKey: ["store", storeId], queryFn: () => getStore(storeId!) });
  const { data, isLoading } = useQuery({ queryKey: ["metrics", storeId], queryFn: () => getMetrics(storeId!) });

  const store = storeData?.data;
  const m = data?.data;

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoIcon}>B</div>
          <div><div style={s.logoText}>Bruda SEO</div><div style={s.logoSub}>centro de control</div></div>
        </div>
        <div style={s.navBack} onClick={() => navigate(`/stores/${storeId}`)}>← Productos</div>
        <nav style={s.nav}>
          <div style={{ ...s.navItem, ...s.navActive }}>📈 Métricas</div>
        </nav>
      </div>

      <div style={s.main}>
        <div style={s.topbar}>
          <div>
            <div style={s.pageTitle}>{store?.name || "..."} — Métricas</div>
            <div style={s.pageSub}>Impacto de la optimización SEO con IA</div>
          </div>
        </div>

        {isLoading || !m ? (
          <div style={s.empty}>Calculando métricas...</div>
        ) : (
          <div style={{ padding: "16px 24px" }}>
            {/* KPIs principales */}
            <div style={s.metrics}>
              <Card
                label="Optimización del sitio"
                value={`${m.seo.optimization_pct}%`}
                sub={`${m.seo.optimized} de ${m.seo.total} productos óptimos`}
                color={m.seo.optimization_pct >= 70 ? "#1D9E75" : m.seo.optimization_pct >= 40 ? "#BA7517" : "#E24B4A"}
              />
              <Card
                label="Score promedio"
                value={`${m.seo.avg_score}`}
                sub="de 100"
                color={m.seo.avg_score >= 70 ? "#1D9E75" : m.seo.avg_score >= 40 ? "#BA7517" : "#E24B4A"}
              />
              <Card
                label="Horas de trabajo ahorradas"
                value={`${m.time_saved.hours} h`}
                sub={`${m.time_saved.products_optimized} productos × ${m.time_saved.minutes_per_product} min`}
                color="#1D9E75"
              />
              <Card
                label="Costo IA este mes"
                value={`$${m.ai_cost.this_month_usd}`}
                sub={`$${m.ai_cost.total_usd} acumulado`}
              />
            </div>

            {/* Distribución del catálogo */}
            <div style={s.sectionTitle}>Estado del catálogo</div>
            <div style={s.panel}>
              <div style={s.distBar}>
                {(["excellent", "good", "poor"] as const).map((k) => {
                  const val = m.seo.distribution[k];
                  const pct = m.seo.total ? (val / m.seo.total) * 100 : 0;
                  const color = k === "excellent" ? "#1D9E75" : k === "good" ? "#BA7517" : "#E24B4A";
                  return pct > 0 ? <div key={k} style={{ width: `${pct}%`, background: color, height: "100%" }} title={`${val}`} /> : null;
                })}
              </div>
              <div style={s.legend}>
                <span><span style={{ ...s.dot, background: "#1D9E75" }} />Óptimos (80+): <b>{m.seo.distribution.excellent}</b></span>
                <span><span style={{ ...s.dot, background: "#BA7517" }} />Mejorables (50-79): <b>{m.seo.distribution.good}</b></span>
                <span><span style={{ ...s.dot, background: "#E24B4A" }} />Pobres (&lt;50): <b>{m.seo.distribution.poor}</b></span>
              </div>
            </div>

            {/* Sugerencias */}
            {m.suggestions.length > 0 && (
              <>
                <div style={s.sectionTitle}>Recomendaciones</div>
                <div style={s.suggGrid}>
                  {m.suggestions.map((sg: any, i: number) => (
                    <div key={i} style={{ ...s.sugg, borderLeft: `3px solid ${SUGG_COLORS[sg.type] || "#888"}` }}>
                      <div style={s.suggTitle}>{sg.title}</div>
                      <div style={s.suggDetail}>{sg.detail}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Costos por modelo */}
            <div style={s.sectionTitle}>Consumo de IA</div>
            <div style={s.panel}>
              <div style={s.row}><span>Versiones generadas</span><b>{m.ai_cost.versions_generated}</b></div>
              <div style={s.row}><span>Aplicadas en la tienda</span><b>{m.ai_cost.applied}</b></div>
              <div style={s.row}><span>Tokens consumidos</span><b>{m.ai_cost.total_tokens.toLocaleString()}</b></div>
              <div style={s.row}><span>Costo promedio por producto</span><b>${m.ai_cost.avg_cost_per_product}</b></div>
              {m.ai_cost.by_model.map((bm: any) => (
                <div key={bm.model} style={s.row}><span style={{ color: "#888" }}>· {bm.model}</span><span style={{ color: "#888" }}>{bm.versions} versiones · ${bm.cost_usd}</span></div>
              ))}
            </div>

            {/* Alertas prioritarias */}
            <div style={s.sectionTitle}>
              Productos prioritarios pendientes
              <span style={s.note}> · ordenados por severidad SEO (ranking por ventas/visitas próximamente)</span>
            </div>
            <div style={s.table}>
              {m.priority_alerts.length === 0 && <div style={s.empty}>No hay productos pendientes 🎉</div>}
              {m.priority_alerts.map((p: any) => (
                <div key={p.id} style={s.tableRow} onClick={() => navigate(`/stores/${storeId}/products/${encodeURIComponent(p.id)}`)}>
                  <div style={{ flex: 3 }}>
                    <div style={s.pName}>{p.name}</div>
                    <div style={s.pHandle}>{p.handle || "Sin URL"}</div>
                  </div>
                  <div style={{ width: 90, color: p.seo_score < 30 ? "#E24B4A" : "#BA7517", fontWeight: 600 }}>Score {p.seo_score}</div>
                  <div style={{ width: 90, fontSize: 12, color: "#888" }}>{p.issues} issues</div>
                  <div style={{ width: 60 }}><button style={s.btnSm}>Ver →</button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#FAFAF8" },
  sidebar: { width: 220, background: "#F1EFE8", borderRight: "1px solid #E5E3DB", display: "flex", flexDirection: "column", padding: "16px 0" },
  logo: { display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px", borderBottom: "1px solid #E5E3DB", marginBottom: 8 },
  logoIcon: { width: 32, height: 32, background: "#534AB7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16 },
  logoText: { fontSize: 14, fontWeight: 600, color: "#2C2C2A" },
  logoSub: { fontSize: 11, color: "#888" },
  navBack: { padding: "6px 16px 12px", fontSize: 12, color: "#888", cursor: "pointer", borderBottom: "1px solid #E5E3DB", marginBottom: 8 },
  nav: { display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" },
  navItem: { padding: "8px 12px", fontSize: 13, color: "#666", borderRadius: 6, cursor: "pointer" },
  navActive: { background: "white", color: "#2C2C2A", fontWeight: 500 },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  topbar: { padding: "16px 24px", borderBottom: "1px solid #E5E3DB", background: "white" },
  pageTitle: { fontSize: 16, fontWeight: 600, color: "#2C2C2A" },
  pageSub: { fontSize: 12, color: "#888", marginTop: 2 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 8 },
  card: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "14px 16px" },
  cardLabel: { fontSize: 11, color: "#888", marginBottom: 6 },
  cardVal: { fontSize: 26, fontWeight: 600, lineHeight: 1 },
  cardSub: { fontSize: 10, color: "#aaa", marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "20px 0 10px" },
  note: { textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "#bbb" },
  panel: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "16px" },
  distBar: { display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#E5E3DB", marginBottom: 12 },
  legend: { display: "flex", gap: 18, fontSize: 12, color: "#666" },
  dot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 6 },
  suggGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  sugg: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "12px 14px" },
  suggTitle: { fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 },
  suggDetail: { fontSize: 12, color: "#666", lineHeight: 1.5 },
  row: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#444", padding: "6px 0", borderBottom: "1px solid #F1EFE8" },
  table: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, overflow: "hidden" },
  tableRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1EFE8", cursor: "pointer" },
  pName: { fontSize: 13, fontWeight: 500, color: "#2C2C2A" },
  pHandle: { fontSize: 11, color: "#aaa", marginTop: 2 },
  btnSm: { fontSize: 12, padding: "5px 10px", background: "#EEEDFE", color: "#534AB7", border: "1px solid #AFA9EC", borderRadius: 6, cursor: "pointer" },
  empty: { padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#888" },
};
