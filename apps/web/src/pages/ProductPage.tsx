import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct, generateSEO, getVersions } from "../api";
import { useState } from "react";

function Field({ label, before, after, status, onApply, chars }: {
  label: string; before: string; after: string;
  status: "applied"|"generated"|"pending"|"missing";
  onApply?: () => void; chars?: boolean;
}) {
  const [applied, setApplied] = useState(status === "applied");
  const statusColors = { applied:"#1D9E75", generated:"#534AB7", pending:"#BA7517", missing:"#E24B4A" };
  const pillLabels = { applied:"Aplicado", generated:"Listo para aplicar", pending:"Pendiente", missing:"Sin datos" };
  const pillBg = { applied:"#E1F5EE", generated:"#EEEDFE", pending:"#FAEEDA", missing:"#FCEBEB" };

  return (
    <div style={styles.fieldSection}>
      <div style={styles.fieldRow}>
        <div style={styles.fieldCol}>
          <div style={styles.fieldLabel}>
            <span style={{...styles.dot, background: statusColors[status]}}/>
            {label} — Antes
          </div>
          <div style={{...styles.fieldVal, ...(before ? {} : styles.empty)}}>
            {before || `Sin ${label.toLowerCase()}`}
          </div>
          {chars && <div style={styles.charCount}>{before.length} caracteres</div>}
        </div>
        <div style={styles.fieldCol}>
          <div style={styles.fieldLabel}>
            <span style={{...styles.dot, background: statusColors[applied ? "applied" : status]}}/>
            {label} — Generado por IA
            <span style={{...styles.pill, background: pillBg[applied ? "applied" : status], color: statusColors[applied ? "applied" : status]}}>
              {applied ? "Aplicado" : pillLabels[status]}
            </span>
          </div>
          <div style={{...styles.fieldVal, ...(applied ? styles.fieldApplied : styles.fieldImproved)}}>
            {after || <span style={styles.emptyText}>Sin generar todavía</span>}
          </div>
          {chars && after && <div style={{...styles.charCount, color: after.length <= 160 ? "#0F6E56" : "#BA7517"}}>{after.length} caracteres {after.length <= 160 ? "✓" : "⚠"}</div>}
          {after && !applied && onApply && (
            <div style={styles.fieldActions}>
              <button style={styles.btnApply} onClick={() => { onApply(); setApplied(true); }}>
                Aplicar en tienda
              </button>
            </div>
          )}
          {applied && (
            <div style={styles.fieldActions}>
              <span style={{fontSize:12, color:"#1D9E75"}}>✓ Aplicado en tienda</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { storeId, productId: rawId } = useParams<{ storeId: string; productId: string }>();
  const productId = rawId ? decodeURIComponent(rawId) : "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [generated, setGenerated] = useState<any>(null);

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
      setGenerated(data.data);
      qc.invalidateQueries({ queryKey: ["versions", productId] });
    },
    onError: (err: any) => {
      alert("Error: " + (err.response?.data?.error || err.message));
    },
  });

  const product = productData?.data;
  const versions = versionsData?.data || [];
  const latest = generated || (versions.length > 0 ? versions[versions.length - 1] : null);
  const after = latest?.after || {};
  const before = latest?.before || {};

  if (isLoading) return <div style={styles.loading}>Cargando producto...</div>;

  const scoreColor = (product?.seo_score || 0) >= 70 ? "#1D9E75" : (product?.seo_score || 0) >= 40 ? "#BA7517" : "#E24B4A";

  return (
    <div style={styles.shell}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>B</div>
          <div><div style={styles.logoText}>Bruda SEO</div><div style={styles.logoSub}>centro de control</div></div>
        </div>
        <div style={styles.navBack} onClick={() => navigate(`/stores/${storeId}`)}>← Volver</div>
        <div style={{padding:"12px 16px"}}>
          <div style={{fontSize:11,color:"#888",marginBottom:6}}>Issues detectados</div>
          {((product?.seo_issues as string[]) || []).map((issue, i) => (
            <div key={i} style={styles.issue}><span style={styles.issueDot}/>{issue}</div>
          ))}
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>{product?.name}</div>
            <div style={styles.pageSub}>
              Score: <strong style={{color: scoreColor}}>{product?.seo_score}/100</strong>
              {latest && <span style={{marginLeft:12,color:"#888"}}>· Modelo: {latest.model} · Costo: ${latest.cost_usd?.toFixed(4)} USD {latest.web_data_found ? "· 🌐 Datos web encontrados" : ""}</span>}
            </div>
          </div>
          <button style={styles.btnPrimary} onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "⏳ Generando..." : "✨ Generar SEO completo"}
          </button>
        </div>

        {generate.isPending && (
          <div style={styles.generating}>
            <div style={{fontSize:24,marginBottom:8}}>⏳</div>
            <div style={{fontSize:14,fontWeight:500,color:"#534AB7"}}>Claude está analizando el producto...</div>
            <div style={{fontSize:12,color:"#888",marginTop:4}}>Buscando datos del fabricante en la web · Generando SEO completo</div>
          </div>
        )}

        {!generate.isPending && (
          <div style={styles.fieldsWrap}>

            <div style={styles.sectionTitle}>Identificación del producto</div>
            <Field label="Nombre del producto" before={product?.name || ""} after={after.product_name || ""} status={after.product_name ? "generated" : "missing"} onApply={() => console.log("apply name")} />

            <div style={styles.sectionTitle}>SEO — búsqueda en Google e IA</div>
            <Field label="SEO Title" before={product?.seo_title || ""} after={after.seo_title || ""} status={after.seo_title ? "generated" : "missing"} onApply={() => console.log("apply title")} chars />
            <Field label="Meta Description" before={product?.seo_description || ""} after={after.seo_description || ""} status={after.seo_description ? "generated" : "missing"} onApply={() => console.log("apply desc")} chars />
            <Field label="URL Handle" before={product?.handle || ""} after={after.handle || ""} status={after.handle ? "generated" : "missing"} onApply={() => console.log("apply handle")} />

            <div style={styles.sectionTitle}>Contenido del producto</div>
            <Field label="Descripción" before={product?.description || ""} after={after.description || ""} status={after.description ? "generated" : "missing"} onApply={() => console.log("apply description")} />

            {after.composition && (
              <div style={styles.compositionBox}>
                <span style={{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>Composición detectada</span>
                <span style={{fontSize:13,color:"#2C2C2A",marginLeft:10}}>{after.composition}</span>
                <span style={{fontSize:10,color:"#BA7517",marginLeft:8}}>⚠ Confirmar con proveedor</span>
              </div>
            )}

            {after.size_table && (
              <>
                <div style={styles.sectionTitle}>Tabla de talles</div>
                <div style={styles.tableWrap}>
                  <table style={styles.sizeTable}>
                    <thead>
                      <tr style={{background:"#534AB7"}}>
                        {["Talle","Bajo busto","Contorno","Cadera","Equiv."].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {after.size_table.map((row: any, i: number) => (
                        <tr key={i} style={{background: i%2===0 ? "white" : "#F8F7F4"}}>
                          <td style={styles.td}>{row.talle}</td>
                          <td style={styles.td}>{row.bajo_busto}</td>
                          <td style={styles.td}>{row.contorno_busto}</td>
                          <td style={styles.td}>{row.cadera}</td>
                          <td style={styles.td}>{row.equivalencia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={styles.tableActions}>
                    <span style={{fontSize:11,color:"#BA7517"}}>⚠ Verificar con proveedor antes de aplicar</span>
                    <button style={styles.btnApply} onClick={() => console.log("apply size table")}>Aplicar tabla en descripción</button>
                  </div>
                </div>
              </>
            )}

            {after.color_variants?.length > 0 && (
              <>
                <div style={styles.sectionTitle}>Variantes de color</div>
                <div style={styles.colorsWrap}>
                  {after.color_variants.map((color: any, i: number) => (
                    <div key={i} style={styles.colorRow}>
                      <div style={{...styles.colorSwatch, background: color.hex, border: color.hex === "#FFFFFF" ? "1px solid #ccc" : "none"}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:"#2C2C2A"}}>{color.name}</div>
                        <div style={{fontSize:11,color:"#888"}}>{color.description}</div>
                      </div>
                      <div style={{fontSize:11,color:"#888",minWidth:60,textAlign:"right" as const}}>
                        <span style={{color: color.confidence >= 80 ? "#0F6E56" : "#BA7517",fontWeight:500}}>{color.confidence}%</span> confianza
                      </div>
                      <span style={{...styles.pill, background: color.confidence >= 80 ? "#E1F5EE" : "#FAEEDA", color: color.confidence >= 80 ? "#0F6E56" : "#854F0B", marginLeft:8}}>
                        {color.confidence >= 80 ? "Verificado" : "Validar"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {after.seo_title && (
              <>
                <div style={styles.sectionTitle}>Preview</div>
                <div style={styles.previewGrid}>
                  <div>
                    <div style={styles.previewLabel}>Google</div>
                    <div style={styles.googleCard}>
                      <div style={styles.googleUrl}>tienda.com/{after.handle}</div>
                      <div style={styles.googleTitle}>{after.seo_title}</div>
                      <div style={styles.googleDesc}>{after.seo_description}</div>
                    </div>
                  </div>
                  <div>
                    <div style={styles.previewLabel}>Respuesta de IA</div>
                    <div style={{...styles.googleCard, background:"#F8F7FF",border:"1px solid #AFA9EC"}}>
                      <div style={{fontSize:11,fontStyle:"italic",color:"#888",marginBottom:6}}>
                        "¿{after.seo_title?.toLowerCase().replace(/ \|.*/, "")} recomendás?"
                      </div>
                      <div style={{fontSize:12,color:"#2C2C2A",lineHeight:1.5}}>
                        Una buena opción es <strong style={{color:"#3C3489"}}>{after.product_name || after.seo_title}</strong> — {after.seo_description}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell:{display:"flex",minHeight:"100vh",fontFamily:"system-ui,sans-serif",background:"#FAFAF8"},
  sidebar:{width:220,background:"#F1EFE8",borderRight:"1px solid #E5E3DB",display:"flex",flexDirection:"column",padding:"16px 0"},
  logo:{display:"flex",alignItems:"center",gap:10,padding:"0 16px 16px",borderBottom:"1px solid #E5E3DB",marginBottom:8},
  logoIcon:{width:32,height:32,background:"#534AB7",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:16},
  logoText:{fontSize:14,fontWeight:600,color:"#2C2C2A"},
  logoSub:{fontSize:11,color:"#888"},
  navBack:{padding:"6px 16px 12px",fontSize:12,color:"#888",cursor:"pointer",borderBottom:"1px solid #E5E3DB",marginBottom:8},
  issue:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#666",padding:"3px 0"},
  issueDot:{width:5,height:5,borderRadius:"50%",background:"#E24B4A",flexShrink:0},
  main:{flex:1,display:"flex",flexDirection:"column"},
  topbar:{padding:"14px 24px",borderBottom:"1px solid #E5E3DB",display:"flex",alignItems:"center",justifyContent:"space-between",background:"white"},
  pageTitle:{fontSize:15,fontWeight:600,color:"#2C2C2A"},
  pageSub:{fontSize:12,color:"#888",marginTop:2},
  generating:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px",textAlign:"center"},
  fieldsWrap:{padding:"16px 24px",display:"flex",flexDirection:"column",gap:0,overflow:"auto"},
  sectionTitle:{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",padding:"16px 0 8px",borderBottom:"1px solid #E5E3DB",marginBottom:12},
  fieldSection:{marginBottom:16},
  fieldRow:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
  fieldCol:{display:"flex",flexDirection:"column",gap:4},
  fieldLabel:{fontSize:10,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em",display:"flex",alignItems:"center",gap:5},
  dot:{width:6,height:6,borderRadius:"50%",flexShrink:0},
  pill:{fontSize:10,fontWeight:500,padding:"1px 7px",borderRadius:20,marginLeft:"auto"},
  fieldVal:{fontSize:12,color:"#2C2C2A",padding:"8px 10px",background:"#F8F7F4",borderRadius:6,border:"1px solid #E5E3DB",lineHeight:1.5,minHeight:36},
  fieldImproved:{background:"#E1F5EE",border:"1px solid #9FE1CB",color:"#085041"},
  fieldApplied:{background:"#E1F5EE",border:"1px solid #1D9E75",color:"#085041"},
  empty:{color:"#aaa",fontStyle:"italic"},
  emptyText:{color:"#aaa",fontStyle:"italic"},
  charCount:{fontSize:10,color:"#aaa",textAlign:"right"},
  fieldActions:{display:"flex",justifyContent:"flex-end",gap:6,marginTop:4},
  btnApply:{fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",border:"0.5px solid #9FE1CB",background:"#E1F5EE",color:"#0F6E56",fontWeight:500},
  compositionBox:{display:"flex",alignItems:"center",padding:"10px 14px",background:"#FAEEDA",borderRadius:6,border:"1px solid #FAC775",marginBottom:16},
  tableWrap:{border:"1px solid #E5E3DB",borderRadius:8,overflow:"hidden",marginBottom:16},
  sizeTable:{width:"100%",borderCollapse:"collapse"},
  th:{padding:"7px 12px",textAlign:"left",fontSize:11,fontWeight:600,color:"white",letterSpacing:"0.04em"},
  td:{padding:"7px 12px",fontSize:12,color:"#444",borderBottom:"1px solid #E5E3DB"},
  tableActions:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#F8F7F4",borderTop:"1px solid #E5E3DB"},
  colorsWrap:{border:"1px solid #E5E3DB",borderRadius:8,overflow:"hidden",marginBottom:16},
  colorRow:{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #F1EFE8",background:"white"},
  colorSwatch:{width:28,height:28,borderRadius:"50%",flexShrink:0},
  previewGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16},
  previewLabel:{fontSize:10,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6},
  googleCard:{background:"white",border:"1px solid #E5E3DB",borderRadius:8,padding:"12px 14px"},
  googleUrl:{fontSize:11,color:"#1D9E75",marginBottom:3},
  googleTitle:{fontSize:15,color:"#185FA5",fontWeight:500,marginBottom:4},
  googleDesc:{fontSize:12,color:"#444",lineHeight:1.5},
  loading:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:14,color:"#888"},
  btnPrimary:{fontSize:13,padding:"8px 16px",background:"#534AB7",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:500},
};
