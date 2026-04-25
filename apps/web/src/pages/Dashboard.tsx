import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getStores, syncStore } from "../api";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#1D9E75" : score >= 40 ? "#BA7517" : "#E24B4A";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#E5E3DB", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["stores"], queryFn: getStores });

  const sync = useMutation({
    mutationFn: (storeId: string) => syncStore(storeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });

  if (isLoading) return (
    <div style={styles.loading}>
      <div style={styles.spinner} />
      <p style={{ color: "#888", marginTop: 12 }}>Cargando tiendas...</p>
    </div>
  );

  const stores = data?.data || [];

  return (
    <div style={styles.shell}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>B</div>
          <div>
            <div style={styles.logoText}>Bruda SEO</div>
            <div style={styles.logoSub}>centro de control</div>
          </div>
        </div>
        <nav style={styles.nav}>
          <div style={{ ...styles.navItem, ...styles.navActive }}>📊 Resumen</div>
          <div style={styles.navItem} onClick={() => window.open("https://seo.bruda.io/auth/install", "_blank")}>
            ➕ Conectar tienda
          </div>
        </nav>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>Resumen general</div>
            <div style={styles.pageSub}>{stores.length} tiendas conectadas</div>
          </div>
          <button
            style={styles.btnPrimary}
            onClick={() => window.open("https://seo.bruda.io/auth/install", "_blank")}
          >
            + Agregar tienda
          </button>
        </div>

        <div style={styles.metrics}>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Tiendas activas</div>
            <div style={styles.metricVal}>{stores.length}</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Productos totales</div>
            <div style={styles.metricVal}>—</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Score promedio</div>
            <div style={styles.metricVal}>—</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Optimizados hoy</div>
            <div style={styles.metricVal}>—</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Tiendas</div>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>Tienda</span>
              <span style={{ flex: 1 }}>Score SEO</span>
              <span style={{ flex: 1 }}>Última sync</span>
              <span style={{ flex: 1 }}>Modo</span>
              <span style={{ width: 140 }}>Acciones</span>
            </div>
            {stores.length === 0 && (
              <div style={styles.empty}>
                No hay tiendas conectadas.{" "}
                <span
                  style={{ color: "#534AB7", cursor: "pointer" }}
                  onClick={() => window.open("https://seo.bruda.io/auth/install", "_blank")}
                >
                  Conectar primera tienda →
                </span>
              </div>
            )}
            {stores.map((store: any) => (
              <div key={store.id} style={styles.tableRow}>
                <div style={{ flex: 2 }}>
                  <div style={styles.storeName}>{store.name}</div>
                  <div style={styles.storeUrl}>{store.url}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <ScoreBar score={45} />
                </div>
                <div style={{ flex: 1, fontSize: 12, color: "#888" }}>
                  {store.last_sync_at
                    ? new Date(store.last_sync_at).toLocaleDateString("es-AR")
                    : "Nunca"}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={styles.pill}>{store.automation_mode}</span>
                </div>
                <div style={{ width: 140, display: "flex", gap: 6 }}>
                  <button
                    style={styles.btnSm}
                    onClick={() => sync.mutate(store.id)}
                    disabled={sync.isPending}
                  >
                    {sync.isPending ? "..." : "Sync"}
                  </button>
                  <button
                    style={{ ...styles.btnSm, ...styles.btnSmPrimary }}
                    onClick={() => navigate(`/stores/${store.id}`)}
                  >
                    Ver →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#FAFAF8" },
  sidebar: { width: 220, background: "#F1EFE8", borderRight: "1px solid #E5E3DB", display: "flex", flexDirection: "column", padding: "16px 0" },
  logo: { display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px", borderBottom: "1px solid #E5E3DB", marginBottom: 8 },
  logoIcon: { width: 32, height: 32, background: "#534AB7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16 },
  logoText: { fontSize: 14, fontWeight: 600, color: "#2C2C2A" },
  logoSub: { fontSize: 11, color: "#888" },
  nav: { display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" },
  navItem: { padding: "8px 12px", fontSize: 13, color: "#666", borderRadius: 6, cursor: "pointer" },
  navActive: { background: "white", color: "#2C2C2A", fontWeight: 500 },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  topbar: { padding: "16px 24px", borderBottom: "1px solid #E5E3DB", display: "flex", alignItems: "center", justifyContent: "space-between", background: "white" },
  pageTitle: { fontSize: 16, fontWeight: 600, color: "#2C2C2A" },
  pageSub: { fontSize: 12, color: "#888", marginTop: 2 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "16px 24px" },
  metric: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "12px 16px" },
  metricLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  metricVal: { fontSize: 24, fontWeight: 600, color: "#2C2C2A" },
  section: { padding: "0 24px 24px" },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 },
  table: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, overflow: "hidden" },
  tableHeader: { display: "flex", alignItems: "center", padding: "8px 16px", background: "#F8F7F4", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #E5E3DB" },
  tableRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1EFE8", cursor: "default" },
  storeName: { fontSize: 14, fontWeight: 500, color: "#2C2C2A" },
  storeUrl: { fontSize: 11, color: "#888", marginTop: 2 },
  pill: { fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#EEEDFE", color: "#534AB7", fontWeight: 500 },
  empty: { padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#888" },
  btnPrimary: { fontSize: 13, padding: "8px 16px", background: "#534AB7", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
  btnSm: { fontSize: 12, padding: "5px 10px", background: "white", color: "#444", border: "1px solid #E5E3DB", borderRadius: 6, cursor: "pointer" },
  btnSmPrimary: { background: "#EEEDFE", color: "#534AB7", border: "1px solid #AFA9EC" },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" },
  spinner: { width: 32, height: 32, border: "3px solid #E5E3DB", borderTop: "3px solid #534AB7", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
