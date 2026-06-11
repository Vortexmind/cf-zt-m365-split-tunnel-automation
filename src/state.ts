import { SyncState, SyncResult } from "./types";

const KV_KEYS = {
  CLIENT_REQUEST_ID: "m365:clientRequestId",
  LAST_VERSION: "m365:lastVersion",
  LAST_SYNCED_AT: "m365:lastSyncedAt",
  LAST_RESULT_SUMMARY: "m365:lastResultSummary",
  LAST_ERROR: "m365:lastError",
} as const;

/**
 * Load the current sync state from KV.
 * Returns default state if no prior state exists.
 */
export async function loadState(kv: KVNamespace): Promise<SyncState> {
  const [clientRequestId, lastVersion, lastSyncedAt, lastResultSummaryRaw, lastErrorRaw] =
    await Promise.all([
      kv.get(KV_KEYS.CLIENT_REQUEST_ID),
      kv.get(KV_KEYS.LAST_VERSION),
      kv.get(KV_KEYS.LAST_SYNCED_AT),
      kv.get(KV_KEYS.LAST_RESULT_SUMMARY),
      kv.get(KV_KEYS.LAST_ERROR),
    ]);

  let lastResultSummary: SyncResult | undefined;
  if (lastResultSummaryRaw) {
    lastResultSummary = JSON.parse(lastResultSummaryRaw) as SyncResult;
  }

  let lastError: SyncState["lastError"];
  if (lastErrorRaw) {
    lastError = JSON.parse(lastErrorRaw) as SyncState["lastError"];
  }

  return {
    clientRequestId: clientRequestId ?? "",
    lastVersion: lastVersion ?? "0000000000",
    lastSyncedAt: lastSyncedAt ?? "",
    lastResultSummary,
    lastError,
  };
}

/**
 * Save the sync state to KV.
 * Only updates the provided fields; other fields are preserved.
 */
export async function saveState(
  kv: KVNamespace,
  updates: Partial<SyncState>
): Promise<void> {
  const writes: Promise<void>[] = [];

  if (updates.clientRequestId !== undefined) {
    writes.push(kv.put(KV_KEYS.CLIENT_REQUEST_ID, updates.clientRequestId));
  }

  if (updates.lastVersion !== undefined) {
    writes.push(kv.put(KV_KEYS.LAST_VERSION, updates.lastVersion));
  }

  if (updates.lastSyncedAt !== undefined) {
    writes.push(kv.put(KV_KEYS.LAST_SYNCED_AT, updates.lastSyncedAt));
  }

  if (updates.lastResultSummary !== undefined) {
    writes.push(
      kv.put(KV_KEYS.LAST_RESULT_SUMMARY, JSON.stringify(updates.lastResultSummary))
    );
  }

  if (updates.lastError !== undefined) {
    writes.push(kv.put(KV_KEYS.LAST_ERROR, JSON.stringify(updates.lastError)));
  }

  await Promise.all(writes);
}

/**
 * Generate a new clientRequestId (UUID v4) for first-run.
 * Uses crypto.randomUUID() available in Workers runtime.
 */
export function generateClientRequestId(): string {
  return crypto.randomUUID();
}
