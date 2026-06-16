import { Config } from "../config";
import { RemoveResult, HistoryEntry } from "../types";
import { partitionEntries } from "../reconcile";
import { getAllExcludeEntries, putExcludeEntries, PermissionError, CfApiError } from "../cloudflare/client";
import { saveState, appendHistory } from "../state";

export async function executeRemove(
  kv: KVNamespace,
  config: Config
): Promise<RemoveResult> {
  const persistError = async (type: string, message: string) => {
    await saveState(kv, {
      lastError: { type, message, timestamp: new Date().toISOString() },
    });
  };

  let currentEntries;
  try {
    currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);
  } catch (err) {
    if (err instanceof PermissionError) {
      await persistError("permission_denied", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "permission_denied", errorMessage: err.message });
      return buildErrorResult(err.message);
    }
    if (err instanceof CfApiError) {
      console.log(JSON.stringify({ event: "remove.error", step: "getAllExcludeEntries", error: err.message }));
      await persistError("cf_api", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "cf_api", errorMessage: err.message });
      return buildErrorResult(err.message);
    }
    console.log(JSON.stringify({ event: "remove.error", step: "getAllExcludeEntries", error: String(err) }));
    await persistError("cf_unknown", String(err));
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "cf_unknown", errorMessage: String(err) });
    return buildErrorResult(`Get exclude entries failed: ${String(err)}`);
  }

  const { preserved, managed } = partitionEntries(currentEntries, config.managedTag);
  console.log(JSON.stringify({ event: "remove.partition", managed: managed.length, preserved: preserved.length }));

  if (managed.length === 0) {
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "skipped" });
    return {
      removed: 0,
      preserved: preserved.length,
      totalAfter: preserved.length,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    await putExcludeEntries(config.accountId, config.policyId, config.apiToken, preserved);
  } catch (err) {
    if (err instanceof PermissionError) {
      await persistError("permission_denied", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "permission_denied", errorMessage: err.message });
      return buildErrorResult(err.message);
    }
    if (err instanceof CfApiError) {
      console.log(JSON.stringify({ event: "remove.error", step: "putExcludeEntries", error: err.message }));
      await persistError("cf_api", err.message);
      await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "cf_api", errorMessage: err.message });
      return buildErrorResult(err.message);
    }
    console.log(JSON.stringify({ event: "remove.error", step: "putExcludeEntries", error: String(err) }));
    await persistError("cf_unknown", String(err));
    await appendHistory(kv, { timestamp: new Date().toISOString(), opType: "remove", trigger: "manual", outcome: "error", errorType: "cf_unknown", errorMessage: String(err) });
    return buildErrorResult(`PUT exclude entries failed: ${String(err)}`);
  }

  // Reset lastVersion so next sync will re-fetch from M365
  await saveState(kv, {
    lastVersion: "0000000000",
    lastSyncedAt: "",
    lastError: undefined,
  });

  await appendHistory(kv, {
    timestamp: new Date().toISOString(),
    opType: "remove",
    trigger: "manual",
    outcome: "success",
    removedCount: managed.length,
    preservedCount: preserved.length,
    totalAfter: preserved.length,
  });

  console.log(JSON.stringify({ event: "remove.complete", removed: managed.length, preserved: preserved.length }));

  return {
    removed: managed.length,
    preserved: preserved.length,
    totalAfter: preserved.length,
    timestamp: new Date().toISOString(),
  };
}

function buildErrorResult(errorMessage: string): RemoveResult {
  return {
    removed: 0,
    preserved: 0,
    totalAfter: 0,
    timestamp: new Date().toISOString(),
    error: errorMessage,
  };
}
