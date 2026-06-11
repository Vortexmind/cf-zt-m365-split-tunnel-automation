import { Config } from "../config";
import { loadState, saveState, generateClientRequestId } from "../state";
import { fetchLatestVersion, fetchEndpoints } from "../m365/client";
import { transformEndpoints } from "../m365/transform";
import { getAllExcludeEntries } from "../cloudflare/client";
import { reconcile } from "../reconcile";

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
}

/**
 * Generate a preview of what would change without writing anything.
 * Always acts as dry-run regardless of config.dryRun.
 */
export async function executePreview(
  kv: KVNamespace,
  config: Config
): Promise<PreviewResult> {
  // Load state
  let state = await loadState(kv);

  // Generate clientRequestId if not present
  if (!state.clientRequestId) {
    state = {
      ...state,
      clientRequestId: generateClientRequestId(),
    };
    await saveState(kv, { clientRequestId: state.clientRequestId });
  }

  // Fetch M365 version (always, to show current version)
  let version: string;
  try {
    version = await fetchLatestVersion(config.m365Instance, state.clientRequestId);
  } catch {
    version = state.lastVersion;
  }

  // Fetch M365 endpoints (always, even if version unchanged)
  const endpointSets = await fetchEndpoints(
    config.m365Instance,
    state.clientRequestId,
    { serviceAreas: config.m365Services, noIpv6: config.m365NoIpv6 }
  );

  // Transform to candidates
  const candidates = transformEndpoints(endpointSets, {
    services: config.m365Services,
    categories: config.m365Categories,
    includeIpv6: config.includeIpv6,
    includeUrls: config.includeUrls,
    managedTag: config.managedTag,
  });

  // Get current CF exclude list
  const currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);

  // Reconcile
  const reconcileResult = reconcile(currentEntries, candidates, config.managedTag);

  // Build detailed added/removed lists
  const added = reconcileResult.added.map((entry) => {
    if ("address" in entry) {
      return { key: entry.address, type: "address" as const, description: entry.description ?? "" };
    }
    return { key: entry.host, type: "host" as const, description: entry.description ?? "" };
  });

  const removed = reconcileResult.removed.map((entry) => {
    if ("address" in entry) {
      return { key: entry.address, type: "address" as const, description: entry.description ?? "" };
    }
    return { key: entry.host, type: "host" as const, description: entry.description ?? "" };
  });

  return {
    version,
    candidates: candidates.length,
    preserved: reconcileResult.preserved.length,
    managedBefore: reconcileResult.managedBefore.length,
    managedAfter: reconcileResult.managedAfter.length,
    added,
    removed,
    toKeep: reconcileResult.preserved.length + reconcileResult.managedAfter.length - reconcileResult.added.length,
    totalAfter: reconcileResult.merged.length,
  };
}
