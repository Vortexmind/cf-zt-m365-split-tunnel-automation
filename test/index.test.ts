import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";

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

function createEnv(kvOverrides: Record<string, string> = {}, envOverrides: Partial<Env> = {}) {
  return {
    STATE: createMockKv(kvOverrides),
    CF_ACCOUNT_ID: "test-account-id",
    CF_API_TOKEN: "test-api-token",
    CF_POLICY_ID: "",
    ACCESS_TEAM_DOMAIN: "dev",
    ACCESS_POLICY_AUD: "dev",
    M365_INSTANCE: "Worldwide",
    M365_SERVICES: "all",
    M365_CATEGORIES: "Optimize",
    INCLUDE_IPV6: "true",
    INCLUDE_URLS: "true",
    MANAGED_TAG: "[m365-auto]",
    DRY_RUN: "true",
    MAX_ENTRIES: "1000",
    ...envOverrides,
  } as Env;
}

function makeRequest(path: string, options: RequestInit = {}): Request {
  return new Request(new URL(path, "http://localhost"), options);
}

describe("fetch handler - auth enforcement", () => {
  it("GET /healthz returns 200 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/healthz"), env);
    expect(res.status).toBe(200);
  });

  it("GET /api/status returns 401 when ACCESS_POLICY_AUD is not 'dev' and no token is present", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/status"), env);
    expect(res.status).toBe(401);
  });

  it("GET /api/preview returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/preview"), env);
    expect(res.status).toBe(401);
  });

  it("POST /api/sync returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(
      makeRequest("/api/sync", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/schedule returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/schedule"), env);
    expect(res.status).toBe(401);
  });

  it("POST /api/schedule returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(
      makeRequest("/api/schedule", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("DELETE /api/managed returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(
      makeRequest("/api/managed", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/entries returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/entries"), env);
    expect(res.status).toBe(401);
  });

  it("returns 500 when ACCESS_TEAM_DOMAIN and ACCESS_POLICY_AUD are missing", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_POLICY_AUD: "",
    });
    const res = await worker.fetch!(makeRequest("/api/status"), env);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Server configuration error");
  });

  it("dev sentinel bypasses auth for /api/status", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/status"), env);
    expect(res.status).toBe(200);
  });

  it("dev sentinel does not bypass auth when only ACCESS_POLICY_AUD is dev", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "dev",
    });
    const res = await worker.fetch!(makeRequest("/api/status"), env);
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid JWT token", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(
      makeRequest("/api/status", {
        headers: { "cf-access-jwt-assertion": "invalid.jwt.token" },
      }),
      env
    );
    expect(res.status).toBe(401);
  });
});

describe("fetch handler - routes with auth", () => {
  it("GET /api/schedule returns cron and paused state", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule"),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      paused: false,
    });
  });

  it("POST /api/schedule with paused=true persists to KV and returns updated state", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: true }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      paused: true,
    });
    expect(env.STATE.put).toHaveBeenCalledWith("m365:paused", "true");
  });

  it("POST /api/schedule with paused=false deletes from KV and returns updated state", async () => {
    const env = createEnv({ "m365:paused": "true" });
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: false }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      paused: false,
    });
    expect(env.STATE.delete).toHaveBeenCalledWith("m365:paused");
  });

  it("POST /api/schedule with empty body returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Missing required field: paused");
  });

  it("POST /api/schedule with missing paused field returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other: true }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Missing required field: paused");
  });

  it("GET /unknown returns 404", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/unknown"),
      env
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/status returns data when auth'd and KV has state", async () => {
    const env = createEnv({
      "m365:clientRequestId": "req-123",
      "m365:lastVersion": "1234567890",
      "m365:lastSyncedAt": "2026-01-01T00:00:00Z",
    });
    const res = await worker.fetch!(
      makeRequest("/api/status"),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.clientRequestId).toBe("req-123");
    expect(body.lastVersion).toBe("1234567890");
    expect(body.lastSyncedAt).toBe("2026-01-01T00:00:00Z");
  });
});

describe("fetch handler - config-status", () => {
  it("GET /api/config-status returns accessConfigured: true with real Access vars", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/config-status"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessConfigured).toBe(true);
  });

  it("GET /api/config-status returns accessConfigured: false with dev sentinel", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/config-status"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessConfigured).toBe(false);
  });

  it("GET /api/config-status returns accessConfigured: false with empty Access vars", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_POLICY_AUD: "",
    });
    const res = await worker.fetch!(makeRequest("/api/config-status"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessConfigured).toBe(false);
  });

  it("GET /api/config-status returns accessConfigured: false when only ACCESS_POLICY_AUD is set", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/config-status"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessConfigured).toBe(false);
  });
});

