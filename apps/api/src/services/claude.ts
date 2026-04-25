import Anthropic from "@anthropic-ai/sdk";
import { db, products_cache, seo_versions, stores } from "@seo/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString();
}

function getClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

function buildPrompt(product: any, brandProfile: any): string {
  return `Sos un experto en SEO para ecommerce argentino. Tu tarea es optimizar la ficha de un producto para que aparezca en Google y en buscadores de IA como ChatGPT y Perplexity.

PRODUCTO:
- Nombre: ${product.name}
- Descripción actual: ${product.description || "Sin descripción"}
- SEO title actual: ${product.seo_title || "Sin SEO title"}
- Meta description actual: ${product.seo_description || "Sin meta description"}
- URL actual: ${product.handle || "Sin handle"}
- Marca: ${product.brand || "Sin marca"}

${brandProfile ? `PERFIL DE MARCA:
- Tono: ${brandProfile.tone_base} — ${brandProfile.tone_custom || ""}
- Palabras permitidas: ${(brandProfile.words_allowed as string[])?.join(", ") || "ninguna"}
- Palabras prohibidas: ${(brandProfile.words_forbidden as string[])?.join(", ") || "ninguna"}
- Instrucción para títulos: ${brandProfile.title_instruction || "ninguna"}
- Instrucción para descripciones: ${brandProfile.description_instruction || "ninguna"}
- Contexto de la tienda: ${brandProfile.store_context || "ninguno"}` : ""}

REGLAS ESTRICTAS:
1. SEO title: máximo 60 caracteres, keyword principal al inicio, sin el nombre de la marca al final
2. Meta description: entre 140 y 160 caracteres, incluir call-to-action implícito, mencionar atributos clave
3. URL handle: solo minúsculas, guiones, sin caracteres especiales, descriptiva y corta
4. Descripción: 2-3 párrafos, mencionar materiales/características, casos de uso, beneficios concretos. Optimizada para que una IA la cite en respuestas conversacionales.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin bloques de código:
{
  "seo_title": "...",
  "seo_description": "...", 
  "handle": "...",
  "description": "..."
}`;
}

export async function generateSEO(
  productId: string,
  storeId: string,
  apiKey?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Obtener producto
    const product = await db.query.products_cache.findFirst({
      where: eq(products_cache.id, productId),
    });
    if (!product) return { success: false, error: "Producto no encontrado" };

    // Obtener store y API key
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });
    if (!store) return { success: false, error: "Tienda no encontrada" };

    const claudeApiKey = apiKey ||
      (store.anthropic_api_key_enc ? decrypt(store.anthropic_api_key_enc) : process.env.ANTHROPIC_API_KEY);

    if (!claudeApiKey) return { success: false, error: "No hay API key de Claude configurada" };

    // Obtener brand profile si existe
    const brandProfile = await db.query.brand_profiles.findFirst({
      where: eq((await import("@seo/db")).brand_profiles.store_id, storeId),
    });

    const client = getClient(claudeApiKey);
    const model = store.preferred_model || "claude-haiku-4-5";

    const prompt = buildPrompt(product, brandProfile);

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") return { success: false, error: "Respuesta inesperada de Claude" };

    const raw = content.text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const generated = JSON.parse(raw);

    // Tokens usados
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const costUsd = model.includes("haiku")
      ? (tokensIn * 1 + tokensOut * 5) / 1_000_000
      : (tokensIn * 3 + tokensOut * 15) / 1_000_000;

    // Guardar versión
    const versionId = crypto.randomUUID();
    await db.insert(seo_versions).values({
      id: versionId,
      product_id: productId,
      store_id: storeId,
      before: {
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        handle: product.handle,
        description: product.description,
      },
      after: generated,
      model_used: model,
      tokens_used: tokensIn + tokensOut,
      cost_usd: costUsd,
      status: "pending",
    });

    return {
      success: true,
      data: {
        version_id: versionId,
        before: {
          seo_title: product.seo_title,
          seo_description: product.seo_description,
          handle: product.handle,
        },
        after: generated,
        tokens_used: tokensIn + tokensOut,
        cost_usd: costUsd,
        model,
      },
    };
  } catch (err: any) {
    console.error("Claude error:", err.message);
    console.error("Claude full error:", JSON.stringify(err.response?.data || err.message)); return { success: false, error: err.message };
  }
}

// Parchar el archivo — reemplazar la línea del parse
