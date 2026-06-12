import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, setToken } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      setToken(res.token);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.shell}>
      <form style={s.card} onSubmit={submit}>
        <div style={s.logo}>
          <div style={s.logoIcon}>B</div>
          <div>
            <div style={s.logoText}>Bruda SEO</div>
            <div style={s.logoSub}>centro de control</div>
          </div>
        </div>
        <div style={s.title}>Iniciar sesión</div>
        <input
          style={s.input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoFocus
        />
        <input
          style={s.input} type="password" placeholder="Contraseña" value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div style={s.error}>{error}</div>}
        <button style={s.btn} type="submit" disabled={loading || !email || !password}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAF8", fontFamily: "system-ui, sans-serif" },
  card: { width: 320, background: "white", border: "1px solid #E5E3DB", borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.05)" },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  logoIcon: { width: 36, height: 36, background: "#534AB7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18 },
  logoText: { fontSize: 15, fontWeight: 600, color: "#2C2C2A" },
  logoSub: { fontSize: 11, color: "#888" },
  title: { fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 },
  input: { fontSize: 14, padding: "10px 12px", border: "1px solid #E5E3DB", borderRadius: 8, background: "white" },
  btn: { fontSize: 14, padding: "10px", background: "#534AB7", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, marginTop: 4 },
  error: { fontSize: 12, color: "#A32D2D", background: "#FCEBEB", padding: "8px 10px", borderRadius: 6 },
};
