import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

export * from "./schema/index.js";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
