import { parseConfig } from "./config";
import { validateAuth } from "./auth";
import { executeSync } from "./handlers/sync";
import { executePreview } from "./handlers/preview";
import { loadState } from "./state";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let config;
    try {
      config = parseConfig(env);
    } catch (err) {
      console.error(JSON.stringify({ event: "http.error", step: "parseConfig", error: String(err) }));
      return jsonResponse({ error: `Configuration error: ${String(err)}` }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/healthz") {
        return new Response("ok", { status: 200 });
      }

      if (!validateAuth(request, config)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (request.method === "GET" && path === "/status") {
        const state = await loadState(env.STATE);
        return jsonResponse(state);
      }

      if (request.method === "GET" && path === "/preview") {
        const result = await executePreview(env.STATE, config);
        return jsonResponse(result);
      }

      if (request.method === "POST" && path === "/sync") {
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

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ event: "http.error", path, error: String(err) }));
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
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
