import { createClient } from "@supabase/supabase-js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG;

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB — mesmo limite imposto no bucket do Supabase Storage
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

// Client Supabase só pra upload direto (storage) — chave anon, pública por design.
// A autorização real do upload vem do token assinado devolvido pelo backend
// (seção 6.1.6 do CLAUDE.md), não dessa chave.
let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Upload de logo indisponível: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configuradas.");
  }
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

const TOKEN_STORAGE_KEY = "barberaria_painel_access_token";
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
  const isFormData = body instanceof FormData;
  const doFetch = (token) =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        // FormData define seu próprio Content-Type (com boundary) — o browser
        // só faz isso certo se a gente não fixar o header manualmente aqui.
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
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
// Painel só é usado por admin — sem cadastro (admin é provisionado pelo Super Admin).
export const login = (email, password) =>
  apiFetch("/v1/auth/login", { method: "POST", body: { email, password, tenantSlug: TENANT_SLUG } });

export const logout = () => apiFetch("/v1/auth/logout", { method: "POST" });

export const getMe = () => apiFetch("/v1/users/me");

export const getUser = (id) => apiFetch(`/v1/users/${id}`);

// ─── Tenant (branding) ─────────────────────────────────
export const getMyTenant = () => apiFetch("/v1/tenants/me");

export const updateMyTenant = (data) => apiFetch("/v1/tenants/me", { method: "PATCH", body: data });

/**
 * Presigned URL do Supabase Storage (seção 6.1.6 do CLAUDE.md) — 3 passos:
 * pede a URL assinada ao backend, sobe o arquivo direto pro Supabase (o
 * NestJS nunca vê os bytes), e confirma a URL final no tenant via PATCH
 * (rota que já existia). Validação de tipo/tamanho aqui é só feedback
 * rápido — quem garante de verdade é a config do bucket no Supabase.
 */
export const uploadTenantLogo = async (file) => {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Use PNG, JPG ou SVG.");
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("Arquivo muito grande. Tamanho máximo: 2MB.");
  }

  const { token, path, publicUrl } = await apiFetch("/v1/tenants/me/logo/presign", {
    method: "POST",
    body: { contentType: file.type },
  });

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from("tenant-logos").uploadToSignedUrl(path, token, file);
  if (error) {
    throw new Error("Não foi possível enviar o arquivo. Tente novamente.");
  }

  return updateMyTenant({ logoUrl: publicUrl });
};

// ─── Serviços ──────────────────────────────────────────
export const listServices = () => apiFetch("/v1/services?pageSize=100");

export const createService = (data) => apiFetch("/v1/services", { method: "POST", body: data });

export const updateService = (id, data) => apiFetch(`/v1/services/${id}`, { method: "PATCH", body: data });

// ─── Profissionais ─────────────────────────────────────
export const listProfessionals = () => apiFetch("/v1/professionals?pageSize=100");

export const createProfessional = (data) => apiFetch("/v1/professionals", { method: "POST", body: data });

export const updateProfessional = (id, data) =>
  apiFetch(`/v1/professionals/${id}`, { method: "PATCH", body: data });

export const listProfessionalServices = (professionalId) =>
  apiFetch(`/v1/professionals/${professionalId}/services`);

export const assignService = (professionalId, serviceId) =>
  apiFetch(`/v1/professionals/${professionalId}/services`, { method: "POST", body: { serviceId } });

export const unassignService = (professionalId, serviceId) =>
  apiFetch(`/v1/professionals/${professionalId}/services/${serviceId}`, { method: "DELETE" });

export const listWorkingHours = (professionalId) =>
  apiFetch(`/v1/professionals/${professionalId}/working-hours`);

export const createWorkingHour = (professionalId, data) =>
  apiFetch(`/v1/professionals/${professionalId}/working-hours`, { method: "POST", body: data });

export const deleteWorkingHour = (professionalId, id) =>
  apiFetch(`/v1/professionals/${professionalId}/working-hours/${id}`, { method: "DELETE" });

// ─── Agendamentos ──────────────────────────────────────
// pageSize máximo aceito pelo backend é 100 (PaginationQueryDto).
export const listAppointments = (params = {}) => {
  const query = new URLSearchParams({ pageSize: "100", ...params }).toString();
  return apiFetch(`/v1/appointments?${query}`);
};

export const cancelAppointment = (id) => apiFetch(`/v1/appointments/${id}/cancel`, { method: "PATCH" });

export const completeAppointment = (id) => apiFetch(`/v1/appointments/${id}/complete`, { method: "PATCH" });

export const rescheduleAppointment = (id, startsAt) =>
  apiFetch(`/v1/appointments/${id}/reschedule`, { method: "PATCH", body: { startsAt } });

export const getAvailability = (professionalId, serviceId, date) =>
  apiFetch(`/v1/professionals/${professionalId}/availability?serviceId=${serviceId}&date=${date}`);
