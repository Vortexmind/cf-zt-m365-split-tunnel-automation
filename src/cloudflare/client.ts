import { SplitTunnelEntry, CfApiListResponse } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

/**
 * Build the exclude API path based on whether we're targeting
 * the default profile or a custom profile.
 */
function buildExcludePath(accountId: string, policyId: string): string {
  if (policyId === "") {
    return `/accounts/${accountId}/devices/policy/exclude`;
  }
  return `/accounts/${accountId}/devices/policy/${policyId}/exclude`;
}

/**
 * Get ALL exclude entries for a device settings profile.
 * Handles pagination automatically by looping through all pages.
 * This is critical: a partial GET followed by a full PUT would
 * delete entries not visible on the first page.
 */
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
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (response.status === 403) {
      throw new PermissionError(
        "CF API returned 403 Forbidden. Check that the API token has Zero Trust device policy edit permissions."
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new CfApiError(
        response.status,
        `CF API returned ${response.status}: ${body}`
      );
    }

    const data: CfApiListResponse<SplitTunnelEntry> = await response.json();
    allResults.push(...data.result);

    const totalCount = data.result_info?.total_count;
    if (totalCount !== undefined && allResults.length < totalCount) {
      page++;
    } else {
      hasMore = false;
    }
  }

  return allResults;
}

/**
 * Replace the entire exclude list for a device settings profile.
 * This is a full replacement (PUT), not an incremental update.
 */
export async function putExcludeEntries(
  accountId: string,
  policyId: string,
  apiToken: string,
  entries: SplitTunnelEntry[]
): Promise<SplitTunnelEntry[]> {
  const path = buildExcludePath(accountId, policyId);
  const url = `${BASE_URL}${path}`;

  const doPut = async (): Promise<Response> => {
    return fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entries),
    });
  };

  let response = await doPut();

  // Single retry on 5xx with 1-second delay
  if (response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await doPut();
  }

  if (response.status === 403) {
    throw new PermissionError(
      "CF API returned 403 Forbidden. Check that the API token has Zero Trust device policy edit permissions."
    );
  }

  if (response.status >= 500) {
    const body = await response.text();
    throw new CfApiError(
      response.status,
      `CF API returned ${response.status}: ${body}`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new CfApiError(
      response.status,
      `CF API returned ${response.status}: ${body}`
    );
  }

  const data: CfApiListResponse<SplitTunnelEntry> = await response.json();
  return data.result;
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
