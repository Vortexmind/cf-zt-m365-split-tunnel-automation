import type { CategoryPriority } from "./types";

export interface Env {
  STATE: KVNamespace;
  CF_ACCOUNT_ID: string;
  CF_POLICY_ID: string;
  CF_API_TOKEN: string; // secret
  M365_INSTANCE: string;
  M365_SERVICES: string;
  M365_CATEGORIES: string;
  INCLUDE_IPV6: string;
  INCLUDE_URLS: string;
  MANAGED_TAG: string;
  DRY_RUN: string;
  MAX_ENTRIES: string;
  WEBHOOK_SECRET: string; // secret - for HTTP auth
}

export interface Config {
  accountId: string;
  policyId: string;
  apiToken: string;
  m365Instance: string;
  m365Services: string[] | undefined; // undefined = all
  m365Categories: CategoryPriority[];
  includeIpv6: boolean;
  includeUrls: boolean;
  managedTag: string;
  dryRun: boolean;
  maxEntries: number;
  webhookSecret: string;
  // Derived
  useDefaultProfile: boolean; // true if policyId is empty
  m365NoIpv6: boolean; // inverted for API param
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
  return parsed;
}

export function parseConfig(env: Env): Config {
  // Required fields
  if (!env.CF_ACCOUNT_ID) {
    throw new Error("CF_ACCOUNT_ID is required but not set");
  }

  // Parse M365 services
  let m365Services: string[] | undefined;
  if (env.M365_SERVICES && env.M365_SERVICES.toLowerCase() !== "all") {
    m365Services = env.M365_SERVICES.split(",").map((s) => s.trim());
  }
  // Always ensure "Common" is included in the effective services list
  if (m365Services && !m365Services.includes("Common")) {
    m365Services = ["Common", ...m365Services];
  }

  // Parse and validate categories
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
    // Derived
    useDefaultProfile: policyId === "",
    m365NoIpv6: !includeIpv6,
  };
}
