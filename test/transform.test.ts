import { describe, it, expect } from "vitest";
import { transformEndpoints, CATEGORY_PRIORITY } from "../src/m365/transform";
import type { TransformOptions } from "../src/m365/transform";
import type { M365EndpointSet, CategoryPriority } from "../src/types";
import sampleData from "./fixtures/endpoints-sample.json";

const defaultOptions: TransformOptions = {
  services: undefined,
  categories: ["Optimize", "Allow"],
  includeIpv6: true,
  includeUrls: true,
  managedTag: "[m365-auto]",
};

describe("transformEndpoints", () => {
  it("returns entries from Exchange, SharePoint, and Common when filtering for Optimize+Allow", () => {
    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      defaultOptions
    );

    // Exchange Optimize: 2 IPs + 2 URLs = 4
    // Exchange Allow: 1 IP + 2 URLs = 3
    // SharePoint Optimize: 1 IP + 1 URL = 2
    // Common Allow: 1 IP (192.0.2.0/24 deduped with Exchange Optimize) + 2 URLs
    //   The IP is kept as Exchange/Optimize (higher priority), so Common Allow
    //   contributes only its URLs.
    // SharePoint Allow: 2 URLs = 2
    // Skype/Teams Default is excluded by category filter.
    //
    // Unique IPs: 192.0.2.0/24 (Exchange Opt), 2001:db8::/32 (Exchange Opt),
    //   198.51.100.0/24 (Exchange Allow), 203.0.113.0/24 (SP Opt) = 4
    // Unique URLs: *.protection.outlook.com, outlook.office.com,
    //   *.office365.us, outlook.office365.us, *.sharepoint.com,
    //   *.office.net, officecdn.microsoft.com, *.onedrive.com,
    //   onedrive.live.com = 9
    // Total: 4 + 9 = 13

    const serviceAreas = new Set(
      result.map((e) => e.description.split(" ")[1].split("/")[0])
    );
    expect(serviceAreas.has("Exchange")).toBe(true);
    expect(serviceAreas.has("SharePoint")).toBe(true);
    expect(serviceAreas.has("Common")).toBe(true);
    expect(serviceAreas.has("Skype")).toBe(false);
    expect(result.length).toBe(13);
  });

  it("always includes Common entries even when services list does not contain Common", () => {
    const options: TransformOptions = {
      ...defaultOptions,
      services: ["Exchange"],
    };

    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      options
    );

    // Exchange Optimize + Allow + Common Allow
    // IPs: 192.0.2.0/24 (Exchange Opt), 2001:db8::/32 (Exchange Opt),
    //   198.51.100.0/24 (Exchange Allow) = 3
    //   (Common Allow 192.0.2.0/24 is deduped, lower priority so skipped)
    // URLs: *.protection.outlook.com, outlook.office.com,
    //   *.office365.us, outlook.office365.us, *.office.net,
    //   officecdn.microsoft.com = 6
    // Total: 3 + 6 = 9

    const hasCommon = result.some((e) => e.description.includes("Common/"));
    expect(hasCommon).toBe(true);
    expect(result.length).toBe(9);
  });

  it("filters to only Optimize entries when categories is [Optimize]", () => {
    const options: TransformOptions = {
      ...defaultOptions,
      categories: ["Optimize"],
    };

    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      options
    );

    // Exchange Optimize: 2 IPs + 2 URLs = 4
    // SharePoint Optimize: 1 IP + 1 URL = 2
    // Total: 6
    for (const entry of result) {
      expect(entry.category).toBe("Optimize");
    }
    expect(result.length).toBe(6);
  });

  it("excludes IPv6 addresses when includeIpv6 is false", () => {
    const options: TransformOptions = {
      ...defaultOptions,
      includeIpv6: false,
    };

    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      options
    );

    const addressEntries = result.filter((e) => e.type === "address");
    for (const entry of addressEntries) {
      expect(entry.key.includes(":")).toBe(false);
    }
  });

  it("excludes host-type entries when includeUrls is false", () => {
    const options: TransformOptions = {
      ...defaultOptions,
      includeUrls: false,
    };

    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      options
    );

    for (const entry of result) {
      expect(entry.type).toBe("address");
    }
  });

  it("deduplicates by key with category priority, merging sourceIds at same priority", () => {
    // 192.0.2.0/24 appears in Exchange Optimize (id=1) and Common Allow (id=4).
    // Optimize has higher priority than Allow, so the entry keeps the Optimize
    // category and the lower-priority entry is discarded (sourceIds NOT merged
    // across different priorities).
    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      defaultOptions
    );

    const deduped = result.find((e) => e.key === "192.0.2.0/24");
    expect(deduped).toBeDefined();
    expect(deduped!.category).toBe("Optimize");
    expect(deduped!.sourceIds).toEqual([1]);

    // Test same-priority merge: create a fixture where the same IP appears
    // in two Optimize entries from different service areas.
    const mergeFixture: M365EndpointSet[] = [
      {
        id: 10,
        serviceArea: "Exchange",
        ips: ["203.0.113.0/24"],
        category: "Optimize",
        expressRoute: true,
        required: true,
      },
      {
        id: 20,
        serviceArea: "SharePoint",
        ips: ["203.0.113.0/24"],
        category: "Optimize",
        expressRoute: true,
        required: true,
      },
    ];

    const mergeResult = transformEndpoints(mergeFixture, defaultOptions);
    const mergedEntry = mergeResult.find((e) => e.key === "203.0.113.0/24");
    expect(mergedEntry).toBeDefined();
    expect(mergedEntry!.category).toBe("Optimize");
    expect(mergedEntry!.sourceIds).toContain(10);
    expect(mergedEntry!.sourceIds).toContain(20);
  });

  it("strips leading wildcard prefixes from URL keys", () => {
    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      defaultOptions
    );

    const normalized = result.find((e) => e.key === "protection.outlook.com");
    expect(normalized).toBeDefined();
    expect(normalized!.type).toBe("host");
    expect(normalized!.key).toBe("protection.outlook.com");

    const sharepoint = result.find((e) => e.key === "sharepoint.com");
    expect(sharepoint).toBeDefined();
    expect(sharepoint!.key).toBe("sharepoint.com");
  });

  it("skips URLs that contain a wildcard after leading-wildcard normalization", () => {
    const fixture: M365EndpointSet[] = [
      {
        id: 99,
        serviceArea: "Exchange",
        category: "Optimize",
        urls: [
          "autodiscover.*.onmicrosoft.com", // mid-domain wildcard — must be skipped
          "outlook.office.com",             // clean domain — must be included
        ],
      },
    ];

    const result = transformEndpoints(fixture, defaultOptions);

    // The mid-domain wildcard is dropped.
    expect(result.find((e) => e.key.includes("*"))).toBeUndefined();
    expect(result.find((e) => e.key === "autodiscover.*.onmicrosoft.com")).toBeUndefined();
    // The clean domain is kept.
    expect(result.find((e) => e.key === "outlook.office.com")).toBeDefined();
  });

  it("formats descriptions as managedTag serviceArea/category id=sourceIds", () => {
    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      defaultOptions
    );

    // Pick an entry with a single sourceId for a clear check.
    const sharepointIp = result.find((e) => e.key === "203.0.113.0/24");
    expect(sharepointIp).toBeDefined();
    expect(sharepointIp!.description).toBe(
      "[m365-auto] SharePoint/Optimize id=3"
    );

    // The deduped 192.0.2.0/24 keeps the Exchange Optimize entry (higher priority),
    // so description reflects only the Optimize source.
    const deduped = result.find((e) => e.key === "192.0.2.0/24");
    expect(deduped).toBeDefined();
    expect(deduped!.description).toBe(
      "[m365-auto] Exchange/Optimize id=1"
    );
  });

  it("returns empty array when no service areas match", () => {
    // Common is always included regardless of services filter.
    // But Common entries in the fixture have category "Allow",
    // so requesting only "Optimize" category excludes them.
    const options: TransformOptions = {
      ...defaultOptions,
      services: ["NonExistentService"],
      categories: ["Optimize"],
    };

    const result = transformEndpoints(
      sampleData as M365EndpointSet[],
      options
    );

    expect(result).toEqual([]);
  });
});
