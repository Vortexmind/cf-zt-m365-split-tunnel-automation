import type { CategoryPriority } from "./types";

export interface Config {
  accountId: string;
  policyId: string;
  apiToken: string;
  m365Instance: string;
  m365Services: string[] | undefined;
  m365Categories: CategoryPriority[];
  includeIpv6: boolean;
  includeUrls: boolean;
  managedTag: string;
  dryRun: boolean;
  maxEntries: number;
  webhookSecret: string;
  useDefaultProfile: boolean;
  m365NoIpv6: boolean;
}

const VALID_CATEGORIES: readonly CategoryPriority[] = [
  "Optimize",
  "Allow",
  "Default",
];

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true";
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer value: "${value}"`);
  }
  if (parsed <= 0) {
    throw new Error(`Integer value must be positive: "${value}"`);
  }
  return parsed;
}

export function parseConfig(env: Env): Config {
  if (!env.CF_ACCOUNT_ID) {
    throw new Error("CF_ACCOUNT_ID is required but not set");
  }

  let m365Services: string[] | undefined;
  if (env.M365_SERVICES && env.M365_SERVICES.toLowerCase() !== "all") {
    m365Services = env.M365_SERVICES.split(",").map((s) => s.trim());
  }
  if (m365Services && !m365Services.includes("Common")) {
    m365Services = ["Common", ...m365Services];
  }

  const categoryInput = env.M365_CATEGORIES || "Optimize,Allow";
  const m365Categories = categoryInput
    .split(",")
    .map((s) => s.trim() as CategoryPriority);
  for (const cat of m365Categories) {
    if (!VALID_CATEGORIES.includes(cat)) {
      throw new Error(
        `Invalid M365 category: "${cat}". Must be one of: ${VALID_CATEGORIES.join(", ")}`
      );
    }
  }

  const includeIpv6 = parseBoolean(env.INCLUDE_IPV6, true);
  const policyId = env.CF_POLICY_ID ?? "";

  if (!env.WEBHOOK_SECRET) {
    console.warn("WEBHOOK_SECRET is not set. HTTP routes (/api/sync, /api/preview, /api/status, /api/schedule) will return 401.");
  }

  return {
    accountId: env.CF_ACCOUNT_ID,
    policyId,
    apiToken: env.CF_API_TOKEN,
    m365Instance: env.M365_INSTANCE || "Worldwide",
    m365Services,
    m365Categories,
    includeIpv6,
    includeUrls: parseBoolean(env.INCLUDE_URLS, true),
    managedTag: env.MANAGED_TAG || "[m365-auto]",
    dryRun: parseBoolean(env.DRY_RUN, false),
    maxEntries: parseInteger(env.MAX_ENTRIES, 1000),
    webhookSecret: env.WEBHOOK_SECRET,
    useDefaultProfile: policyId === "",
    m365NoIpv6: !includeIpv6,
  };
}
