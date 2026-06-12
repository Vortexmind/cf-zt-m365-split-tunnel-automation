import { parseConfig } from "./config";
import { validateAccessAuth } from "./auth";
import { executeSync } from "./handlers/sync";
import { executePreview } from "./handlers/preview";
import { executeRemove } from "./handlers/remove";
import { executeEntries } from "./handlers/entries";
import { PermissionError, CfApiError } from "./cloudflare/client";
import { loadState, loadPaused, savePaused } from "./state";
import type { ScheduleState } from "./types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DEFAULT_CRON = "17 6 * * *";
const DEFAULT_CRON_DESCRIPTION = "Daily at 06:17 UTC";

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

    let config;
    try {
      config = parseConfig(env);
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
        const cron = env.CRON_EXPRESSION || DEFAULT_CRON;
        const description = env.CRON_DESCRIPTION || DEFAULT_CRON_DESCRIPTION;
        const schedule: ScheduleState = { cron, description, paused };
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
        const cron = env.CRON_EXPRESSION || DEFAULT_CRON;
        const description = env.CRON_DESCRIPTION || DEFAULT_CRON_DESCRIPTION;
        const schedule: ScheduleState = { cron, description, paused };
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

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ event: "http.error", path, error: String(err) }));
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const paused = await loadPaused(env.STATE);
    if (paused) {
      console.log(JSON.stringify({ event: "scheduled.skipped", reason: "paused" }));
      return;
    }

    let config;
    try {
      config = parseConfig(env);
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
