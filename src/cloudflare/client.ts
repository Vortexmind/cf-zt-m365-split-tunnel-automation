import { SplitTunnelEntry, CfApiListResponse } from "../types";
import { fetchWithTimeout, TimeoutError } from "../fetch";

const BASE_URL = "https://api.cloudflare.com/client/v4";
const CF_API_TIMEOUT_MS = 30_000;
const MAX_PAGES = 100;

function buildExcludePath(accountId: string, policyId: string): string {
  if (policyId === "") {
    return `/accounts/${accountId}/devices/policy/exclude`;
  }
  return `/accounts/${accountId}/devices/policy/${policyId}/exclude`;
}

async function cfGet(
  url: string,
  apiToken: string
): Promise<Response> {
  const headers = { Authorization: `Bearer ${apiToken}` };
  let response = await fetchWithTimeout(url, { method: "GET", headers }, CF_API_TIMEOUT_MS);

  if (response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await fetchWithTimeout(url, { method: "GET", headers }, CF_API_TIMEOUT_MS);
  }

  return response;
}

export async function getAllExcludeEntries(
  accountId: string,
  policyId: string,
  apiToken: string
): Promise<SplitTunnelEntry[]> {
  const path = buildExcludePath(accountId, policyId);
  const allResults: SplitTunnelEntry[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE_URL}${path}?page=${page}&per_page=100`;
    const response = await cfGet(url, apiToken);

    if (response.status === 403) {
      throw new PermissionError(
        "CF API returned 403 Forbidden. Check that the API token has Zero Trust device policy edit permissions."
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new CfApiError(response.status, `CF API returned ${response.status}: ${body}`);
    }

    const data: CfApiListResponse<SplitTunnelEntry> = await response.json();
    allResults.push(...data.result);

    if (data.result.length === 0) {
      break;
    }

    if (page >= MAX_PAGES) {
      console.warn(JSON.stringify({
        event: "cf.pagination.limit",
        message: `Reached page limit (${MAX_PAGES}), some entries may be missing`,
        entriesSoFar: allResults.length,
      }));
      break;
    }

    const totalCount = data.result_info?.total_count;
    if (totalCount !== undefined && allResults.length < totalCount) {
      page++;
    } else {
      hasMore = false;
    }
  }

  return allResults;
}

export async function putExcludeEntries(
  accountId: string,
  policyId: string,
  apiToken: string,
  entries: SplitTunnelEntry[]
): Promise<SplitTunnelEntry[]> {
  const path = buildExcludePath(accountId, policyId);
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  let response = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(entries),
    },
    CF_API_TIMEOUT_MS
  );

  if (response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await fetchWithTimeout(
      url,
      { method: "PUT", headers, body: JSON.stringify(entries) },
      CF_API_TIMEOUT_MS
    );
  }

  if (response.status === 403) {
    throw new PermissionError(
      "CF API returned 403 Forbidden. Check that the API token has Zero Trust device policy edit permissions."
    );
  }

  if (response.status >= 500) {
    const body = await response.text();
    throw new CfApiError(response.status, `CF API returned ${response.status}: ${body}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new CfApiError(response.status, `CF API returned ${response.status}: ${body}`);
  }

  const data: CfApiListResponse<SplitTunnelEntry> = await response.json();
  return data.result;
}

export interface DeviceProfile {
  policyId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  match?: string;
}

// Note: This endpoint does not paginate. Accounts with many device profiles
// may need pagination support added if the API begins returning paginated results.
export async function listDeviceProfiles(
  accountId: string,
  apiToken: string
): Promise<DeviceProfile[]> {
  const url = `${BASE_URL}/accounts/${accountId}/devices/policies`;
  const response = await cfGet(url, apiToken);

  if (response.status === 403) {
    throw new PermissionError(
      "CF API returned 403 Forbidden. Check that the API token has Zero Trust device policy read permissions."
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new CfApiError(response.status, `CF API returned ${response.status}: ${body}`);
  }

  const data = await response.json() as { result: Array<Record<string, unknown>> };
  return data.result.map((p) => ({
    policyId: p.policy_id as string,
    name: p.name as string,
    description: p.description as string | undefined,
    isDefault: !!p.default,
    match: p.match as string | undefined,
  }));
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export class CfApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "CfApiError";
  }
}

export { TimeoutError as CfTimeoutError };
