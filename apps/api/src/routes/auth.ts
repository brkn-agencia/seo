import { Router, Request, Response } from "express";
import { db, stores } from "@seo/db";
import crypto from "crypto";
import axios from "axios";

const router = Router();

const TN_CLIENT_ID = process.env.TN_CLIENT_ID!;
const TN_CLIENT_SECRET = process.env.TN_CLIENT_SECRET!;
const APP_URL = process.env.APP_URL || "https://seo.bruda.io";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

router.get("/auth/install", (req: Request, res: Response) => {
  const installUrl =
    `https://www.tiendanube.com/apps/${TN_CLIENT_ID}/authorize` +
    `?response_type=code` +
    `&client_id=${TN_CLIENT_ID}` +
    `&redirect_uri=${APP_URL}/auth/callback`;
  res.redirect(installUrl);
});

router.get("/auth/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).json({ error: "Código de autorización faltante" });
    return;
  }
  try {
    const tokenRes = await axios.post(
      `https://www.tiendanube.com/apps/authorize/token`,
      {
        client_id: TN_CLIENT_ID,
        client_secret: TN_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }
    );
    const { access_token, user_id } = tokenRes.data;
    const storeRes = await axios.get(
      `https://api.tiendanube.com/v1/${user_id}/store`,
      {
        headers: {
          Authorization: `bearer ${access_token}`,
          "User-Agent": `SEO Agency App (${TN_CLIENT_ID})`,
        },
      }
    );
    const storeData = storeRes.data;
    const storeId = `tn_${user_id}`;
    await db
      .insert(stores)
      .values({
        id: storeId,
        name: storeData.name?.es || storeData.name || "Sin nombre",
        url: storeData.original_domain || "",
        tn_store_id: String(user_id),
        tn_access_token_enc: encrypt(access_token),
        automation_mode: "manual",
      })
      .onConflictDoUpdate({
        target: stores.id,
        set: {
          tn_access_token_enc: encrypt(access_token),
          updated_at: new Date(),
        },
      });
    res.json({
      success: true,
      store_id: storeId,
      store_name: storeData.name?.es || storeData.name,
      message: "✅ Tienda conectada correctamente",
    });
  } catch (err: any) {
    console.error("OAuth error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error en la autenticación con Tienda Nube" });
  }
});

router.get("/auth/stores", async (req: Request, res: Response) => {
  try {
    const result = await db
      .select({
        id: stores.id,
        name: stores.name,
        url: stores.url,
        automation_mode: stores.automation_mode,
        last_sync_at: stores.last_sync_at,
        created_at: stores.created_at,
      })
      .from(stores);
    res.json({ data: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tiendas" });
  }
});

export default router;
