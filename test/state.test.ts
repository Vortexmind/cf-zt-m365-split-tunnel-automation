import { describe, it, expect, vi } from "vitest";
import { loadPaused, savePaused } from "../src/state";

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

describe("loadPaused", () => {
  it("returns false when KV key is absent (null)", async () => {
    const kv = createMockKv();
    const result = await loadPaused(kv);
    expect(result).toBe(false);
  });

  it('returns true when KV key is "true"', async () => {
    const kv = createMockKv({ "m365:paused": "true" });
    const result = await loadPaused(kv);
    expect(result).toBe(true);
  });

  it("returns false when KV key is any other value", async () => {
    const kv = createMockKv({ "m365:paused": "false" });
    const result = await loadPaused(kv);
    expect(result).toBe(false);
  });
});

describe("savePaused", () => {
  it("calls kv.put with m365:paused and true when paused is true", async () => {
    const kv = createMockKv();
    await savePaused(kv, true);
    expect(kv.put).toHaveBeenCalledWith("m365:paused", "true");
  });

  it("calls kv.delete with m365:paused when paused is false", async () => {
    const kv = createMockKv();
    await savePaused(kv, false);
    expect(kv.delete).toHaveBeenCalledWith("m365:paused");
  });
});
