import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as dsql } from "drizzle-orm";
import * as schema from "./schema/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

export * from "./schema/index.js";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Migración liviana e idempotente que corre al arrancar el servidor: crea las
 * tablas auxiliares (product_sales, product_ops) si no existen, así no hace
 * falta correr `npm run db:push` a mano. Todo es CREATE/ALTER IF NOT EXISTS.
 */
export async function runMigrations(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS product_sales (
      id            text PRIMARY KEY,
      store_id      text NOT NULL,
      tn_product_id text NOT NULL,
      units_sold    integer DEFAULT 0,
      orders_count  integer DEFAULT 0,
      last_order_at timestamp,
      updated_at    timestamp DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS product_ops (
      id            text PRIMARY KEY,
      store_id      text NOT NULL,
      tn_product_id text NOT NULL,
      published     boolean DEFAULT true,
      stock         integer,
      categories    jsonb DEFAULT '[]'::jsonb,
      ficha_score   integer DEFAULT 0,
      ficha_missing jsonb DEFAULT '[]'::jsonb,
      updated_at    timestamp DEFAULT now()
    )`,
    // Por si product_ops existía de una versión anterior sin estas columnas.
    `ALTER TABLE product_ops ADD COLUMN IF NOT EXISTS ficha_score integer DEFAULT 0`,
    `ALTER TABLE product_ops ADD COLUMN IF NOT EXISTS ficha_missing jsonb DEFAULT '[]'::jsonb`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(dsql.raw(stmt));
    } catch (err: any) {
      console.error("⚠️  Migración:", err.message);
    }
  }
  console.log("✅ Migraciones automáticas verificadas (product_sales, product_ops)");
}

