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
  required: boolean;
  notes: string[]; // collected from all source sets
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
          required: endpointSet.required ?? false,
          notes: endpointSet.notes ? [endpointSet.notes] : [],
        });
      }
    }

    // Extract URL/FQDN entries.
    if (options.includeUrls && endpointSet.urls) {
      for (const url of endpointSet.urls) {
        // Strip a leading wildcard prefix ("*." or bare "*").
        const normalized = url.replace(/^\*\.?/, "");
        // If a wildcard remains (e.g. mid-domain "autodiscover.*.onmicrosoft.com"),
        // the Cloudflare API will reject it. Skip and warn rather than fail the sync.
        if (normalized.includes("*")) {
          console.warn(`Skipping unsupported wildcard URL: ${url}`);
          continue;
        }
        addEntry(dedupMap, {
          key: normalized,
          type: "host",
          category: endpointSet.category,
          serviceArea: endpointSet.serviceArea,
          sourceIds: [endpointSet.id],
          required: endpointSet.required ?? false,
          notes: endpointSet.notes ? [endpointSet.notes] : [],
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
      serviceArea: internal.serviceArea,
      description: `${options.managedTag} ${internal.serviceArea}/${internal.category} id=${internal.sourceIds.join(",")}`,
      required: internal.required || undefined,  // omit if false to keep response clean
      notes: internal.notes.length > 0 ? internal.notes.join("; ") : undefined,
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
 * - If same priority, merge sourceIds, required (OR), and notes (unique).
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
    // Same priority; merge sourceIds, required, and notes.
    const mergedIds = [...new Set([...existing.sourceIds, ...entry.sourceIds])];
    const mergedRequired = existing.required || entry.required;
    const mergedNotes = [...new Set([...existing.notes, ...entry.notes])];
    dedupMap.set(entry.key, { ...existing, sourceIds: mergedIds, required: mergedRequired, notes: mergedNotes });
  }
  // If new priority is lower, skip (keep existing).
}
