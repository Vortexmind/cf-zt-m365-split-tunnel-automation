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
  description: string;
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
  added: Array<{ key: string; type: "address" | "host"; description: string }>;
  removed: Array<{ key: string; type: "address" | "host"; description: string }>;
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
