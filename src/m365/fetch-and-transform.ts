import { Config } from "../config";
import { CandidateEntry } from "../types";
import { loadState, saveState, generateClientRequestId } from "../state";
import { fetchLatestVersion, fetchEndpoints, RateLimitError } from "./client";
import { transformEndpoints } from "./transform";

const ENDPOINTS_CACHE_KEY = "m365:endpoints:cache";
const ENDPOINTS_CACHE_TTL = 3600; // 1 hour

export interface FetchOptions {
  useCache?: boolean;         // default true
  skipIfUpToDate?: string;    // if set, lastVersion to compare against; returns { skipped: true } if version matches
  throwOnRateLimit?: boolean; // default false; if true, re-throws RateLimitError instead of swallowing
}

/**
 * Fetch M365 endpoints (from cache or live API) and transform them into
 * candidate entries. Used by both the preview and summary handlers.
 */
export async function fetchAndTransformEndpoints(
  kv: KVNamespace,
  config: Config,
  options?: FetchOptions
): Promise<{
  version: string;
  versionWarning?: string;
  candidates: CandidateEntry[];
  skipped?: boolean;
}> {
  // Ensure clientRequestId exists
  let state = await loadState(kv);
  if (!state.clientRequestId) {
    state = { ...state, clientRequestId: generateClientRequestId() };
    await saveState(kv, { clientRequestId: state.clientRequestId });
  }

  // Check version
  let version: string;
  let versionWarning: string | undefined;
  try {
    version = await fetchLatestVersion(config.m365Instance, state.clientRequestId);

    // If skipIfUpToDate is set and version hasn't changed, return early
    if (options?.skipIfUpToDate && version <= options.skipIfUpToDate) {
      return { version, skipped: true, candidates: [] };
    }
  } catch (err) {
    if (options?.throwOnRateLimit && err instanceof RateLimitError) {
      throw err;
    }
    version = state.lastVersion;
    versionWarning = `Version check failed: ${String(err)}`;
  }

  // Try cache first (if enabled, default true)
  const useCache = options?.useCache !== false;
  let endpointSets;

  if (useCache) {
    const cached = await kv.get(ENDPOINTS_CACHE_KEY, "json");
    if (cached && (cached as any).version === version) {
      endpointSets = (cached as any).data;
    }
  }

  if (!endpointSets) {
    endpointSets = await fetchEndpoints(
      config.m365Instance,
      state.clientRequestId,
      { serviceAreas: config.m365Services, noIpv6: config.m365NoIpv6 }
    );

    // Write to cache (best-effort, don't await)
    if (useCache && version) {
      kv.put(ENDPOINTS_CACHE_KEY, JSON.stringify({ version, data: endpointSets }), {
        expirationTtl: ENDPOINTS_CACHE_TTL,
      }).catch(() => {});
    }
  }

  const candidates = transformEndpoints(endpointSets, {
    services: config.m365Services,
    categories: config.m365Categories,
    includeIpv6: config.includeIpv6,
    includeUrls: config.includeUrls,
    managedTag: config.managedTag,
  });

  return { version, versionWarning, candidates };
}
