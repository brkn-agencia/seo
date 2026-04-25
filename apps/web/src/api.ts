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
