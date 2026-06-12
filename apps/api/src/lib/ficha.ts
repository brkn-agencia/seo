import { tnText } from "./tn.js";

export interface FichaResult {
  ficha_score: number; // 0-100, completitud de la ficha del producto
  ficha_missing: string[]; // qué le falta
}

/**
 * Analiza la completitud de la ficha de un producto de Tienda Nube (más allá del
 * SEO de texto): marca, categoría, medidas/peso, material, imágenes y variantes.
 * Recibe el producto crudo de la API de TN.
 */
export function analyzeFicha(p: any): FichaResult {
  const missing: string[] = [];
  let score = 100;

  const brand = p.brand || "";
  const categories = p.categories || [];
  const variants = p.variants || [];
  const images = p.images || [];
  const description = tnText(p.description) || "";

  // Marca (20)
  if (!brand) { missing.push("Sin marca"); score -= 20; }

  // Categoría (20)
  if (!categories.length) { missing.push("Sin categoría"); score -= 20; }

  // Imágenes (15)
  if (images.length === 0) { missing.push("Sin imágenes"); score -= 15; }
  else if (images.length < 3) { missing.push("Pocas imágenes (recomendado 3+)"); score -= 7; }

  // Peso / medidas (15) — claves para envío y fichas completas
  const hasDims = variants.some((v: any) =>
    Number(v.weight) > 0 || Number(v.width) > 0 || Number(v.height) > 0 || Number(v.depth) > 0
  );
  if (!hasDims) { missing.push("Sin peso ni medidas"); score -= 15; }

  // Material / composición en la descripción (15)
  const hasMaterial = /algod[oó]n|poli[eé]ster|cuero|material|composici[oó]n|lana|seda|lino|metal|madera|pl[aá]stico|acero|vidrio/i.test(description);
  if (description.length < 150) { missing.push("Descripción corta o ausente"); score -= 15; }
  else if (!hasMaterial) { missing.push("La descripción no menciona material/composición"); score -= 8; }

  // Variantes con nombre descriptivo (15)
  if (variants.length > 1) {
    const named = variants.some((v: any) => v.values?.some((val: any) => tnText(val)));
    if (!named) { missing.push("Variantes sin nombre descriptivo"); score -= 15; }
  }

  return { ficha_score: Math.max(0, score), ficha_missing: missing };
}
