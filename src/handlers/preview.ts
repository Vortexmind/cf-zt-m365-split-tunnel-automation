import { Config } from "../config";
import { SplitTunnelEntry, CandidateEntry } from "../types";
import { fetchAndTransformEndpoints } from "../m365/fetch-and-transform";
import { getAllExcludeEntries } from "../cloudflare/client";
import { reconcile } from "../reconcile";

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

function toEnrichedSummary(
  entry: SplitTunnelEntry,
  candidateLookup: Map<string, CandidateEntry>
): { key: string; type: "address" | "host"; description: string; serviceArea?: string; required?: boolean; notes?: string } {
  const key = "address" in entry ? entry.address : entry.host;
  const type: "address" | "host" = "address" in entry ? "address" : "host";
  const candidate = candidateLookup.get(key);
  return {
    key,
    type,
    description: entry.description ?? "",
    serviceArea: candidate?.serviceArea,
    required: candidate?.required,
    notes: candidate?.notes,
  };
}

export async function executePreview(
  kv: KVNamespace,
  config: Config
): Promise<PreviewResult> {
  const { version, versionWarning, candidates } = await fetchAndTransformEndpoints(kv, config);

  const currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);

  const reconcileResult = reconcile(currentEntries, candidates, config.managedTag);

  const candidateLookup = new Map(candidates.map(c => [c.key, c]));
  const added = reconcileResult.added.map(e => toEnrichedSummary(e, candidateLookup));
  const removed = reconcileResult.removed.map(e => toEnrichedSummary(e, candidateLookup));

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
