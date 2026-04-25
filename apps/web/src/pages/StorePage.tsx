import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getStore, getProducts, syncStore } from "../api";

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

function IssuePill({ count }: { count: number }) {
  if (count === 0) return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>OK</span>;
  if (count <= 2) return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FAEEDA", color: "#854F0B", fontWeight: 500 }}>{count} issues</span>;
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FCEBEB", color: "#A32D2D", fontWeight: 500 }}>{count} issues</span>;
}

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: storeData } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => getStore(storeId!),
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => getProducts(storeId!, "score_asc"),
  });

  const sync = useMutation({
    mutationFn: () => syncStore(storeId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", storeId] }),
  });

  const store = storeData?.data;
  const products = productsData?.data || [];
  const avgScore = productsData?.avg_score || 0;
  const critical = productsData?.critical || 0;

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
        <div style={styles.navBack} onClick={() => navigate("/")}>← Volver</div>
        <nav style={styles.nav}>
          <div style={{ ...styles.navItem, ...styles.navActive }}>📦 Productos</div>
        </nav>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>{store?.name || "Cargando..."}</div>
            <div style={styles.pageSub}>{store?.url} · {products.length} productos</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btn} onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? "Sincronizando..." : "Sincronizar"}
            </button>
          </div>
        </div>

        <div style={styles.metrics}>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Score promedio</div>
            <div style={{ ...styles.metricVal, color: avgScore >= 70 ? "#1D9E75" : avgScore >= 40 ? "#BA7517" : "#E24B4A" }}>{avgScore}</div>
            <div style={styles.metricSub}>de 100</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Total productos</div>
            <div style={styles.metricVal}>{products.length}</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Críticos</div>
            <div style={{ ...styles.metricVal, color: "#E24B4A" }}>{critical}</div>
            <div style={styles.metricSub}>score menor a 30</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricLabel}>Optimizados</div>
            <div style={{ ...styles.metricVal, color: "#1D9E75" }}>
              {products.filter((p: any) => p.seo_score >= 80).length}
            </div>
            <div style={styles.metricSub}>score 80+</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Productos — ordenados por score (peores primero)</div>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 3 }}>Producto</span>
              <span style={{ flex: 1 }}>Score SEO</span>
              <span style={{ flex: 1 }}>Issues</span>
              <span style={{ width: 80 }}></span>
            </div>
            {isLoading && <div style={styles.empty}>Cargando productos...</div>}
            {products.map((p: any) => (
              <div
                key={p.id}
                style={styles.tableRow}
                onClick={() => navigate(`/stores/${storeId}/products/${encodeURIComponent(p.id)}`)}
              >
                <div style={{ flex: 3 }}>
                  <div style={styles.productName}>{p.name}</div>
                  <div style={styles.productHandle}>{p.handle || "Sin URL"}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <ScoreBar score={p.seo_score || 0} />
                </div>
                <div style={{ flex: 1 }}>
                  <IssuePill count={(p.seo_issues as string[])?.length || 0} />
                </div>
                <div style={{ width: 80 }}>
                  <button style={styles.btnSm}>Ver →</button>
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
  navBack: { padding: "6px 16px 12px", fontSize: 12, color: "#888", cursor: "pointer", borderBottom: "1px solid #E5E3DB", marginBottom: 8 },
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
  metricVal: { fontSize: 24, fontWeight: 600, color: "#2C2C2A", lineHeight: 1 },
  metricSub: { fontSize: 10, color: "#aaa", marginTop: 3 },
  section: { padding: "0 24px 24px" },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 },
  table: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, overflow: "hidden" },
  tableHeader: { display: "flex", alignItems: "center", padding: "8px 16px", background: "#F8F7F4", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #E5E3DB" },
  tableRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1EFE8", cursor: "pointer", transition: "background 0.1s" },
  productName: { fontSize: 13, fontWeight: 500, color: "#2C2C2A" },
  productHandle: { fontSize: 11, color: "#aaa", marginTop: 2 },
  empty: { padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#888" },
  btn: { fontSize: 13, padding: "7px 14px", background: "white", color: "#444", border: "1px solid #E5E3DB", borderRadius: 6, cursor: "pointer" },
  btnSm: { fontSize: 12, padding: "5px 10px", background: "#EEEDFE", color: "#534AB7", border: "1px solid #AFA9EC", borderRadius: 6, cursor: "pointer" },
};
