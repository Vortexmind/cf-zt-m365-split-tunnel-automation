import { M365EndpointSet, CandidateEntry, CategoryPriority } from "../types";

/** Category priority order: Optimize > Allow > Default (lower = higher priority). */
export const CATEGORY_PRIORITY: Record<CategoryPriority, number> = {
  Optimize: 0,
  Allow: 1,
  Default: 2,
};

export interface TransformOptions {
  services: string[] | undefined; // undefined = all
  categories: CategoryPriority[];
  includeIpv6: boolean;
  includeUrls: boolean;
  managedTag: string;
}

/** Internal entry tracking category alongside the candidate data. */
interface InternalEntry {
  key: string;
  type: "address" | "host";
  category: CategoryPriority;
  serviceArea: string;
  sourceIds: number[];
}

/**
 * Filter and flatten M365 endpoint sets into deduplicated candidate entries.
 */
export function transformEndpoints(
  endpointSets: M365EndpointSet[],
  options: TransformOptions
): CandidateEntry[] {
  const dedupMap = new Map<string, InternalEntry>();

  for (const endpointSet of endpointSets) {
    // Always include "Common" serviceArea regardless of the services filter.
    const isCommon = endpointSet.serviceArea === "Common";
    const matchesServiceFilter =
      options.services === undefined ||
      options.services.length === 0 ||
      options.services.includes(endpointSet.serviceArea);

    if (!isCommon && !matchesServiceFilter) {
      continue;
    }

    // Check category filter.
    if (!options.categories.includes(endpointSet.category)) {
      continue;
    }

    // Extract IP/CIDR entries.
    if (endpointSet.ips) {
      for (const ip of endpointSet.ips) {
        // Filter out IPv6 if not included (IPv6 addresses contain ":").
        if (!options.includeIpv6 && ip.includes(":")) {
          continue;
        }

        addEntry(dedupMap, {
          key: ip,
          type: "address",
          category: endpointSet.category,
          serviceArea: endpointSet.serviceArea,
          sourceIds: [endpointSet.id],
        });
      }
    }

    // Extract URL/FQDN entries.
    if (options.includeUrls && endpointSet.urls) {
      for (const url of endpointSet.urls) {
        addEntry(dedupMap, {
          key: url,
          type: "host",
          category: endpointSet.category,
          serviceArea: endpointSet.serviceArea,
          sourceIds: [endpointSet.id],
        });
      }
    }
  }

  // Convert internal entries to candidate entries with formatted descriptions.
  const addresses: CandidateEntry[] = [];
  const hosts: CandidateEntry[] = [];

  for (const internal of dedupMap.values()) {
    const candidate: CandidateEntry = {
      key: internal.key,
      type: internal.type,
      category: internal.category,
      description: `${options.managedTag} ${internal.serviceArea}/${internal.category} id=${internal.sourceIds.join(",")}`,
      sourceIds: internal.sourceIds,
    };

    if (internal.type === "address") {
      addresses.push(candidate);
    } else {
      hosts.push(candidate);
    }
  }

  // Sort: addresses first (by key), then hosts (by key).
  addresses.sort((a, b) => a.key.localeCompare(b.key));
  hosts.sort((a, b) => a.key.localeCompare(b.key));

  return [...addresses, ...hosts];
}

/**
 * Add an internal entry to the dedup map, handling collisions by category priority.
 *
 * - If the key does not exist, insert it.
 * - If the new entry has higher priority (lower number), replace the existing entry.
 * - If same priority, merge sourceIds.
 * - If lower priority, skip.
 */
function addEntry(
  dedupMap: Map<string, InternalEntry>,
  entry: InternalEntry
): void {
  const existing = dedupMap.get(entry.key);

  if (!existing) {
    dedupMap.set(entry.key, entry);
    return;
  }

  const existingPrio = CATEGORY_PRIORITY[existing.category];
  const newPrio = CATEGORY_PRIORITY[entry.category];

  if (newPrio < existingPrio) {
    // New entry has higher priority; replace.
    dedupMap.set(entry.key, entry);
  } else if (newPrio === existingPrio) {
    // Same priority; merge sourceIds.
    const mergedIds = [...new Set([...existing.sourceIds, ...entry.sourceIds])];
    dedupMap.set(entry.key, { ...existing, sourceIds: mergedIds });
  }
  // If new priority is lower, skip (keep existing).
}
