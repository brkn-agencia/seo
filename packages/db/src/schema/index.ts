import { pgTable, text, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";

// ── STORES ────────────────────────────────────────────────────────────────────
export const stores = pgTable("stores", {
  id:                      text("id").primaryKey(),
  name:                    text("name").notNull(),
  url:                     text("url").notNull(),
  platform:                text("platform").notNull().default("tiendanube"),
  tn_store_id:             text("tn_store_id").unique(),
  tn_access_token_enc:     text("tn_access_token_enc"),
  tn_token_expires_at:     timestamp("tn_token_expires_at"),
  anthropic_api_key_enc:   text("anthropic_api_key_enc"),
  anthropic_key_verified_at: timestamp("anthropic_key_verified_at"),
  preferred_model:         text("preferred_model").default("claude-sonnet-4-5"),
  automation_mode:         text("automation_mode").default("manual"),
  last_sync_at:            timestamp("last_sync_at"),
  created_at:              timestamp("created_at").defaultNow(),
  updated_at:              timestamp("updated_at").defaultNow(),
});

// ── BRAND PROFILES ────────────────────────────────────────────────────────────
export const brand_profiles = pgTable("brand_profiles", {
  id:              text("id").primaryKey(),
  store_id:        text("store_id").notNull().references(() => stores.id),
  tone_base:       text("tone_base").default("cercano"),
  tone_custom:     text("tone_custom"),
  formality:       integer("formality").default(2),
  length:          integer("length").default(3),
  words_allowed:   jsonb("words_allowed").default([]),
  words_forbidden: jsonb("words_forbidden").default([]),
  title_instruction:       text("title_instruction"),
  description_instruction: text("description_instruction"),
  store_context:           text("store_context"),
  created_at:      timestamp("created_at").defaultNow(),
  updated_at:      timestamp("updated_at").defaultNow(),
});

// ── PRODUCTS CACHE ────────────────────────────────────────────────────────────
export const products_cache = pgTable("products_cache", {
  id:              text("id").primaryKey(),
  store_id:        text("store_id").notNull().references(() => stores.id),
  tn_product_id:   text("tn_product_id").notNull(),
  name:            text("name").notNull(),
  description:     text("description"),
  seo_title:       text("seo_title"),
  seo_description: text("seo_description"),
  handle:          text("handle"),
  brand:           text("brand"),
  category:        text("category"),
  variants:        jsonb("variants").default([]),
  images:          jsonb("images").default([]),
  seo_score:       integer("seo_score").default(0),
  seo_issues:      jsonb("seo_issues").default([]),
  is_locked:       boolean("is_locked").default(false),
  last_analyzed_at: timestamp("last_analyzed_at"),
  last_optimized_at: timestamp("last_optimized_at"),
  created_at:      timestamp("created_at").defaultNow(),
  updated_at:      timestamp("updated_at").defaultNow(),
});

// ── SEO VERSIONS ──────────────────────────────────────────────────────────────
export const seo_versions = pgTable("seo_versions", {
  id:              text("id").primaryKey(),
  product_id:      text("product_id").notNull().references(() => products_cache.id),
  store_id:        text("store_id").notNull().references(() => stores.id),
  before:          jsonb("before").notNull(),
  after:           jsonb("after").notNull(),
  model_used:      text("model_used"),
  tokens_used:     integer("tokens_used"),
  cost_usd:        real("cost_usd"),
  status:          text("status").default("pending"),
  applied_at:      timestamp("applied_at"),
  created_at:      timestamp("created_at").defaultNow(),
});

// ── JOBS ──────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id:              text("id").primaryKey(),
  store_id:        text("store_id").notNull().references(() => stores.id),
  type:            text("type").notNull(),
  status:          text("status").default("queued"),
  total:           integer("total").default(0),
  processed:       integer("processed").default(0),
  failed:          integer("failed").default(0),
  skipped:         integer("skipped").default(0),
  error_log:       jsonb("error_log").default([]),
  started_at:      timestamp("started_at"),
  finished_at:     timestamp("finished_at"),
  created_at:      timestamp("created_at").defaultNow(),
});

// ── COLOR VALIDATIONS ─────────────────────────────────────────────────────────
export const color_validations = pgTable("color_validations", {
  id:              text("id").primaryKey(),
  store_id:        text("store_id").notNull().references(() => stores.id),
  color_name:      text("color_name").notNull(),
  brand:           text("brand"),
  hex_proposed:    text("hex_proposed"),
  hex_confirmed:   text("hex_confirmed"),
  confidence:      integer("confidence").default(0),
  status:          text("status").default("pending"),
  confirmed_at:    timestamp("confirmed_at"),
  created_at:      timestamp("created_at").defaultNow(),
});
