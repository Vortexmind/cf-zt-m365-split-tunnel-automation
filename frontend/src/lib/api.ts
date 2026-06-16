import type { SyncState, ScheduleState, RemoveResult, EntriesResult, PreviewResult, ConfigStatus, ServicesConfig, SettingsConfig, SettingsUpdate, HistoryEntry, ServicesSummaryResponse, ProfilesResponse } from "./types";

function getAccessCookie(): string | null {
  if (typeof document === "undefined") return null;
  const value = "; " + document.cookie;
  const parts = value.split("; CF_Authorization=");
  if (parts.length === 2) {
    const raw = parts.pop()?.split(";").shift() ?? null;
    try {
      return raw ? decodeURIComponent(raw) : null;
    } catch {
      return raw;
    }
  }
  return null;
}

let sessionExpired = false;

export function isSessionExpired(): boolean {
  return sessionExpired;
}

export function resetSessionExpired(): void {
  sessionExpired = false;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessCookie();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["CF-Access-JWT-Assertion"] = token;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    sessionExpired = true;
    throw new Error("Unauthorized");
  }

  return res.json() as Promise<T>;
}

export function fetchConfigStatus(): Promise<ConfigStatus> {
  return apiFetch<ConfigStatus>("/api/config-status");
}

export function fetchStatus(): Promise<SyncState> {
  return apiFetch<SyncState>("/api/status");
}

export function fetchSchedule(): Promise<ScheduleState> {
  return apiFetch<ScheduleState>("/api/schedule");
}

export function updateSchedule(paused: boolean): Promise<ScheduleState> {
  return apiFetch<ScheduleState>("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused }),
  });
}

export function forceSync(): Promise<unknown> {
  return apiFetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force: true }),
  });
}

export function removeManaged(): Promise<RemoveResult> {
  return apiFetch<RemoveResult>("/api/managed", { method: "DELETE" });
}

export function fetchPreview(): Promise<PreviewResult> {
  return apiFetch<PreviewResult>("/api/preview");
}

export function fetchEntries(): Promise<EntriesResult> {
  return apiFetch<EntriesResult>("/api/entries");
}

export function fetchServices(): Promise<ServicesConfig> {
  return apiFetch<ServicesConfig>("/api/services");
}

export function updateServices(services: string[] | null): Promise<ServicesConfig> {
  return apiFetch<ServicesConfig>("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ services }),
  });
}

export function fetchSettings(): Promise<SettingsConfig> {
  return apiFetch<SettingsConfig>("/api/settings");
}

export function updateSettings(settings: SettingsUpdate): Promise<SettingsConfig> {
  return apiFetch<SettingsConfig>("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export function fetchHistory(): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>("/api/history");
}

export function fetchServicesSummary(): Promise<ServicesSummaryResponse> {
  return apiFetch<ServicesSummaryResponse>("/api/services/summary");
}

export function fetchProfiles(): Promise<ProfilesResponse> {
  return apiFetch<ProfilesResponse>("/api/profiles");
}
