import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker from "../src/index";

const WEBHOOK_SECRET = "test-secret-value-1234";

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

function createEnv(kvOverrides: Record<string, string> = {}) {
  return {
    STATE: createMockKv(kvOverrides),
    CF_ACCOUNT_ID: "test-account-id",
    CF_API_TOKEN: "test-api-token",
    CF_POLICY_ID: "",
    WEBHOOK_SECRET,
    M365_INSTANCE: "Worldwide",
    M365_SERVICES: "all",
    M365_CATEGORIES: "Optimize,Allow",
    INCLUDE_IPV6: "true",
    INCLUDE_URLS: "true",
    MANAGED_TAG: "[m365-auto]",
    DRY_RUN: "false",
    MAX_ENTRIES: "1000",
    CRON_EXPRESSION: "17 6 * * *",
    CRON_DESCRIPTION: "Daily at 06:17 UTC",
  } as Env;
}

function makeRequest(path: string, options: RequestInit = {}): Request {
  return new Request(new URL(path, "http://localhost"), options);
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${WEBHOOK_SECRET}` };
}

// Polyfill crypto.subtle.timingSafeEqual for Node.js test environment.
// The Workers runtime provides this but Node.js does not.
const originalSubtle = crypto.subtle;

beforeEach(() => {
  const nodeSubtle = crypto.subtle;
  Object.defineProperty(crypto, "subtle", {
    value: {
      ...nodeSubtle,
      timingSafeEqual(
        a: ArrayBuffer | ArrayBufferView,
        b: ArrayBuffer | ArrayBufferView
      ): boolean {
        const aBytes = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        const bBytes = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
        if (aBytes.length !== bBytes.length) return false;
        let result = 0;
        for (let i = 0; i < aBytes.length; i++) {
          result |= aBytes[i] ^ bBytes[i];
        }
        return result === 0;
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(crypto, "subtle", {
    value: originalSubtle,
    writable: true,
    configurable: true,
  });
});

describe("fetch handler - auth enforcement", () => {
  it("GET /healthz returns 200 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/healthz"), env);
    expect(res.status).toBe(200);
  });

  it("GET / returns HTML without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html");
  });

  it("GET /favicon.ico returns 404 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/favicon.ico"), env);
    expect(res.status).toBe(404);
  });

  it("GET /api/status returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/status"), env);
    expect(res.status).toBe(401);
  });

  it("GET /api/preview returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/preview"), env);
    expect(res.status).toBe(401);
  });

  it("POST /api/sync returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/sync", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/schedule returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/schedule"), env);
    expect(res.status).toBe(401);
  });

  it("POST /api/schedule returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("DELETE /api/managed returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/managed", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/entries returns 401 without auth", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/api/entries"), env);
    expect(res.status).toBe(401);
  });
});

describe("fetch handler - routes with auth", () => {
  it("GET / returns HTML with correct Content-Type and Cache-Control", async () => {
    const env = createEnv();
    const res = await worker.fetch!(makeRequest("/"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /api/schedule returns cron, description, and paused state", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", { headers: authHeaders() }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      description: "Daily at 06:17 UTC",
      paused: false,
    });
  });

  it("POST /api/schedule with paused=true persists to KV and returns updated state", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: true }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      description: "Daily at 06:17 UTC",
      paused: true,
    });
    // Verify KV was called to persist the paused state
    expect(env.STATE.put).toHaveBeenCalledWith("m365:paused", "true");
  });

  it("POST /api/schedule with paused=false deletes from KV and returns updated state", async () => {
    const env = createEnv({ "m365:paused": "true" });
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: false }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      cron: "17 6 * * *",
      description: "Daily at 06:17 UTC",
      paused: false,
    });
    // Verify KV was called to delete the paused key
    expect(env.STATE.delete).toHaveBeenCalledWith("m365:paused");
  });

  it("POST /api/schedule with empty body returns 400", async () => {
    const env = createEnv();
    const res = await worker.fetch!(
      makeRequest("/api/schedule", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
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
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
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
      makeRequest("/unknown", { headers: authHeaders() }),
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
      makeRequest("/api/status", { headers: authHeaders() }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.clientRequestId).toBe("req-123");
    expect(body.lastVersion).toBe("1234567890");
    expect(body.lastSyncedAt).toBe("2026-01-01T00:00:00Z");
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

  it("proceeds with sync when not paused", async () => {
    const env = createEnv();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const controller = {
      scheduledTime: Date.now(),
      cron: "17 6 * * *",
      noRetry() {},
    } as ScheduledController;

    // The sync will fail because there is no real API to call,
    // but it should NOT log the "scheduled.skipped" message.
    await worker.scheduled!(controller, env);

    const skipCall = logSpy.mock.calls.find(
      (call) => call[0]?.includes?.("scheduled.skipped")
    );
    expect(skipCall).toBeUndefined();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
