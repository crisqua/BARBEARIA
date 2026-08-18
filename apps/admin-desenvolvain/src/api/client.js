const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const TOKEN_STORAGE_KEY = "desenvolvain_admin_access_token";
let accessToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/v1/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

/** Wrapper de fetch: anexa o access token e tenta refresh automático (via cookie) numa 401. */
export async function apiFetch(path, { method = "GET", body, skipAuthRetry = false } = {}) {
  const doFetch = (token) =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && accessToken && !skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    const error = new Error(message ?? `Erro ${res.status}`);
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

// ─── Auth ──────────────────────────────────────────────
// Painel só é usado por super_admin — login sem tenantSlug (auth.service.ts
// trata a ausência de tenantSlug como login de Super Admin).
export const login = (email, password) =>
  apiFetch("/v1/auth/login", { method: "POST", body: { email, password } });

export const logout = () => apiFetch("/v1/auth/logout", { method: "POST" });

export const whoami = () => apiFetch("/v1/admin/whoami");

// ─── Tenants (barbearias clientes) ──────────────────────
export const listTenants = (page = 1, pageSize = 50) =>
  apiFetch(`/v1/admin/tenants?page=${page}&pageSize=${pageSize}`);

export const getTenant = (id) => apiFetch(`/v1/admin/tenants/${id}`);

export const createTenant = (data) => apiFetch("/v1/admin/tenants", { method: "POST", body: data });

export const updateTenant = (id, data) =>
  apiFetch(`/v1/admin/tenants/${id}`, { method: "PATCH", body: data });

// ─── Dashboard ───────────────────────────────────────────
export const getDashboardOverview = () => apiFetch("/v1/admin/dashboard/overview");

// ─── Usuários (cross-tenant) ─────────────────────────────
export const getUsers = (params = {}) => {
  const query = new URLSearchParams({ pageSize: "100", ...params }).toString();
  return apiFetch(`/v1/admin/users?${query}`);
};

// ─── Planos ──────────────────────────────────────────────
export const listPlans = () => apiFetch("/v1/admin/plans");

export const createPlan = (data) => apiFetch("/v1/admin/plans", { method: "POST", body: data });

export const updatePlan = (id, data) => apiFetch(`/v1/admin/plans/${id}`, { method: "PATCH", body: data });
