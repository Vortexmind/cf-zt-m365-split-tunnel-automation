import { describe, it, expect, vi } from "vitest";
import { loadHistory, appendHistory } from "../src/state";
import type { HistoryEntry } from "../src/types";

function createMockKv(stored: Record<string, string> = {}) {
  const store = { ...stored };
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    delete: vi.fn(async (key: string) => {
      delete store[key];
    }),
  } as unknown as KVNamespace;
}

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    opType: "sync",
    trigger: "manual",
    outcome: "success",
    ...overrides,
  };
}

describe("loadHistory", () => {
  it("returns empty array when KV key is absent", async () => {
    const kv = createMockKv();
    const result = await loadHistory(kv);
    expect(result).toEqual([]);
  });

  it("returns parsed entries from KV", async () => {
    const entries = [makeEntry({ timestamp: "2026-06-16T10:00:00.000Z" })];
    const kv = createMockKv({ "m365:history": JSON.stringify(entries) });
    const result = await loadHistory(kv);
    expect(result).toEqual(entries);
  });

  it("returns empty array when KV value is corrupt JSON", async () => {
    const kv = createMockKv({ "m365:history": "not-json" });
    const result = await loadHistory(kv);
    expect(result).toEqual([]);
  });
});

describe("appendHistory", () => {
  it("creates a new history list when KV is empty", async () => {
    const kv = createMockKv();
    const entry = makeEntry();
    await appendHistory(kv, entry);
    const stored = await loadHistory(kv);
    expect(stored).toEqual([entry]);
  });

  it("prepends the new entry (newest first)", async () => {
    const older = makeEntry({ timestamp: "2026-06-15T10:00:00.000Z" });
    const kv = createMockKv({ "m365:history": JSON.stringify([older]) });
    const newer = makeEntry({ timestamp: "2026-06-16T10:00:00.000Z" });
    await appendHistory(kv, newer);
    const stored = await loadHistory(kv);
    expect(stored[0]).toEqual(newer);
    expect(stored[1]).toEqual(older);
  });

  it("prunes entries older than 30 days", async () => {
    const now = Date.now();
    const oldEntry = makeEntry({ timestamp: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString() });
    const recentEntry = makeEntry({ timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() });
    const kv = createMockKv({ "m365:history": JSON.stringify([oldEntry, recentEntry]) });
    const newEntry = makeEntry({ timestamp: new Date(now).toISOString() });
    await appendHistory(kv, newEntry);
    const stored = await loadHistory(kv);
    expect(stored).toHaveLength(2); // new + recent, old pruned
    expect(stored[0].timestamp).toBe(newEntry.timestamp);
    expect(stored[1].timestamp).toBe(recentEntry.timestamp);
  });

  it("keeps entries exactly at the 30-day boundary", async () => {
    const now = Date.now();
    const boundaryEntry = makeEntry({ timestamp: new Date(now - 30 * 24 * 60 * 60 * 1000 + 1000).toISOString() }); // just inside
    const kv = createMockKv({ "m365:history": JSON.stringify([boundaryEntry]) });
    const newEntry = makeEntry({ timestamp: new Date(now).toISOString() });
    await appendHistory(kv, newEntry);
    const stored = await loadHistory(kv);
    expect(stored).toHaveLength(2);
  });

  it("caps at 1000 entries", async () => {
    const entries = Array.from({ length: 1001 }, (_, i) =>
      makeEntry({ timestamp: new Date(Date.now() - i * 60 * 1000).toISOString() })
    );
    const kv = createMockKv({ "m365:history": JSON.stringify(entries) });
    const newEntry = makeEntry();
    await appendHistory(kv, newEntry);
    const stored = await loadHistory(kv);
    expect(stored).toHaveLength(1000);
    expect(stored[0]).toEqual(newEntry);
  });
});
