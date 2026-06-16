import { describe, it, expect } from "vitest";
import { reconcile } from "../src/reconcile";
import type { SplitTunnelEntry, SplitTunnelEntryAddress, CandidateEntry } from "../src/types";

const MANAGED_TAG = "[m365-auto]";

function makeManagedAddress(address: string, description: string): SplitTunnelEntry {
  return { address, description };
}

function makeManagedHost(host: string, description: string): SplitTunnelEntry {
  return { host, description };
}

function makePreservedAddress(address: string, description: string): SplitTunnelEntry {
  return { address, description };
}

function makePreservedHost(host: string, description: string): SplitTunnelEntry {
  return { host, description };
}

function makeCandidateAddress(key: string, description: string): CandidateEntry {
  return { key, type: "address", description, category: "Optimize", serviceArea: "Exchange", sourceIds: [1] };
}

function makeCandidateHost(key: string, description: string): CandidateEntry {
  return { key, type: "host", description, category: "Optimize", serviceArea: "Exchange", sourceIds: [1] };
}

describe("reconcile", () => {
  it("first run with empty current list produces all candidates as managedAfter", () => {
    const currentEntries: SplitTunnelEntry[] = [];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeCandidateHost("outlook.office.com", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.preserved).toEqual([]);
    expect(result.managedBefore).toEqual([]);
    expect(result.managedAfter.length).toBe(2);
    expect(result.added.length).toBe(2);
    expect(result.removed).toEqual([]);
    expect(result.hasChanges).toBe(true);
    expect(result.merged.length).toBe(2);
  });

  it("reports no changes when managed entries match candidates exactly", () => {
    const currentEntries: SplitTunnelEntry[] = [
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeManagedHost("outlook.office.com", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeCandidateHost("outlook.office.com", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.hasChanges).toBe(false);
    expect(result.managedAfter.length).toBe(2);
  });

  it("preserves non-managed entries verbatim and unchanged", () => {
    const preservedEntry = makePreservedAddress("10.0.0.0/8", "Corporate VPN");
    const currentEntries: SplitTunnelEntry[] = [
      preservedEntry,
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.preserved.length).toBe(1);
    expect(result.preserved[0]).toEqual(preservedEntry);
    expect(result.merged).toContainEqual(preservedEntry);
  });

  it("replaces managed entries when candidates differ", () => {
    const currentEntries: SplitTunnelEntry[] = [
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeManagedHost("old.example.com", `${MANAGED_TAG} Exchange/Allow id=2`),
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeCandidateHost("new.example.com", `${MANAGED_TAG} Exchange/Allow id=3`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.removed.length).toBe(1);
    expect(result.removed[0]).toEqual(
      makeManagedHost("old.example.com", `${MANAGED_TAG} Exchange/Allow id=2`)
    );
    expect(result.added.length).toBe(1);
    expect(result.added[0]).toEqual(
      makeManagedHost("new.example.com", `${MANAGED_TAG} Exchange/Allow id=3`)
    );
    expect(result.hasChanges).toBe(true);
  });

  it("handles mixed adds and removes simultaneously", () => {
    const currentEntries: SplitTunnelEntry[] = [
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeManagedAddress("198.51.100.0/24", `${MANAGED_TAG} Exchange/Allow id=2`),
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeCandidateAddress("203.0.113.0/24", `${MANAGED_TAG} SharePoint/Optimize id=3`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.added.length).toBe(1);
    expect((result.added[0] as SplitTunnelEntryAddress).address).toBe("203.0.113.0/24");
    expect(result.removed.length).toBe(1);
    expect((result.removed[0] as SplitTunnelEntryAddress).address).toBe("198.51.100.0/24");
    expect(result.hasChanges).toBe(true);
  });

  it("does not treat description-only changes as diffs", () => {
    const currentEntries: SplitTunnelEntry[] = [
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1,5`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.hasChanges).toBe(false);
    // The new description is applied in managedAfter.
    expect(result.managedAfter[0].description).toBe(
      `${MANAGED_TAG} Exchange/Optimize id=1,5`
    );
  });

  it("removes all managed entries when candidates are empty", () => {
    const preservedEntry = makePreservedAddress("10.0.0.0/8", "Corporate VPN");
    const currentEntries: SplitTunnelEntry[] = [
      preservedEntry,
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeManagedHost("outlook.office.com", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];
    const candidates: CandidateEntry[] = [];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    expect(result.removed.length).toBe(2);
    expect(result.added).toEqual([]);
    expect(result.preserved).toEqual([preservedEntry]);
    expect(result.managedAfter).toEqual([]);
    expect(result.merged).toEqual([preservedEntry]);
    expect(result.hasChanges).toBe(true);
  });

  it("places preserved entries before managed entries in merged list", () => {
    const preserved1 = makePreservedAddress("10.0.0.0/8", "Corporate VPN");
    const preserved2 = makePreservedHost("internal.corp.com", "Intranet");
    const currentEntries: SplitTunnelEntry[] = [
      preserved1,
      makeManagedAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      preserved2,
    ];
    const candidates: CandidateEntry[] = [
      makeCandidateAddress("192.0.2.0/24", `${MANAGED_TAG} Exchange/Optimize id=1`),
      makeCandidateHost("outlook.office.com", `${MANAGED_TAG} Exchange/Optimize id=1`),
    ];

    const result = reconcile(currentEntries, candidates, MANAGED_TAG);

    // Preserved entries come first, then managed.
    const preservedCount = result.preserved.length;
    for (let i = 0; i < preservedCount; i++) {
      expect(result.merged[i]).toEqual(result.preserved[i]);
    }
    const managedCount = result.managedAfter.length;
    for (let i = 0; i < managedCount; i++) {
      expect(result.merged[preservedCount + i]).toEqual(result.managedAfter[i]);
    }
    expect(result.merged.length).toBe(preservedCount + managedCount);
  });
});
