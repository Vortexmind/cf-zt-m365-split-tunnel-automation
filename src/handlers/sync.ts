import { Config } from "../config";
import { SyncResult, SyncState } from "../types";
import { loadState, saveState, generateClientRequestId } from "../state";
import { fetchLatestVersion, fetchEndpoints, RateLimitError } from "../m365/client";
import { transformEndpoints } from "../m365/transform";
import { getAllExcludeEntries, putExcludeEntries, PermissionError, CfApiError } from "../cloudflare/client";
import { reconcile } from "../reconcile";

export interface SyncOptions {
  /** If true, skip version check and always fetch endpoints */
  force?: boolean;
  /** If true, do not PUT the result (overrides config.dryRun) */
  dryRun?: boolean;
}

/**
 * Execute the M365-to-CF split tunnel sync.
 * This is the main business logic, shared by cron and HTTP handlers.
 */
export async function executeSync(
  kv: KVNamespace,
  config: Config,
  options?: SyncOptions
): Promise<SyncResult> {
  const force = options?.force ?? false;
  const isDryRun = options?.dryRun ?? config.dryRun;

  let state: SyncState;
  try {
    state = await loadState(kv);
  } catch (err) {
    console.log(JSON.stringify({ event: "sync.error", step: "loadState", error: String(err) }));
    return buildErrorResult("Failed to load state", isDryRun);
  }

  // Generate clientRequestId if not present
  if (!state.clientRequestId) {
    state.clientRequestId = generateClientRequestId();
    await saveState(kv, { clientRequestId: state.clientRequestId });
  }

  // Version check (skip early return when forced, but still fetch version)
  let latestVersion: string | undefined;
  try {
    latestVersion = await fetchLatestVersion(config.m365Instance, state.clientRequestId);
    console.log(JSON.stringify({ event: "sync.start", latest: latestVersion, lastVersion: state.lastVersion, force }));

    if (!force && latestVersion <= state.lastVersion) {
      const upToDateResult: SyncResult = {
        version: state.lastVersion,
        services: config.m365Services ?? ["all"],
        categories: config.m365Categories,
        candidates: 0,
        managedBefore: 0,
        managedAfter: 0,
        preserved: 0,
        added: 0,
        removed: 0,
        dryRun: isDryRun,
        timestamp: new Date().toISOString(),
      };
      return upToDateResult;
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.log(JSON.stringify({ event: "sync.error", step: "versionCheck", error: err.message }));
      return buildErrorResult(err.message, isDryRun);
    }
    // Non-rate-limit version check error: if not forced, abort; if forced, continue without version
    if (!force) {
      console.log(JSON.stringify({ event: "sync.error", step: "versionCheck", error: String(err) }));
      return buildErrorResult(`Version check failed: ${String(err)}`, isDryRun);
    }
    console.log(JSON.stringify({ event: "sync.start", force: true, versionCheckError: String(err) }));
  }

  // Fetch M365 endpoints
  let endpointSets;
  try {
    endpointSets = await fetchEndpoints(
      config.m365Instance,
      state.clientRequestId,
      { serviceAreas: config.m365Services, noIpv6: config.m365NoIpv6 }
    );
    console.log(JSON.stringify({ event: "sync.fetch", endpointCount: endpointSets.length }));
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.log(JSON.stringify({ event: "sync.error", step: "fetchEndpoints", error: err.message }));
      return buildErrorResult(err.message, isDryRun);
    }
    console.log(JSON.stringify({ event: "sync.error", step: "fetchEndpoints", error: String(err) }));
    return buildErrorResult(`Fetch endpoints failed: ${String(err)}`, isDryRun);
  }

  // Transform to candidates
  const candidates = transformEndpoints(endpointSets, {
    services: config.m365Services,
    categories: config.m365Categories,
    includeIpv6: config.includeIpv6,
    includeUrls: config.includeUrls,
    managedTag: config.managedTag,
  });
  console.log(JSON.stringify({ event: "sync.transform", candidateCount: candidates.length }));

  // Get current CF exclude list
  let currentEntries;
  try {
    currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);
  } catch (err) {
    if (err instanceof PermissionError) {
      await saveState(kv, {
        lastError: { type: "permission_denied", message: err.message, timestamp: new Date().toISOString() },
      });
      return buildErrorResult(err.message, isDryRun);
    }
    if (err instanceof CfApiError) {
      console.log(JSON.stringify({ event: "sync.error", step: "getAllExcludeEntries", error: err.message }));
      return buildErrorResult(err.message, isDryRun);
    }
    console.log(JSON.stringify({ event: "sync.error", step: "getAllExcludeEntries", error: String(err) }));
    return buildErrorResult(`Get exclude entries failed: ${String(err)}`, isDryRun);
  }

  // Reconcile
  const reconcileResult = reconcile(currentEntries, candidates, config.managedTag);
  console.log(JSON.stringify({
    event: "sync.reconcile",
    added: reconcileResult.added.length,
    removed: reconcileResult.removed.length,
    preserved: reconcileResult.preserved.length,
    managedBefore: reconcileResult.managedBefore.length,
    managedAfter: reconcileResult.managedAfter.length,
  }));

  // Check entry count
  if (reconcileResult.merged.length > config.maxEntries) {
    console.log(JSON.stringify({
      event: "sync.warning",
      message: "Entry count exceeds maxEntries",
      total: reconcileResult.merged.length,
      maxEntries: config.maxEntries,
    }));
  }

  // PUT if not dry run and has changes
  if (!isDryRun && reconcileResult.hasChanges) {
    try {
      await putExcludeEntries(config.accountId, config.policyId, config.apiToken, reconcileResult.merged);
    } catch (err) {
      if (err instanceof PermissionError) {
        await saveState(kv, {
          lastError: { type: "permission_denied", message: err.message, timestamp: new Date().toISOString() },
        });
        return buildErrorResult(err.message, isDryRun);
      }
      if (err instanceof CfApiError) {
        console.log(JSON.stringify({ event: "sync.error", step: "putExcludeEntries", error: err.message }));
        return buildErrorResult(err.message, isDryRun);
      }
      console.log(JSON.stringify({ event: "sync.error", step: "putExcludeEntries", error: String(err) }));
      return buildErrorResult(`PUT exclude entries failed: ${String(err)}`, isDryRun);
    }
  }

  // Use the version from the check, falling back to last known version
  const newVersion = latestVersion ?? state.lastVersion;

  // Build SyncResult
  const result: SyncResult = {
    version: newVersion,
    services: config.m365Services ?? ["all"],
    categories: config.m365Categories,
    candidates: candidates.length,
    managedBefore: reconcileResult.managedBefore.length,
    managedAfter: reconcileResult.managedAfter.length,
    preserved: reconcileResult.preserved.length,
    added: reconcileResult.added.length,
    removed: reconcileResult.removed.length,
    dryRun: isDryRun,
    timestamp: new Date().toISOString(),
  };

  // Save state
  await saveState(kv, {
    lastVersion: newVersion,
    lastSyncedAt: result.timestamp,
    lastResultSummary: result,
  });

  console.log(JSON.stringify({ event: "sync.complete", result }));
  return result;
}

function buildErrorResult(errorMessage: string, dryRun: boolean): SyncResult {
  return {
    version: "",
    services: [],
    categories: [],
    candidates: 0,
    managedBefore: 0,
    managedAfter: 0,
    preserved: 0,
    added: 0,
    removed: 0,
    dryRun,
    timestamp: new Date().toISOString(),
    error: errorMessage,
  };
}
