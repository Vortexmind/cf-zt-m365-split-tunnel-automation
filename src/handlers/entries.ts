import { Config } from "../config";
import { EntriesResult } from "../types";
import { partitionEntries } from "../reconcile";
import { getAllExcludeEntries, PermissionError, CfApiError } from "../cloudflare/client";

export async function executeEntries(
  config: Config
): Promise<EntriesResult> {
  let currentEntries;
  try {
    currentEntries = await getAllExcludeEntries(config.accountId, config.policyId, config.apiToken);
  } catch (err) {
    if (err instanceof PermissionError) {
      throw err;
    }
    if (err instanceof CfApiError) {
      console.log(JSON.stringify({ event: "entries.error", step: "getAllExcludeEntries", error: err.message }));
      throw err;
    }
    console.log(JSON.stringify({ event: "entries.error", step: "getAllExcludeEntries", error: String(err) }));
    throw err;
  }

  const { preserved, managed } = partitionEntries(currentEntries, config.managedTag);

  return {
    managed,
    preserved,
    managedCount: managed.length,
    preservedCount: preserved.length,
    totalCount: currentEntries.length,
  };
}
