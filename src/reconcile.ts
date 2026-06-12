import { SplitTunnelEntry, CandidateEntry } from "./types";

export interface PartitionResult {
  /** Entries not managed by this worker */
  preserved: SplitTunnelEntry[];
  /** Entries managed by this worker (description starts with managedTag) */
  managed: SplitTunnelEntry[];
}

export interface ReconcileResult {
  /** Entries to keep that are not managed by this worker */
  preserved: SplitTunnelEntry[];
  /** Current managed entries (before update) */
  managedBefore: SplitTunnelEntry[];
  /** New managed entries (after update) */
  managedAfter: SplitTunnelEntry[];
  /** Entries in managedAfter but not in managedBefore */
  added: SplitTunnelEntry[];
  /** Entries in managedBefore but not in managedAfter */
  removed: SplitTunnelEntry[];
  /** The complete merged list to PUT */
  merged: SplitTunnelEntry[];
  /** Whether the list has changed from current state */
  hasChanges: boolean;
}

/**
 * Produce a deterministic key for a split tunnel entry.
 * Uses the address or host field so that description changes
 * do not cause false diffs.
 */
function entryKey(entry: SplitTunnelEntry): string {
  if ("address" in entry) return `addr:${entry.address}`;
  return `host:${entry.host}`;
}

/**
 * Partition entries into preserved (not managed) and managed (description
 * starts with managedTag) groups.
 */
export function partitionEntries(
  entries: SplitTunnelEntry[],
  managedTag: string
): PartitionResult {
  const preserved: SplitTunnelEntry[] = [];
  const managed: SplitTunnelEntry[] = [];

  for (const entry of entries) {
    if (entry.description && entry.description.startsWith(managedTag)) {
      managed.push(entry);
    } else {
      preserved.push(entry);
    }
  }

  return { preserved, managed };
}

/**
 * Reconcile the current CF exclude list with new M365 candidate entries.
 * Preserves all non-managed entries verbatim.
 * Managed entries (those with description starting with managedTag) are
 * replaced entirely by the new candidates.
 */
export function reconcile(
  currentEntries: SplitTunnelEntry[],
  candidates: CandidateEntry[],
  managedTag: string
): ReconcileResult {
  // Step 1: Split current entries into preserved and managedBefore.
  const { preserved, managed: managedBefore } = partitionEntries(currentEntries, managedTag);

  // Step 2: Convert candidates to SplitTunnelEntry[].
  const managedAfter: SplitTunnelEntry[] = candidates.map((c) => {
    if (c.type === "address") {
      return { address: c.key, description: c.description };
    }
    return { host: c.key, description: c.description };
  });

  // Step 3: Compute diff by key.
  const beforeKeys = new Set(managedBefore.map(entryKey));
  const afterKeys = new Set(managedAfter.map(entryKey));

  const added: SplitTunnelEntry[] = managedAfter.filter(
    (entry) => !beforeKeys.has(entryKey(entry))
  );

  const removed: SplitTunnelEntry[] = managedBefore.filter(
    (entry) => !afterKeys.has(entryKey(entry))
  );

  // Step 4: Build merged list and determine if changes exist.
  const merged: SplitTunnelEntry[] = [...preserved, ...managedAfter];
  const hasChanges = added.length > 0 || removed.length > 0;

  return {
    preserved,
    managedBefore,
    managedAfter,
    added,
    removed,
    merged,
    hasChanges,
  };
}
