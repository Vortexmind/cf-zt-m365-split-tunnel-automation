import { SyncState, SyncResult } from "./types";

const KV_KEYS = {
  CLIENT_REQUEST_ID: "m365:clientRequestId",
  LAST_VERSION: "m365:lastVersion",
  LAST_SYNCED_AT: "m365:lastSyncedAt",
  LAST_RESULT_SUMMARY: "m365:lastResultSummary",
  LAST_ERROR: "m365:lastError",
  PAUSED: "m365:paused",
} as const;

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadState(kv: KVNamespace): Promise<SyncState> {
  const [clientRequestId, lastVersion, lastSyncedAt, lastResultSummaryRaw, lastErrorRaw] =
    await Promise.all([
      kv.get(KV_KEYS.CLIENT_REQUEST_ID),
      kv.get(KV_KEYS.LAST_VERSION),
      kv.get(KV_KEYS.LAST_SYNCED_AT),
      kv.get(KV_KEYS.LAST_RESULT_SUMMARY),
      kv.get(KV_KEYS.LAST_ERROR),
    ]);

  const lastResultSummary = safeParseJson<SyncResult | undefined>(lastResultSummaryRaw, undefined);
  const lastError = safeParseJson<SyncState["lastError"]>(lastErrorRaw, undefined);

  return {
    clientRequestId: clientRequestId ?? "",
    lastVersion: lastVersion ?? "0000000000",
    lastSyncedAt: lastSyncedAt ?? "",
    lastResultSummary,
    lastError,
  };
}

export async function saveState(
  kv: KVNamespace,
  updates: Partial<SyncState>
): Promise<void> {
  const ops: Promise<void>[] = [];

  if (updates.clientRequestId !== undefined) {
    ops.push(kv.put(KV_KEYS.CLIENT_REQUEST_ID, updates.clientRequestId));
  }

  if (updates.lastVersion !== undefined) {
    ops.push(kv.put(KV_KEYS.LAST_VERSION, updates.lastVersion));
  }

  if (updates.lastSyncedAt !== undefined) {
    ops.push(kv.put(KV_KEYS.LAST_SYNCED_AT, updates.lastSyncedAt));
  }

  if (updates.lastResultSummary !== undefined) {
    ops.push(
      kv.put(KV_KEYS.LAST_RESULT_SUMMARY, JSON.stringify(updates.lastResultSummary))
    );
  }

  if ("lastError" in updates) {
    if (updates.lastError === undefined) {
      ops.push(kv.delete(KV_KEYS.LAST_ERROR));
    } else {
      ops.push(kv.put(KV_KEYS.LAST_ERROR, JSON.stringify(updates.lastError)));
    }
  }

  await Promise.all(ops);
}

export async function loadPaused(kv: KVNamespace): Promise<boolean> {
  const value = await kv.get(KV_KEYS.PAUSED);
  return value === "true";
}

export async function savePaused(kv: KVNamespace, paused: boolean): Promise<void> {
  if (paused) {
    await kv.put(KV_KEYS.PAUSED, "true");
  } else {
    await kv.delete(KV_KEYS.PAUSED);
  }
}

export function generateClientRequestId(): string {
  return crypto.randomUUID();
}
