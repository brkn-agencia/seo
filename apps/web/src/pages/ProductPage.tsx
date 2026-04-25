import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct, generateSEO, getVersions } from "../api";
import { useState } from "react";

export default function ProductPage() {
  const { storeId, productId: rawId } = useParams<{ storeId: string; productId: string }>();
  const productId = rawId ? decodeURIComponent(rawId) : "";
  console.log("productId:", productId, "rawId:", rawId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lastGenerated, setLastGenerated] = useState<any>(null);

  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(storeId!, productId),
  });

  const { data: versionsData } = useQuery({
    queryKey: ["versions", productId],
    queryFn: () => getVersions(storeId!, productId),
  });

  const generate = useMutation({
    mutationFn: () => generateSEO(storeId!, productId),
    onSuccess: (data) => {
      setLastGenerated(data.data);
      qc.invalidateQueries({ queryKey: ["versions", productId] });
    },
    onError: (err: any) => {
      console.error("Generate error:", err);
      alert("Error: " + (err.response?.data?.error || err.message));
    },
  });

  const product = productData?.data;
  const versions = versionsData?.data || [];
  const latest = lastGenerated || (versions.length > 0 ? versions[versions.length - 1] : null);

  if (isLoading) return <div style={styles.loading}>Cargando producto...</div>;

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
        <div style={styles.navBack} onClick={() => navigate(`/stores/${storeId}`)}>← Volver</div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>{product?.name}</div>
            <div style={styles.pageSub}>Score actual: <strong style={{ color: "#BA7517" }}>{product?.seo_score}/100</strong></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={styles.btnPrimary}
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? "⏳ Generando con Claude..." : "✨ Generar SEO con IA"}
            </button>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.col}>
            <div style={styles.colHead}>
              <span style={styles.colTitle}>Estado actual</span>
              <span style={{ ...styles.scoreBadge, background: "#FCEBEB", color: "#A32D2D" }}>
                Score {product?.seo_score}
              </span>
            </div>
            <div style={styles.colBody}>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>SEO Title</div>
                <div style={styles.fieldVal}>
                  {product?.seo_title || <span style={{ color: "#aaa", fontStyle: "italic" }}>Sin SEO title</span>}
                </div>
                <div style={styles.charCount}>{(product?.seo_title || "").length} caracteres</div>
              </div>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Meta Description</div>
                <div style={styles.fieldVal}>
                  {product?.seo_description || <span style={{ color: "#aaa", fontStyle: "italic" }}>Sin meta description</span>}
                </div>
                <div style={styles.charCount}>{(product?.seo_description || "").length} caracteres</div>
              </div>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>URL Handle</div>
                <div style={styles.fieldVal}>
                  {product?.handle || <span style={{ color: "#aaa", fontStyle: "italic" }}>Sin handle</span>}
                </div>
              </div>
              <div style={styles.divider} />
              <div style={styles.fieldLabel}>Issues detectados</div>
              {((product?.seo_issues as string[]) || []).map((issue, i) => (
                <div key={i} style={styles.issue}>
                  <span style={styles.issueDot} />
                  {issue}
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...styles.col, borderLeft: "1px solid #E5E3DB" }}>
            <div style={styles.colHead}>
              <span style={styles.colTitle}>Generado por IA</span>
              {latest && (
                <span style={{ ...styles.scoreBadge, background: "#E1F5EE", color: "#0F6E56" }}>
                  Score estimado 90+
                </span>
              )}
            </div>
            <div style={styles.colBody}>
              {!latest && !generate.isPending && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#2C2C2A", marginBottom: 6 }}>
                    Sin generación todavía
                  </div>
                  <div style={{ fontSize: 13, color: "#888" }}>
                    Hacé click en "Generar SEO con IA" para ver el resultado
                  </div>
                </div>
              )}
              {generate.isPending && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 14, color: "#534AB7", fontWeight: 500 }}>Claude está generando...</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Suele tardar 5-10 segundos</div>
                </div>
              )}
              {latest && !generate.isPending && (
                <>
                  <div style={styles.field}>
                    <div style={styles.fieldLabel}>SEO Title</div>
                    <div style={{ ...styles.fieldVal, ...styles.improved }}>{latest.after?.seo_title}</div>
                    <div style={{ ...styles.charCount, color: "#0F6E56" }}>{(latest.after?.seo_title || "").length} caracteres ✓</div>
                  </div>
                  <div style={styles.field}>
                    <div style={styles.fieldLabel}>Meta Description</div>
                    <div style={{ ...styles.fieldVal, ...styles.improved }}>{latest.after?.seo_description}</div>
                    <div style={{ ...styles.charCount, color: "#0F6E56" }}>{(latest.after?.seo_description || "").length} caracteres ✓</div>
                  </div>
                  <div style={styles.field}>
                    <div style={styles.fieldLabel}>URL Handle</div>
                    <div style={{ ...styles.fieldVal, ...styles.improved }}>{latest.after?.handle}</div>
                  </div>
                  <div style={styles.divider} />
                  <div style={styles.field}>
                    <div style={styles.fieldLabel}>Descripción generada</div>
                    <div style={{ ...styles.fieldVal, ...styles.improved, fontSize: 12 }}>{latest.after?.description}</div>
                  </div>
                  <div style={styles.costRow}>
                    <span>Modelo: <strong>{latest.model}</strong></span>
                    <span>Tokens: <strong>{latest.tokens_used}</strong></span>
                    <span>Costo: <strong>${latest.cost_usd?.toFixed(4)} USD</strong></span>
                  </div>
                </>
              )}
            </div>
            {latest && !generate.isPending && (
              <div style={styles.preview}>
                <div style={styles.previewLabel}>Preview Google</div>
                <div style={styles.googleCard}>
                  <div style={styles.googleUrl}>tutienda.com/{latest.after?.handle}</div>
                  <div style={styles.googleTitle}>{latest.after?.seo_title}</div>
                  <div style={styles.googleDesc}>{latest.after?.seo_description}</div>
                </div>
              </div>
            )}
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
  main: { flex: 1, display: "flex", flexDirection: "column" },
  topbar: { padding: "16px 24px", borderBottom: "1px solid #E5E3DB", display: "flex", alignItems: "center", justifyContent: "space-between", background: "white" },
  pageTitle: { fontSize: 15, fontWeight: 600, color: "#2C2C2A" },
  pageSub: { fontSize: 12, color: "#888", marginTop: 2 },
  body: { display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1 },
  col: { display: "flex", flexDirection: "column" },
  colHead: { padding: "12px 20px", background: "#F8F7F4", borderBottom: "1px solid #E5E3DB", display: "flex", alignItems: "center", justifyContent: "space-between" },
  colTitle: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  scoreBadge: { fontSize: 12, fontWeight: 500, padding: "2px 10px", borderRadius: 20 },
  colBody: { padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  fieldVal: { fontSize: 13, color: "#2C2C2A", lineHeight: 1.5, padding: "8px 10px", background: "#F8F7F4", borderRadius: 6, border: "1px solid #E5E3DB" },
  improved: { background: "#E1F5EE", border: "1px solid #9FE1CB", color: "#085041" },
  charCount: { fontSize: 10, color: "#aaa", textAlign: "right" as const },
  divider: { borderTop: "1px solid #E5E3DB", margin: "4px 0" },
  issue: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666", padding: "4px 0" },
  issueDot: { width: 6, height: 6, borderRadius: "50%", background: "#E24B4A", flexShrink: 0 },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" as const },
  costRow: { display: "flex", gap: 16, fontSize: 11, color: "#888", marginTop: 4 },
  preview: { padding: "12px 20px", borderTop: "1px solid #E5E3DB" },
  previewLabel: { fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 8 },
  googleCard: { background: "white", border: "1px solid #E5E3DB", borderRadius: 8, padding: "12px 16px" },
  googleUrl: { fontSize: 12, color: "#1D9E75", marginBottom: 3 },
  googleTitle: { fontSize: 16, color: "#185FA5", fontWeight: 500, marginBottom: 4 },
  googleDesc: { fontSize: 13, color: "#444", lineHeight: 1.5 },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 14, color: "#888" },
  btnPrimary: { fontSize: 13, padding: "8px 16px", background: "#534AB7", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
};
