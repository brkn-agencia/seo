import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const TN_CLIENT_ID = process.env.TN_CLIENT_ID!;
const TN_API = "https://api.tiendanube.com/v1";

// ── ENCRIPTACIÓN ──────────────────────────────────────────────────────────────
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString();
}

// ── TEXTO LOCALIZADO ──────────────────────────────────────────────────────────
// Tienda Nube guarda muchos campos como objetos { es: "...", pt: "..." }.
export function tnText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") {
    try {
      const p = JSON.parse(field);
      return p?.es || p?.en || (Object.values(p)[0] as string) || "";
    } catch {
      return field;
    }
  }
  if (typeof field === "object")
    return field?.es || field?.en || (Object.values(field)[0] as string) || "";
  return String(field);
}

// Envuelve un string en el formato localizado que espera la API ({ es: "..." }).
export function tnLocalized(value: string, lang = "es"): Record<string, string> {
  return { [lang]: value };
}

// ── CLIENTE AUTENTICADO ─────────────────────────────────────────────────────
// Crea un cliente axios apuntado a una tienda concreta, con el token desencriptado.
export function tnClient(tnStoreId: string, accessTokenEnc: string): AxiosInstance {
  const accessToken = decrypt(accessTokenEnc);
  return axios.create({
    baseURL: `${TN_API}/${tnStoreId}`,
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": `Bruda SEO App (${TN_CLIENT_ID})`,
      "Content-Type": "application/json",
    },
  });
}
