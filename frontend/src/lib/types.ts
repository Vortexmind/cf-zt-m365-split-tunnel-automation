// These types must be kept in sync with src/types.ts.
// Do not import from src/types.ts to keep the Worker and frontend build pipelines independent.

export interface SyncState {
  clientRequestId: string;
  lastVersion: string;
  lastSyncedAt: string;
  lastResultSummary?: SyncResult;
  lastError?: { type: string; message: string; timestamp: string };
}

export interface SyncResult {
  version: string;
  services: string[];
  categories: string[];
  candidates: number;
  managedBefore: number;
  managedAfter: number;
  preserved: number;
  added: number;
  removed: number;
  dryRun: boolean;
  timestamp: string;
  error?: string;
}

export interface ScheduleState {
  cron: string;
  paused: boolean;
}

export interface RemoveResult {
  removed: number;
  preserved: number;
  totalAfter: number;
  timestamp: string;
  error?: string;
}

export interface SplitTunnelEntryAddress {
  address: string;
  description?: string;
}

export interface SplitTunnelEntryHost {
  host: string;
  description?: string;
}

export type SplitTunnelEntry = SplitTunnelEntryAddress | SplitTunnelEntryHost;

export interface EntriesResult {
  managed: SplitTunnelEntry[];
  preserved: SplitTunnelEntry[];
  managedCount: number;
  preservedCount: number;
  totalCount: number;
}

export interface PreviewResult {
  version: string;
  candidates: number;
  preserved: number;
  managedBefore: number;
  managedAfter: number;
  added: Array<{ key: string; type: "address" | "host"; description: string; serviceArea?: string; required?: boolean; notes?: string }>;
  removed: Array<{ key: string; type: "address" | "host"; description: string; serviceArea?: string; required?: boolean; notes?: string }>;
  toKeep: number;
  totalAfter: number;
  versionWarning?: string;
}

export interface ConfigStatus {
  accessConfigured: boolean;
}

export interface ServicesConfig {
  /** null means "all services" (no filter applied); string[] is the explicit selection */
  services: string[] | null;
}

export interface DeviceProfile {
  policyId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  match?: string;
}

export interface ProfilesResponse {
  profiles: DeviceProfile[];
}

/** The source of a setting value */
export type SettingSource = "kv" | "env" | "default";

/** A single setting with its effective value and source */
export interface SettingDetail<T> {
  value: T;
  source: SettingSource;
}

/** Response from GET /api/settings */
export interface SettingsConfig {
  m365Instance: SettingDetail<string>;
  m365Categories: SettingDetail<string>;
  includeIpv6: SettingDetail<boolean>;
  includeUrls: SettingDetail<boolean>;
  dryRun: SettingDetail<boolean>;
  maxEntries: SettingDetail<number>;
  cfPolicyId: SettingDetail<string>;
}

/** Body for POST /api/settings - only include keys you want to override; omit keys to revert to env/default */
export interface SettingsUpdate {
  m365Instance?: string;
  m365Categories?: string;
  includeIpv6?: boolean;
  includeUrls?: boolean;
  dryRun?: boolean;
  maxEntries?: number;
  cfPolicyId?: string;
}

// History log types (must be kept in sync with src/types.ts)
export type HistoryTrigger = "manual" | "cron";
export type HistoryOutcome = "success" | "error" | "skipped" | "dry_run";
export type HistoryOpType = "sync" | "remove";

export interface HistoryEntry {
  timestamp: string;
  opType: HistoryOpType;
  trigger: HistoryTrigger;
  outcome: HistoryOutcome;
  version?: string;
  candidates?: number;
  added?: number;
  removed?: number;
  managedAfter?: number;
  preserved?: number;
  dryRun?: boolean;
  removedCount?: number;
  preservedCount?: number;
  totalAfter?: number;
  errorType?: string;
  errorMessage?: string;
}

export interface ServiceSummary {
  serviceArea: string;
  entryCount: number;
  sampleDomains: string[];
}

export interface ServicesSummaryResponse {
  version: string;
  versionWarning?: string;
  services: ServiceSummary[];
}
