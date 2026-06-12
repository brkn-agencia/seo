import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getStore, getProducts, syncStore,
  setAnthropicKey, deleteAnthropicKey, updateStoreSettings, optimizeStore,
} from "../api";

const MODE_LABELS: Record<string, string> = {
  manual: "Manual — solo acciones a mano",
  suggest: "Sugerir — genera y espera tu aprobación",
  auto: "Automático — genera y aplica solo",
};

function SettingsPanel({ storeId, store }: { storeId: string; store: any }) {
  const qc = useQueryClient();
  const [keyInput, setKeyInput] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["store", storeId] });

  const saveKey = useMutation({
    mutationFn: () => setAnthropicKey(storeId, keyInput.trim()),
    onSuccess: () => { setKeyInput(""); invalidate(); },
    onError: (err: any) => alert("Error: " + (err.response?.data?.error || err.message)),
  });
  const removeKey = useMutation({
    mutationFn: () => deleteAnthropicKey(storeId),
    onSuccess: invalidate,
  });
  const saveMode = useMutation({
    mutationFn: (mode: string) => updateStoreSettings(storeId, { automation_mode: mode as any }),
    onSuccess: invalidate,
  });
  const optimize = useMutation({
    mutationFn: () => optimizeStore(storeId, {}),
    onSuccess: (d: any) => alert(`Optimización lanzada (job ${d.job_id}). Aplica solo: ${d.auto_apply ? "sí" : "no"}.`),
    onError: (err: any) => alert("Error: " + (err.response?.data?.error || err.message)),
  });

  const hasKey = store?.has_anthropic_key;
  const mode = store?.automation_mode || "manual";

  return (
    <div style={panel.wrap}>
      {/* API key del cliente */}
      <div style={panel.card}>
        <div style={panel.cardTitle}>Créditos de IA del cliente</div>
        {hasKey ? (
          <div style={panel.row}>
            <span style={panel.ok}>✓ API key cargada</span>
            <span style={panel.muted}>
              {store.anthropic_key_verified_at
                ? `verificada ${new Date(store.anthropic_key_verified_at).toLocaleDateString()}`
                : ""}
            </span>
            <button style={panel.btnGhost} onClick={() => removeKey.mutate()} disabled={removeKey.isPending}>
              Quitar
            </button>
          </div>
        ) : (
          <div style={panel.row}>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={panel.input}
            />
            <button
              style={panel.btnPrimary}
              onClick={() => saveKey.mutate()}
              disabled={saveKey.isPending || !keyInput.trim()}
            >
              {saveKey.isPending ? "Verificando..." : "Guardar y verificar"}
            </button>
          </div>
        )}
        <div style={panel.hint}>
          Cada tienda consume sus propios créditos de Anthropic. Sin key cargada, la automatización no corre.
        </div>
      </div>

      {/* Modo de automatización */}
      <div style={panel.card}>
        <div style={panel.cardTitle}>Modo de automatización</div>
        <select
          value={mode}
          onChange={(e) => saveMode.mutate(e.target.value)}
          disabled={saveMode.isPending}
          style={panel.select}
        >
          {Object.entries(MODE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <button
          style={{ ...panel.btnPrimary, marginTop: 10, opacity: hasKey ? 1 : 0.5 }}
          onClick={() => optimize.mutate()}
          disabled={optimize.isPending || !hasKey}
        >
          {optimize.isPending ? "Lanzando..." : "Optimizar toda la tienda ahora"}
        </button>
      </div>
    </div>
  );
}

const panel: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 24px 16px" },
  card: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "14px 16px" },
  cardTitle: { fontSize: 12, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 },
  row: { display: "flex", alignItems: "center", gap: 8 },
  input: { flex: 1, fontSize: 13, padding: "7px 10px", border: "1px solid #E5E3DB", borderRadius: 6, fontFamily: "monospace" },
  select: { width: "100%", fontSize: 13, padding: "7px 10px", border: "1px solid #E5E3DB", borderRadius: 6, background: "white" },
  btnPrimary: { fontSize: 13, padding: "7px 14px", background: "#534AB7", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
  btnGhost: { fontSize: 12, padding: "5px 10px", background: "white", color: "#A32D2D", border: "1px solid #E5E3DB", borderRadius: 6, cursor: "pointer" },
  ok: { fontSize: 13, color: "#0F6E56", fontWeight: 500 },
  muted: { fontSize: 11, color: "#888", flex: 1 },
  hint: { fontSize: 11, color: "#aaa", marginTop: 8, lineHeight: 1.4 },
};

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

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", storeId, debouncedQ, visibility, stockFilter, category],
    queryFn: () => getProducts(storeId!, { q: debouncedQ, visibility, stock: stockFilter, category }),
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
          <div style={styles.navItem} onClick={() => navigate(`/stores/${storeId}/metrics`)}>📈 Métricas</div>
        </nav>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>{store?.name || "Cargando..."}</div>
            <div style={styles.pageSub}>{store?.url} · {productsData?.operative_count ?? 0} operativos de {productsData?.total_catalog ?? 0}</div>
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
            <div style={styles.metricLabel}>Operativos</div>
            <div style={styles.metricVal}>{productsData?.operative_count ?? 0}</div>
            <div style={styles.metricSub}>de {productsData?.total_catalog ?? 0} en catálogo</div>
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

        <SettingsPanel storeId={storeId!} store={store} />

        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Productos
            <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "#aaa", marginLeft: 8 }}>
              {productsData?.total ?? 0} resultados · {productsData?.total_catalog ?? 0} en catálogo
            </span>
          </div>

          {productsData && productsData.ops_synced === false && (
            <div style={styles.opsBanner}>
              ⚠️ Visibilidad y categorías todavía no sincronizadas. Corré <code>npm run db:push</code> y volvé a <b>Sincronizar</b> para activar los filtros de visible/oculto y categorías.
            </div>
          )}

          <div style={styles.filterRow}>
            <input
              placeholder="🔍 Buscar producto por nombre..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={styles.searchInput}
            />
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={styles.filterSelect}>
              <option value="all">Visibilidad: todas</option>
              <option value="visible">Visibles</option>
              <option value="hidden">Ocultos</option>
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={styles.filterSelect}>
              <option value="all">Stock: todos</option>
              <option value="in">Con stock</option>
              <option value="out">Sin stock</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.filterSelect}>
              <option value="">Todas las categorías</option>
              {(productsData?.categories || []).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 3 }}>Producto</span>
              <span style={{ width: 90 }}>Estado</span>
              <span style={{ width: 80 }}>Stock</span>
              <span style={{ flex: 1 }}>Score SEO</span>
              <span style={{ width: 90 }}>Issues</span>
              <span style={{ width: 70 }}></span>
            </div>
            {isLoading && <div style={styles.empty}>Cargando productos...</div>}
            {!isLoading && products.length === 0 && <div style={styles.empty}>Sin resultados para este filtro.</div>}
            {products.map((p: any) => (
              <div
                key={p.id}
                style={styles.tableRow}
                onClick={() => navigate(`/stores/${storeId}/products/${encodeURIComponent(p.id)}`)}
              >
                <div style={{ flex: 3, minWidth: 0 }}>
                  <div style={styles.productName}>{p.name}</div>
                  <div style={styles.productHandle}>
                    {p.brand ? `Marca: ${p.brand}` : "Sin marca"}
                    {p.categories?.length ? ` · ${p.categories.join(" · ")}` : ""}
                  </div>
                </div>
                <div style={{ width: 90 }}>
                  {p.published === false
                    ? <span style={styles.badgeHidden}>Oculto</span>
                    : <span style={styles.badgeVisible}>Visible</span>}
                </div>
                <div style={{ width: 80 }}>
                  {p.stock === null
                    ? <span style={styles.stockInfinite}>∞</span>
                    : p.stock > 0
                    ? <span style={styles.stockOk}>{p.stock}</span>
                    : <span style={styles.badgeNoStock}>0</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <ScoreBar score={p.seo_score || 0} />
                </div>
                <div style={{ width: 90 }}>
                  <IssuePill count={(p.seo_issues as string[])?.length || 0} />
                </div>
                <div style={{ width: 70 }}>
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
  productName: { fontSize: 13, fontWeight: 500, color: "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  productHandle: { fontSize: 11, color: "#aaa", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  filterRow: { display: "flex", gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13, padding: "7px 12px", border: "1px solid #E5E3DB", borderRadius: 6, background: "white" },
  filterSelect: { fontSize: 12, padding: "6px 8px", border: "1px solid #E5E3DB", borderRadius: 6, background: "white", color: "#444" },
  opsBanner: { fontSize: 12, color: "#854F0B", background: "#FAEEDA", border: "1px solid #FAC775", borderRadius: 6, padding: "8px 12px", marginBottom: 10 },
  badgeVisible: { fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 },
  badgeHidden: { fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#F1EFE8", color: "#888", fontWeight: 500 },
  badgeNoStock: { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#FCEBEB", color: "#A32D2D", fontWeight: 600 },
  stockOk: { fontSize: 13, fontWeight: 600, color: "#2C2C2A" },
  stockInfinite: { fontSize: 14, color: "#888" },
  empty: { padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#888" },
  btn: { fontSize: 13, padding: "7px 14px", background: "white", color: "#444", border: "1px solid #E5E3DB", borderRadius: 6, cursor: "pointer" },
  btnSm: { fontSize: 12, padding: "5px 10px", background: "#EEEDFE", color: "#534AB7", border: "1px solid #AFA9EC", borderRadius: 6, cursor: "pointer" },
};
