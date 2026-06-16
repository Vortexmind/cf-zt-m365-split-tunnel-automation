// M365 API types
export interface M365EndpointSet {
  id: number;
  serviceArea: "Common" | "Exchange" | "SharePoint" | "Skype";
  serviceAreaDisplayName?: string;
  urls?: string[];
  ips?: string[];
  tcpPorts?: string;
  udpPorts?: string;
  category: "Optimize" | "Allow" | "Default";
  expressRoute?: boolean;
  required?: boolean;
  notes?: string;
}

// Cloudflare API types
export interface SplitTunnelEntryAddress {
  address: string;
  description?: string;
}

export interface SplitTunnelEntryHost {
  host: string;
  description?: string;
}

export type SplitTunnelEntry = SplitTunnelEntryAddress | SplitTunnelEntryHost;

export interface CfApiPageInfo {
  count?: number;
  page?: number;
  per_page?: number;
  total_count?: number;
}

export interface CfApiListResponse<T> {
  result: T[];
  success: boolean;
  errors: Array<{ code: number; message: string; documentation_url?: string }>;
  messages: Array<{ code: number; message: string }>;
  result_info?: CfApiPageInfo;
}

// Internal types
export type CategoryPriority = "Optimize" | "Allow" | "Default";

export interface CandidateEntry {
  /** CIDR for IPs, FQDN/wildcard for hosts */
  key: string;
  /** "address" for CIDRs, "host" for domains */
  type: "address" | "host";
  description: string;
  category: CategoryPriority;
  sourceIds: number[];
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

export interface SyncState {
  clientRequestId: string;
  lastVersion: string;
  lastSyncedAt: string;
  lastResultSummary?: SyncResult;
  lastError?: { type: string; message: string; timestamp: string };
}

export interface ScheduleState {
  /** Cron expression for the scheduled trigger (from KV or triggers.crons fallback) */
  cron: string;
  /** Whether the scheduled handler is paused (skips cron runs) */
  paused: boolean;
}

export interface RemoveResult {
  /** Number of managed entries that were removed */
  removed: number;
  /** Number of preserved entries kept intact */
  preserved: number;
  /** Total entries in the list after removal */
  totalAfter: number;
  /** ISO 8601 timestamp of the operation */
  timestamp: string;
  /** Error message if the operation failed */
  error?: string;
}

export interface EntriesResult {
  /** Managed entries (description starts with managedTag) */
  managed: SplitTunnelEntry[];
  /** Preserved entries (not managed by this worker) */
  preserved: SplitTunnelEntry[];
  /** Count of managed entries */
  managedCount: number;
  /** Count of preserved entries */
  preservedCount: number;
  /** Total count of all entries */
  totalCount: number;
}

/** User-configurable settings stored in KV. Keys present mean "overridden"; keys absent mean "use env var/default". */
export interface SettingsOverride {
  m365Instance?: string;
  m365Categories?: string;
  includeIpv6?: boolean;
  includeUrls?: boolean;
  dryRun?: boolean;
  maxEntries?: number;
}

// History log types
export type HistoryTrigger = "manual" | "cron";
export type HistoryOutcome = "success" | "error" | "skipped" | "dry_run";
export type HistoryOpType = "sync" | "remove";

export interface HistoryEntry {
  /** ISO 8601 timestamp — serves as both unique key and sort key */
  timestamp: string;
  opType: HistoryOpType;
  trigger: HistoryTrigger;
  outcome: HistoryOutcome;
  /** Sync-specific fields (present when opType="sync") */
  version?: string;
  candidates?: number;
  added?: number;
  removed?: number;
  managedAfter?: number;
  preserved?: number;
  dryRun?: boolean;
  /** Remove-specific fields (present when opType="remove") */
  removedCount?: number;
  preservedCount?: number;
  totalAfter?: number;
  /** Error fields (present when outcome="error") */
  errorType?: string;
  errorMessage?: string;
}
