import { describe, it, expect, vi } from "vitest";
import { loadPaused, savePaused, loadServices, saveServices, loadSettings, saveSettings } from "../src/state";

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

describe("loadServices / saveServices", () => {
  it("returns undefined when KV key is absent", async () => {
    const kv = createMockKv({});
    const result = await loadServices(kv);
    expect(result).toBeUndefined();
  });

  it("returns null when KV value is the string 'null' (user chose all services)", async () => {
    const kv = createMockKv({ "m365:services": "null" });
    const result = await loadServices(kv);
    expect(result).toBeNull();
  });

  it("returns parsed array when KV contains a JSON array", async () => {
    const kv = createMockKv({ "m365:services": JSON.stringify(["Exchange", "SharePoint"]) });
    const result = await loadServices(kv);
    expect(result).toEqual(["Exchange", "SharePoint"]);
  });

  it("returns null (safeParseJson fallback) when KV contains corrupt JSON", async () => {
    const kv = createMockKv({ "m365:services": "not-valid-json{" });
    const result = await loadServices(kv);
    expect(result).toBeNull();
  });

  it("saveServices with null stores the literal string 'null'", async () => {
    const kv = createMockKv({});
    await saveServices(kv, null);
    expect(kv.put).toHaveBeenCalledWith("m365:services", "null");
  });

  it("saveServices with string array stores JSON", async () => {
    const kv = createMockKv({});
    await saveServices(kv, ["Skype"]);
    expect(kv.put).toHaveBeenCalledWith("m365:services", JSON.stringify(["Skype"]));
  });

  it("saveServices with empty array stores empty JSON array", async () => {
    const kv = createMockKv({});
    await saveServices(kv, []);
    expect(kv.put).toHaveBeenCalledWith("m365:services", JSON.stringify([]));
  });
});

describe("loadSettings / saveSettings", () => {
  it("returns undefined when KV key is absent", async () => {
    const kv = createMockKv({});
    const result = await loadSettings(kv);
    expect(result).toBeUndefined();
  });

  it("returns parsed object when KV contains valid JSON", async () => {
    const settings = { dryRun: true, maxEntries: 500 };
    const kv = createMockKv({ "m365:settings": JSON.stringify(settings) });
    const result = await loadSettings(kv);
    expect(result).toEqual(settings);
  });

  it("returns undefined when KV contains corrupt JSON", async () => {
    const kv = createMockKv({ "m365:settings": "not-valid-json{" });
    const result = await loadSettings(kv);
    expect(result).toBeUndefined();
  });

  it("saveSettings stores JSON to KV", async () => {
    const kv = createMockKv({});
    const settings = { m365Instance: "Worldwide", includeIpv6: false };
    await saveSettings(kv, settings);
    expect(kv.put).toHaveBeenCalledWith("m365:settings", JSON.stringify(settings));
  });

  it("saveSettings stores empty object as {}", async () => {
    const kv = createMockKv({});
    await saveSettings(kv, {});
    expect(kv.put).toHaveBeenCalledWith("m365:settings", "{}");
  });
});
