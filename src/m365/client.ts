import { M365EndpointSet } from "../types";
import { fetchWithTimeout, TimeoutError } from "../fetch";

const M365_API_TIMEOUT_MS = 60_000;

export class RateLimitError extends Error {
  constructor() {
    super("M365 API rate limit exceeded. Retry after 1 hour.");
    this.name = "RateLimitError";
  }
}

export async function fetchLatestVersion(
  instance: string,
  clientRequestId: string
): Promise<string> {
  const url = `https://endpoints.office.com/version/${instance}?clientRequestId=${clientRequestId}`;
  const response = await fetchWithTimeout(url, {}, M365_API_TIMEOUT_MS);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `M365 version API returned ${response.status}: ${body}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data[0].latest;
  }
  return (data as { instance: string; latest: string }).latest;
}

export async function fetchEndpoints(
  instance: string,
  clientRequestId: string,
  options?: {
    serviceAreas?: string[];
    noIpv6?: boolean;
    tenantName?: string;
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

  if (options?.tenantName) {
    url += `&TenantName=${encodeURIComponent(options.tenantName)}`;
  }

  const response = await fetchWithTimeout(url, {}, M365_API_TIMEOUT_MS);

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

export { TimeoutError as M365TimeoutError };
