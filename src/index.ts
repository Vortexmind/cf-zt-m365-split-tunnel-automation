import { parseConfig, VALID_INSTANCES, VALID_CATEGORIES } from "./config";
import { validateAccessAuth } from "./auth";
import { executeSync } from "./handlers/sync";
import { executePreview } from "./handlers/preview";
import { executeRemove } from "./handlers/remove";
import { executeEntries } from "./handlers/entries";
import { PermissionError, CfApiError } from "./cloudflare/client";
import { loadState, loadPaused, savePaused, loadServices, saveServices, loadSettings, saveSettings, loadCron, saveCron } from "./state";
import type { ScheduleState, SettingsOverride } from "./types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DEFAULT_CRON = "17 6 * * *";
const VALID_SERVICES = ["Exchange", "SharePoint", "Skype"] as const;

function buildSettingsResponse(env: Env, settingsOverride: SettingsOverride | undefined) {
  const resolve = <T>(override: T | undefined, envValue: string | undefined, defaultValue: T, parser: (v: string) => T): { value: T; source: "kv" | "env" | "default" } => {
    if (override !== undefined) return { value: override, source: "kv" };
    if (envValue !== undefined && envValue !== "") {
      try { return { value: parser(envValue), source: "env" }; } catch { /* fall through to default */ }
    }
    return { value: defaultValue, source: "default" };
  };

  const parseBool = (v: string) => v.toLowerCase() === "true";
  const parseNum = (v: string) => Number.parseInt(v, 10);
  const identity = (v: string) => v;

  return {
    m365Instance: resolve(settingsOverride?.m365Instance, env.M365_INSTANCE, "Worldwide", identity),
    m365Categories: resolve(settingsOverride?.m365Categories, env.M365_CATEGORIES, "Optimize,Allow", identity),
    includeIpv6: resolve(settingsOverride?.includeIpv6, env.INCLUDE_IPV6, true, parseBool),
    includeUrls: resolve(settingsOverride?.includeUrls, env.INCLUDE_URLS, true, parseBool),
    dryRun: resolve(settingsOverride?.dryRun, env.DRY_RUN, false, parseBool),
    maxEntries: resolve(settingsOverride?.maxEntries, env.MAX_ENTRIES, 1000, parseNum),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Unauthenticated routes (no config needed)
    if (request.method === "GET" && path === "/healthz") {
      return new Response("ok", { status: 200 });
    }

    if (request.method === "GET" && path === "/api/config-status") {
      const accessConfigured =
        !!env.ACCESS_POLICY_AUD &&
        !!env.ACCESS_TEAM_DOMAIN &&
        env.ACCESS_POLICY_AUD !== "dev" &&
        env.ACCESS_TEAM_DOMAIN !== "dev";
      return jsonResponse({ accessConfigured });
    }

    // Authenticated routes (require auth and config)
    const authResult = await validateAccessAuth(request, env);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    // Load KV-persisted services override (may be undefined if not set)
    const servicesOverride = await loadServices(env.STATE);

    let config;
    try {
      const settingsOverride = await loadSettings(env.STATE);
      config = parseConfig(env, servicesOverride, settingsOverride);
    } catch (err) {
      console.error(JSON.stringify({ event: "http.error", step: "parseConfig", error: String(err) }));
      return jsonResponse({ error: `Configuration error: ${String(err)}` }, 500);
    }

    try {
      if (request.method === "GET" && path === "/api/status") {
        const state = await loadState(env.STATE);
        return jsonResponse(state);
      }

      if (request.method === "GET" && path === "/api/preview") {
        const result = await executePreview(env.STATE, config);
        return jsonResponse(result);
      }

      if (request.method === "POST" && path === "/api/sync") {
        let force = false;
        try {
          const body = await request.json() as { force?: boolean };
          force = body.force ?? false;
        } catch {
          // Empty or invalid body: proceed with force=false
        }
        const result = await executeSync(env.STATE, config, { force });
        return jsonResponse(result);
      }

      if (request.method === "DELETE" && path === "/api/managed") {
        const result = await executeRemove(env.STATE, config);
        return jsonResponse(result);
      }

      if (request.method === "GET" && path === "/api/schedule") {
        const paused = await loadPaused(env.STATE);
        const cron = await loadCron(env.STATE) ?? DEFAULT_CRON;
        const schedule: ScheduleState = { cron, paused };
        return jsonResponse(schedule);
      }

      if (request.method === "POST" && path === "/api/schedule") {
        let paused: boolean | undefined;
        try {
          const body = await request.json() as { paused?: boolean };
          paused = body.paused;
        } catch {
          // Invalid JSON
        }
        if (paused === undefined) {
          return jsonResponse({ error: "Missing required field: paused" }, 400);
        }
        await savePaused(env.STATE, paused);
        console.log(JSON.stringify({ event: "schedule.update", paused }));
        const cron = await loadCron(env.STATE) ?? DEFAULT_CRON;
        const schedule: ScheduleState = { cron, paused };
        return jsonResponse(schedule);
      }

      if (request.method === "GET" && path === "/api/entries") {
        try {
          const result = await executeEntries(config);
          return jsonResponse(result);
        } catch (err) {
          if (err instanceof PermissionError) {
            return jsonResponse({ error: err.message }, 403);
          }
          if (err instanceof CfApiError) {
            return jsonResponse({ error: err.message }, 502);
          }
          throw err;
        }
      }

      if (request.method === "GET" && path === "/api/services") {
        return jsonResponse({ services: servicesOverride === undefined ? null : servicesOverride });
      }

      if (request.method === "POST" && path === "/api/services") {
        let services: string[] | null | undefined;
        try {
          const body = await request.json() as { services?: string[] | null };
          services = body.services;
        } catch {
          // Invalid JSON
        }
        if (services === undefined) {
          return jsonResponse({ error: "Missing required field: services (use null for all services, or an array of service names)" }, 400);
        }
        // Validate service names if array provided
        if (Array.isArray(services)) {
          const invalid = services.filter(s => !(VALID_SERVICES as readonly string[]).includes(s));
          if (invalid.length > 0) {
            return jsonResponse({ error: `Invalid service names: ${invalid.join(", ")}. Valid values: ${VALID_SERVICES.join(", ")}` }, 400);
          }
        }
        await saveServices(env.STATE, services);
        console.log(JSON.stringify({ event: "services.update", services }));
        return jsonResponse({ services });
      }

      if (request.method === "GET" && path === "/api/settings") {
        const settingsOverride = await loadSettings(env.STATE);
        const response = buildSettingsResponse(env, settingsOverride);
        return jsonResponse(response);
      }

      if (request.method === "POST" && path === "/api/settings") {
        let updates: Partial<SettingsOverride> = {};
        try {
          const body = await request.json() as Partial<SettingsOverride>;
          updates = body;
        } catch {
          // Invalid JSON
        }

        // If the body is an empty object, treat it as "clear all overrides"
        if (Object.keys(updates).length === 0) {
          await saveSettings(env.STATE, {});
          console.log(JSON.stringify({ event: "settings.update", action: "reset" }));
          const settingsOverride = await loadSettings(env.STATE);
          const response = buildSettingsResponse(env, settingsOverride);
          return jsonResponse(response);
        }

        // Validate m365Instance if provided
        if (updates.m365Instance !== undefined && !VALID_INSTANCES.includes(updates.m365Instance as any)) {
          return jsonResponse({ error: `Invalid M365 instance: "${updates.m365Instance}". Must be one of: ${VALID_INSTANCES.join(", ")}` }, 400);
        }

        // Validate m365Categories if provided
        if (updates.m365Categories !== undefined) {
          const cats = updates.m365Categories.split(",").map(s => s.trim());
          const invalid = cats.filter(c => !(VALID_CATEGORIES as readonly string[]).includes(c));
          if (invalid.length > 0) {
            return jsonResponse({ error: `Invalid M365 categories: ${invalid.join(", ")}. Valid values: ${VALID_CATEGORIES.join(", ")}` }, 400);
          }
        }

        // Validate maxEntries if provided
        if (updates.maxEntries !== undefined) {
          if (typeof updates.maxEntries !== "number" || updates.maxEntries <= 0 || !Number.isInteger(updates.maxEntries)) {
            return jsonResponse({ error: `Invalid maxEntries: must be a positive integer` }, 400);
          }
        }

        // Load existing settings, merge updates, and save
        const existing = await loadSettings(env.STATE) ?? {};
        const merged = { ...existing };
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null || value === "") {
            // Remove the key to revert to env/default
            delete (merged as Record<string, unknown>)[key];
          } else {
            (merged as Record<string, unknown>)[key] = value;
          }
        }
        await saveSettings(env.STATE, merged);
        console.log(JSON.stringify({ event: "settings.update", updates: Object.keys(updates) }));

        const settingsOverride = await loadSettings(env.STATE);
        const response = buildSettingsResponse(env, settingsOverride);
        return jsonResponse(response);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ event: "http.error", path, error: String(err) }));
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    // Persist the actual cron expression from the trigger (only if not yet stored)
    const existingCron = await loadCron(env.STATE);
    if (!existingCron) {
      await saveCron(env.STATE, controller.cron);
    }

    const paused = await loadPaused(env.STATE);
    if (paused) {
      console.log(JSON.stringify({ event: "scheduled.skipped", reason: "paused" }));
      return;
    }

    // Load KV-persisted services override
    const servicesOverride = await loadServices(env.STATE);
    const settingsOverride = await loadSettings(env.STATE);

    let config;
    try {
      config = parseConfig(env, servicesOverride, settingsOverride);
    } catch (err) {
      console.error(JSON.stringify({ event: "scheduled.error", step: "parseConfig", error: String(err) }));
      return;
    }

    try {
      const result = await executeSync(env.STATE, config);
      if (result.error) {
        console.error(JSON.stringify({ event: "scheduled.error", error: result.error }));
      } else {
        console.log(JSON.stringify({ event: "scheduled.complete", result }));
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "scheduled.error", step: "executeSync", error: String(err) }));
    }
  },
} satisfies ExportedHandler<Env>;
