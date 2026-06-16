import { Config } from "../config";
import { SyncResult, SyncState, HistoryTrigger, HistoryEntry } from "../types";
import { loadState, saveState, appendHistory } from "../state";
import { RateLimitError } from "../m365/client";
import { fetchAndTransformEndpoints } from "../m365/fetch-and-transform";
import { getAllExcludeEntries, putExcludeEntries, PermissionError, CfApiError } from "../cloudflare/client";
import { reconcile } from "../reconcile";

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  trigger?: HistoryTrigger;
}

export async function executeSync(
  kv: KVNamespace,
  config: Config,
  options?: SyncOptions
): Promise<SyncResult> {
  const force = options?.force ?? false;
  const isDryRun = options?.dryRun ?? config.dryRun;
  const trigger: HistoryTrigger = options?.trigger ?? "manual";

  const persistError = async (type: string, message: string) => {
    await saveState(kv, {
      lastError: { type, message, timestamp: new Date().toISOString() },
    });
  };

  let state: SyncState;
  try {
    state = await loadState(kv);
  } catch (err) {
    console.log(JSON.stringify({ event: "sync.error", step: "loadState", error: String(err) }));
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "load_state", errorMessage: "Failed to load state" });
    return buildErrorResult("Failed to load state", isDryRun);
  }

  let fetchResult;
  try {
    fetchResult = await fetchAndTransformEndpoints(kv, config, {
      useCache: false,
      skipIfUpToDate: force ? undefined : state.lastVersion,
      throwOnRateLimit: true,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.log(JSON.stringify({ event: "sync.error", step: "rateLimit", error: err.message }));
      await persistError("rate_limit", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "rate_limit", errorMessage: err.message });
      return buildErrorResult(err.message, isDryRun);
    }
    console.log(JSON.stringify({ event: "sync.error", step: "fetchEndpoints", error: String(err) }));
    await persistError("fetch_endpoints", String(err));
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "fetch_endpoints", errorMessage: String(err) });
    return buildErrorResult(`Fetch endpoints failed: ${String(err)}`, isDryRun);
  }

  if (fetchResult.skipped) {
    console.log(JSON.stringify({ event: "sync.start", latest: fetchResult.version, lastVersion: state.lastVersion, force }));
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
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "skipped", version: state.lastVersion });
    return upToDateResult;
  }

  const { version: latestVersion, candidates, versionWarning } = fetchResult;
  console.log(JSON.stringify({ event: "sync.start", latest: latestVersion, lastVersion: state.lastVersion, force }));
  if (versionWarning) {
    console.log(JSON.stringify({ event: "sync.versionWarning", warning: versionWarning }));
  }
  console.log(JSON.stringify({ event: "sync.transform", candidateCount: candidates.length }));

  let currentEntries;
  try {
    currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);
  } catch (err) {
    if (err instanceof PermissionError) {
      await persistError("permission_denied", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "permission_denied", errorMessage: err.message });
      return buildErrorResult(err.message, isDryRun);
    }
    if (err instanceof CfApiError) {
      console.log(JSON.stringify({ event: "sync.error", step: "getAllExcludeEntries", error: err.message }));
      await persistError("cf_api", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "cf_api", errorMessage: err.message });
      return buildErrorResult(err.message, isDryRun);
    }
    console.log(JSON.stringify({ event: "sync.error", step: "getAllExcludeEntries", error: String(err) }));
    await persistError("cf_unknown", String(err));
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "cf_unknown", errorMessage: String(err) });
    return buildErrorResult(`Get exclude entries failed: ${String(err)}`, isDryRun);
  }

  const reconcileResult = reconcile(currentEntries, candidates, config.managedTag);
  console.log(JSON.stringify({
    event: "sync.reconcile",
    added: reconcileResult.added.length,
    removed: reconcileResult.removed.length,
    preserved: reconcileResult.preserved.length,
    managedBefore: reconcileResult.managedBefore.length,
    managedAfter: reconcileResult.managedAfter.length,
  }));

  if (reconcileResult.merged.length > config.maxEntries) {
    console.log(JSON.stringify({
      event: "sync.warning",
      message: "Entry count exceeds maxEntries, aborting sync",
      total: reconcileResult.merged.length,
      maxEntries: config.maxEntries,
    }));
    await persistError("max_entries_exceeded", `Merged list (${reconcileResult.merged.length}) exceeds maxEntries (${config.maxEntries})`);
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "max_entries_exceeded", errorMessage: `Merged list (${reconcileResult.merged.length}) exceeds maxEntries (${config.maxEntries})` });
    return buildErrorResult(
      `Merged list (${reconcileResult.merged.length}) exceeds maxEntries (${config.maxEntries}). Sync aborted.`,
      isDryRun
    );
  }

  if (!isDryRun && reconcileResult.hasChanges) {
    try {
      await putExcludeEntries(config.accountId, config.policyId, config.apiToken, reconcileResult.merged);
    } catch (err) {
      if (err instanceof PermissionError) {
        await persistError("permission_denied", err.message);
        await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "permission_denied", errorMessage: err.message });
        return buildErrorResult(err.message, isDryRun);
      }
      if (err instanceof CfApiError) {
        console.log(JSON.stringify({ event: "sync.error", step: "putExcludeEntries", error: err.message }));
        await persistError("cf_api", err.message);
        await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "cf_api", errorMessage: err.message });
        return buildErrorResult(err.message, isDryRun);
      }
      console.log(JSON.stringify({ event: "sync.error", step: "putExcludeEntries", error: String(err) }));
      await persistError("cf_unknown", String(err));
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "sync", trigger, outcome: "error", errorType: "cf_unknown", errorMessage: String(err) });
      return buildErrorResult(`PUT exclude entries failed: ${String(err)}`, isDryRun);
    }
  }

  const newVersion = latestVersion ?? state.lastVersion;

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

  const stateUpdates: Partial<SyncState> = {
    lastResultSummary: result,
  };
  if (!isDryRun) {
    stateUpdates.lastVersion = newVersion;
    stateUpdates.lastSyncedAt = result.timestamp;
    stateUpdates.lastError = undefined;
  }
  await saveState(kv, stateUpdates);

  await appendHistory(kv, {
    timestamp: result.timestamp,
    opType: "sync",
    trigger,
    outcome: isDryRun && reconcileResult.hasChanges ? "dry_run" : "success",
    version: newVersion,
    candidates: candidates.length,
    added: reconcileResult.added.length,
    removed: reconcileResult.removed.length,
    managedAfter: reconcileResult.managedAfter.length,
    preserved: reconcileResult.preserved.length,
    dryRun: isDryRun,
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
