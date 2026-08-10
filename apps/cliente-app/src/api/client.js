const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG;

const TOKEN_STORAGE_KEY = "barberaria_access_token";
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

export function getTenantSlug() {
  return TENANT_SLUG;
}

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

/**
 * Wrapper de fetch: anexa o access token, tenta um refresh automático (via
 * cookie httpOnly) se a resposta vier 401, e normaliza erro/sucesso.
 */
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
    const error = new Error(data?.message?.[0] ?? data?.message ?? `Erro ${res.status}`);
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

// ─── Auth ──────────────────────────────────────────────
export const login = (email, password) =>
  apiFetch("/v1/auth/login", { method: "POST", body: { email, password, tenantSlug: TENANT_SLUG } });

export const register = (name, email, password, phone) =>
  apiFetch("/v1/auth/register", {
    method: "POST",
    body: { tenantSlug: TENANT_SLUG, name, email, password, ...(phone ? { phone } : {}) },
  });

export const logout = () => apiFetch("/v1/auth/logout", { method: "POST" });

export const getMe = () => apiFetch("/v1/users/me");

// ─── Tenant ────────────────────────────────────────────
export const getPublicTenant = () => apiFetch(`/v1/public/tenants/${TENANT_SLUG}`);

// ─── Catálogo ──────────────────────────────────────────
export const listServices = () => apiFetch("/v1/services?activeOnly=true&pageSize=100");

export const listProfessionalsForService = (serviceId) =>
  apiFetch(`/v1/services/${serviceId}/professionals`);

export const listProfessionals = () => apiFetch("/v1/professionals?pageSize=100");

// ─── Disponibilidade e agendamentos ───────────────────
export const getAvailability = (professionalId, serviceId, date) =>
  apiFetch(`/v1/professionals/${professionalId}/availability?serviceId=${serviceId}&date=${date}`);

export const createAppointment = (serviceId, professionalId, startsAt) =>
  apiFetch("/v1/appointments", { method: "POST", body: { serviceId, professionalId, startsAt } });

export const listAppointments = () => apiFetch("/v1/appointments?pageSize=100");

export const cancelAppointment = (id) => apiFetch(`/v1/appointments/${id}/cancel`, { method: "PATCH" });

export const rescheduleAppointment = (id, startsAt) =>
  apiFetch(`/v1/appointments/${id}/reschedule`, { method: "PATCH", body: { startsAt } });
