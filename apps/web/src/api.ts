import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://seo.bruda.io";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ── STORES ────────────────────────────────────────────────────────────────────
export const getStores = () =>
  api.get("/api/stores").then(r => r.data);

export const getStore = (storeId: string) =>
  api.get(`/api/stores/${storeId}`).then(r => r.data);

export const syncStore = (storeId: string) =>
  api.post(`/api/stores/${storeId}/sync`).then(r => r.data);

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
export const getProducts = (storeId: string, order = "score_asc") =>
  api.get(`/api/stores/${storeId}/products`, { params: { order } }).then(r => r.data);

export const getProduct = (storeId: string, productId: string) =>
  api.get(`/api/stores/${storeId}/products/${productId}`).then(r => r.data);

export const generateSEO = (storeId: string, productId: string) =>
  api.post(`/api/stores/${storeId}/products/${productId}/generate`).then(r => r.data);

export const getVersions = (storeId: string, productId: string) =>
  api.get(`/api/stores/${storeId}/products/${productId}/versions`).then(r => r.data);

export const applyVersion = (storeId: string, versionId: string) =>
  api.post(`/api/stores/${storeId}/versions/${versionId}/apply`).then(r => r.data);

export const rejectVersion = (storeId: string, versionId: string) =>
  api.post(`/api/stores/${storeId}/versions/${versionId}/reject`).then(r => r.data);

// Dry-run: devuelve el payload exacto que se enviaría a Tienda Nube, sin escribir.
export const previewVersion = (storeId: string, versionId: string) =>
  api.get(`/api/stores/${storeId}/versions/${versionId}/preview`).then(r => r.data);

// ── AUTOMATIZACIÓN ────────────────────────────────────────────────────────────
export const updateStoreSettings = (
  storeId: string,
  settings: { automation_mode?: "manual" | "suggest" | "auto"; preferred_model?: string }
) => api.patch(`/api/stores/${storeId}/settings`, settings).then(r => r.data);

export const optimizeStore = (
  storeId: string,
  opts: { scoreThreshold?: number; autoApply?: boolean; limit?: number } = {}
) => api.post(`/api/stores/${storeId}/optimize`, opts).then(r => r.data);

export const getJob = (jobId: string) =>
  api.get(`/api/jobs/${jobId}`).then(r => r.data);

export const getStoreJobs = (storeId: string) =>
  api.get(`/api/stores/${storeId}/jobs`).then(r => r.data);

// ── API KEY DE ANTHROPIC (POR CLIENTE) ────────────────────────────────────────
export const setAnthropicKey = (storeId: string, apiKey: string) =>
  api.put(`/api/stores/${storeId}/anthropic-key`, { api_key: apiKey }).then(r => r.data);

export const deleteAnthropicKey = (storeId: string) =>
  api.delete(`/api/stores/${storeId}/anthropic-key`).then(r => r.data);