describe("fetch handler - services", () => {
  it("GET /api/services returns null when no KV value set", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/services"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.services).toBeNull();
  });

  it("GET /api/services returns saved services from KV", async () => {
    const env = createEnv({ "m365:services": JSON.stringify(["Exchange", "SharePoint"]) });
    const res = await worker.fetch!(makeRequest("/api/services"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.services).toEqual(["Exchange", "SharePoint"]);
  });

  it("POST /api/services saves services and returns them", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: ["Exchange"] }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.services).toEqual(["Exchange"]);
    expect(env.STATE.put).toHaveBeenCalledWith("m365:services", JSON.stringify(["Exchange"]));
  });

  it("POST /api/services with null saves all-services selection", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: null }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.services).toBeNull();
    expect(env.STATE.put).toHaveBeenCalledWith("m365:services", "null");
  });

  it("POST /api/services with invalid service name returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: ["InvalidService"] }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("POST /api/services with missing field returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/services returns 401 without auth", async () => {
    const env = createEnv({}, {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_POLICY_AUD: "real-aud-tag",
    });
    const res = await worker.fetch!(makeRequest("/api/services"), env);
    expect(res.status).toBe(401);
  });
});

describe("scheduled handler", () => {
  it("skips sync and logs when paused", async () => {
    const env = createEnv({ "m365:paused": "true" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const controller = {
      scheduledTime: Date.now(),
      cron: "17 6 * * *",
      noRetry() {},
    } as ScheduledController;

    await worker.scheduled!(controller, env);

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "scheduled.skipped", reason: "paused" })
    );

    logSpy.mockRestore();
  });

  it("saves cron to KV on first invocation even when paused", async () => {
    const env = createEnv({ "m365:paused": "true" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const controller = {
      scheduledTime: Date.now(),
      cron: "17 6 * * *",
      noRetry() {},
    } as ScheduledController;

    await worker.scheduled!(controller, env);

    expect(env.STATE.put).toHaveBeenCalledWith("m365:cron", "17 6 * * *");

    logSpy.mockRestore();
  });

  it("does not overwrite existing cron in KV", async () => {
    const env = createEnv({ "m365:paused": "true", "m365:cron": "30 8 * * *" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const controller = {
      scheduledTime: Date.now(),
      cron: "17 6 * * *",
      noRetry() {},
    } as ScheduledController;

    await worker.scheduled!(controller, env);

    // Should NOT have called put with m365:cron since it already exists
    const cronPutCalls = (env.STATE.put as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: string[]) => call[0] === "m365:cron"
    );
    expect(cronPutCalls).toHaveLength(0);

    logSpy.mockRestore();
  });

  it("proceeds with sync when not paused", async () => {
    const env = createEnv();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const controller = {
      scheduledTime: Date.now(),
      cron: "17 6 * * *",
      noRetry() {},
    } as ScheduledController;

    await worker.scheduled!(controller, env);

    const skipCall = logSpy.mock.calls.find(
      (call) => call[0]?.includes?.("scheduled.skipped")
    );
    expect(skipCall).toBeUndefined();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("fetch handler - settings", () => {
  it("GET /api/settings returns defaults when no KV override", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/settings"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.includeIpv6).toEqual({ value: true, source: "env" });
    expect(body.maxEntries).toEqual({ value: 1000, source: "env" });
  });

  it("GET /api/settings returns KV overrides with source 'kv'", async () => {
    const env = createEnv({ "m365:settings": JSON.stringify({ dryRun: true, includeIpv6: false }) });
    const res = await worker.fetch!(makeRequest("/api/settings"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.dryRun).toEqual({ value: true, source: "kv" });
    expect(body.includeIpv6).toEqual({ value: false, source: "kv" });
  });

  it("POST /api/settings saves and returns updated settings", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeIpv6: false }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.includeIpv6).toEqual({ value: false, source: "kv" });
    expect(body.dryRun).toEqual({ value: true, source: "env" });
    expect(env.STATE.put).toHaveBeenCalledWith("m365:settings", JSON.stringify({ includeIpv6: false }));
  });

  it("POST /api/settings with invalid m365Instance returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m365Instance: "Invalid" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Invalid M365 instance");
  });

  it("POST /api/settings with invalid m365Categories returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m365Categories: "Invalid" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Invalid M365 categories");
  });

  it("POST /api/settings with invalid maxEntries (negative) returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxEntries: -1 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/settings with invalid maxEntries (non-integer) returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxEntries: 1.5 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/settings with null value reverts to env/default", async () => {
    const env = createEnv({ "m365:settings": JSON.stringify({ includeIpv6: false }) });
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeIpv6: null }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.includeIpv6).toEqual({ value: true, source: "env" });
  });

  it("POST /api/settings with empty body {} clears all overrides", async () => {
    const env = createEnv({ "m365:settings": JSON.stringify({ dryRun: true, includeIpv6: false }) });
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const sources = Object.values(body).map(
      (v) => (v as { source: string }).source
    );
    expect(sources).not.toContain("kv");
  });

  it("POST /api/settings with cfPolicyId saves and returns it", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfPolicyId: "test-policy-id" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cfPolicyId).toEqual({ value: "test-policy-id", source: "kv" });
  });

  it("POST /api/settings with cfPolicyId empty string clears the override", async () => {
    // First set a cfPolicyId
    const env = createEnv({ "m365:settings": JSON.stringify({ cfPolicyId: "test-policy-id" }) });
    // Then clear it
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfPolicyId: "" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cfPolicyId).toEqual({ value: "", source: "default" });
  });

  it("POST /api/settings with invalid cfPolicyId type returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfPolicyId: 123 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});
