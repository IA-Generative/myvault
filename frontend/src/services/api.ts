/**
 * MyVault API client — handles all HTTP calls to the backend.
 */

import { getAccessToken } from "./auth";

const BASE = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || res.statusText);
  }
  return res.json();
}

// --- Types ---

export interface VariableDefinition {
  key: string;
  label: string;
  var_type: string;
  required: boolean;
  description: string;
  default_value: string;
  choices?: string[];
  category: "manual" | "api" | "both";
}

export interface AppListItem {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  friendly_slug: string;
  status: string;
  check_connection_endpoint: string;
  required_variables: VariableDefinition[];
  user_configured: boolean;
  user_enabled: boolean;
  check_status: string;
}

export interface VaultEntry {
  entry_id: string;
  app_id: string;
  app_name: string;
  app_slug: string;
  enabled: boolean;
  values: Record<string, string>;
  last_check: string | null;
  check_status: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface CheckResult {
  status: string;
  detail: string;
}

export interface BridgeExport {
  app_name: string;
  app_slug: string;
  format: string;
  data: string;
  variables: Record<string, string>;
}

export interface AdminApp {
  id: string;
  client_id: string;
  name: string;
  description: string;
  friendly_slug: string;
  status: string;
  required_variables: VariableDefinition[];
  created_at: string;
}

// --- User Vault API ---

export const userApi = {
  getProfile: () => request<UserProfile>("/me/profile"),

  getMyApps: () => request<AppListItem[]>("/me/apps"),

  getMyEntry: (appSlug: string) => request<VaultEntry | { values: Record<string, string>; configured: false }>(`/me/apps/${appSlug}/entries`),

  saveMyEntry: (appSlug: string, values: Record<string, string>, enabled: boolean) =>
    request<VaultEntry>(`/me/apps/${appSlug}/entries`, {
      method: "PUT",
      body: JSON.stringify({ values, enabled }),
    }),

  toggleMyEntry: (appSlug: string) =>
    request<{ enabled: boolean }>(`/me/apps/${appSlug}/toggle`, { method: "PATCH" }),

  checkConnection: (appSlug: string) =>
    request<CheckResult>(`/me/apps/${appSlug}/check`, { method: "POST" }),

  getAllEntries: () => request<VaultEntry[]>("/me/entries"),
};

// --- Personal Vault API ---

export interface PersonalEntry {
  id: string;
  name: string;
  website: string;
  username: string;
  password: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const personalApi = {
  list: () => request<PersonalEntry[]>("/me/personal"),

  create: (data: { name: string; website?: string; username?: string; password?: string; notes?: string }) =>
    request<PersonalEntry>("/me/personal", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; website?: string; username?: string; password?: string; notes?: string }) =>
    request<PersonalEntry>(`/me/personal/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ status: string }>(`/me/personal/${id}`, { method: "DELETE" }),
};

// --- Bridge API ---

export const bridgeApi = {
  exportCredentials: (appSlug: string, format: string = "json") =>
    request<BridgeExport>(`/me/bridge/${appSlug}?format=${format}`),

  importCredentials: (appSlug: string, format: string, data: string) =>
    request<{ mapped_variables: Record<string, string>; count: number }>(
      `/me/bridge/${appSlug}/import`,
      { method: "POST", body: JSON.stringify({ format, data }) }
    ),
};

// --- Admin API ---

export const adminApi = {
  listApps: () => request<AdminApp[]>("/admin/apps"),

  createApp: (data: Record<string, unknown>) =>
    request<{ id: string; friendly_slug: string }>("/admin/apps", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateApp: (appId: string, data: Record<string, unknown>) =>
    request<{ id: string }>(`/admin/apps/${appId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteApp: (appId: string) =>
    request<{ status: string }>(`/admin/apps/${appId}`, { method: "DELETE" }),

  importKeycloak: (data: { clients: unknown[] }) =>
    request<{ imported: number }>("/admin/apps/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  exportKeycloak: () => request<{ clients: unknown[] }>("/admin/apps/export"),

  listUsers: () => request<{ user_id: string; apps_configured: number; last_activity: string }[]>("/admin/users"),
};
