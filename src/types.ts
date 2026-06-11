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
