import { M365EndpointSet } from "../types";

/**
 * Error thrown when the M365 endpoints API returns HTTP 429.
 * The endpoints web method is rate-limited; callers should wait
 * at least 1 hour before retrying.
 */
export class RateLimitError extends Error {
  constructor() {
    super("M365 API rate limit exceeded. Retry after 1 hour.");
    this.name = "RateLimitError";
  }
}

/**
 * Check the latest version of M365 endpoints.
 * Uses the version web method (not rate-limited per Microsoft docs).
 */
export async function fetchLatestVersion(
  instance: string,
  clientRequestId: string
): Promise<string> {
  const url = `https://endpoints.office.com/version/${instance}?clientRequestId=${clientRequestId}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `M365 version API returned ${response.status}: ${body}`
    );
  }

  const data = (await response.json()) as { latest: string };
  return data.latest;
}

/**
 * Fetch M365 endpoint sets.
 * Uses the endpoints web method (rate-limited; 429 if called too frequently).
 */
export async function fetchEndpoints(
  instance: string,
  clientRequestId: string,
  options?: {
    serviceAreas?: string[];
    noIpv6?: boolean;
  }
): Promise<M365EndpointSet[]> {
  let url = `https://endpoints.office.com/endpoints/${instance}?clientRequestId=${clientRequestId}`;

  if (
    options?.serviceAreas &&
    options.serviceAreas.length > 0 &&
    !options.serviceAreas.includes("all")
  ) {
    url += `&ServiceAreas=${options.serviceAreas.join(",")}`;
  }

  if (options?.noIpv6) {
    url += `&NoIPv6=true`;
  }

  const response = await fetch(url);

  if (response.status === 429) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `M365 endpoints API returned ${response.status}: ${body}`
    );
  }

  return (await response.json()) as M365EndpointSet[];
}
