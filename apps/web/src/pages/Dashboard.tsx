import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  getStores, syncStore, getMe, getUsers, createUser, resetUserPassword, deleteUser, clearToken,
} from "../api";

function UsersPanel({ stores }: { stores: any[] }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () => createUser(email.trim(), name.trim(), storeId),
    onSuccess: (res: any) => {
      setCreated({ email: res.user.email, password: res.password });
      setEmail(""); setName(""); setStoreId("");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => alert("Error: " + (err.response?.data?.error || err.message)),
  });
  const reset = useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
    onSuccess: (res: any) => setCreated({ email: "(contraseña nueva)", password: res.password }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const clients = (data?.data || []).filter((u: any) => u.role === "client");
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name || id;

  return (
    <div style={up.wrap}>
      <div style={up.title}>Accesos de clientes</div>

      <div style={up.form}>
        <input style={up.input} placeholder="Email del cliente" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={up.input} placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
        <select style={up.input} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">Asignar tienda...</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button style={up.btn} onClick={() => create.mutate()} disabled={create.isPending || !email || !storeId}>
          {create.isPending ? "Creando..." : "Crear acceso"}
        </button>
      </div>

      {created && (
        <div style={up.created}>
          ✅ Acceso para <b>{created.email}</b> — contraseña: <code style={up.code}>{created.password}</code>
          <span style={{ color: "#888", marginLeft: 8 }}>(guardala y pasásela al cliente; no se vuelve a mostrar)</span>
        </div>
      )}

      <div style={up.list}>
        {clients.length === 0 && <div style={{ fontSize: 12, color: "#888", padding: "8px 0" }}>Sin clientes todavía.</div>}
        {clients.map((u: any) => (
          <div key={u.id} style={up.row}>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{u.email}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{u.name || "—"}</div>
            </div>
            <div style={{ flex: 2, fontSize: 12, color: "#666" }}>
              {u.store_ids?.length ? u.store_ids.map(storeName).join(", ") : "Sin tienda"}
            </div>
            <button style={up.linkBtn} onClick={() => reset.mutate(u.id)}>Resetear contraseña</button>
            <button style={{ ...up.linkBtn, color: "#A32D2D" }} onClick={() => { if (confirm("¿Eliminar este acceso?")) del.mutate(u.id); }}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const up: Record<string, React.CSSProperties> = {
  wrap: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "16px", margin: "0 24px 24px" },
  title: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 },
  form: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  input: { flex: 1, minWidth: 140, fontSize: 13, padding: "7px 10px", border: "1px solid #E5E3DB", borderRadius: 6, background: "white" },
  btn: { fontSize: 13, padding: "7px 14px", background: "#534AB7", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
  created: { fontSize: 13, color: "#0F6E56", background: "#E1F5EE", border: "1px solid #9FE1CB", borderRadius: 6, padding: "10px 12px", marginBottom: 10 },
  code: { background: "white", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", fontWeight: 600 },
  list: { display: "flex", flexDirection: "column" },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #F1EFE8" },
  linkBtn: { fontSize: 12, padding: "5px 8px", background: "white", color: "#534AB7", border: "1px solid #E5E3DB", borderRadius: 6, cursor: "pointer" },
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

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["stores"], queryFn: getStores });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const isAdmin = me?.role === "admin";
  const logout = () => { clearToken(); navigate("/login"); };

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
          {isAdmin && (
            <div style={styles.navItem} onClick={() => window.open("https://seo.bruda.io/auth/install", "_blank")}>
              ➕ Conectar tienda
            </div>
          )}
        </nav>
        <div style={{ marginTop: "auto", padding: "0 8px" }}>
          <div style={{ fontSize: 11, color: "#888", padding: "8px 12px" }}>{me?.email}</div>
          <div style={styles.navItem} onClick={logout}>↩ Cerrar sesión</div>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>Resumen general</div>
            <div style={styles.pageSub}>{stores.length} tiendas conectadas</div>
          </div>
          {isAdmin && (
            <button
              style={styles.btnPrimary}
              onClick={() => window.open("https://seo.bruda.io/auth/install", "_blank")}
            >
              + Agregar tienda
            </button>
          )}
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

        {isAdmin && <UsersPanel stores={stores} />}
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
