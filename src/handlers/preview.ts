import { Config } from "../config";
import { SplitTunnelEntry } from "../types";
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
  versionWarning?: string;
}

function toSummary(entry: SplitTunnelEntry): { key: string; type: "address" | "host"; description: string } {
  if ("address" in entry) {
    return { key: entry.address, type: "address", description: entry.description ?? "" };
  }
  return { key: entry.host, type: "host", description: entry.description ?? "" };
}

export async function executePreview(
  kv: KVNamespace,
  config: Config
): Promise<PreviewResult> {
  let state = await loadState(kv);

  if (!state.clientRequestId) {
    state = {
      ...state,
      clientRequestId: generateClientRequestId(),
    };
    await saveState(kv, { clientRequestId: state.clientRequestId });
  }

  let version: string;
  let versionWarning: string | undefined;
  try {
    version = await fetchLatestVersion(config.m365Instance, state.clientRequestId);
  } catch (err) {
    version = state.lastVersion;
    versionWarning = `Version check failed: ${String(err)}`;
  }

  const endpointSets = await fetchEndpoints(
    config.m365Instance,
    state.clientRequestId,
    { serviceAreas: config.m365Services, noIpv6: config.m365NoIpv6 }
  );

  const candidates = transformEndpoints(endpointSets, {
    services: config.m365Services,
    categories: config.m365Categories,
    includeIpv6: config.includeIpv6,
    includeUrls: config.includeUrls,
    managedTag: config.managedTag,
  });

  const currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);

  const reconcileResult = reconcile(currentEntries, candidates, config.managedTag);

  const added = reconcileResult.added.map(toSummary);
  const removed = reconcileResult.removed.map(toSummary);

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
    ...(versionWarning ? { versionWarning } : {}),
  };
}
