import { Config } from "../config";
import { fetchAndTransformEndpoints } from "../m365/fetch-and-transform";

export interface ServiceSummary {
  serviceArea: string;
  entryCount: number;
  sampleDomains: string[];
}

export interface ServicesSummaryResponse {
  version: string;
  versionWarning?: string;
  services: ServiceSummary[];
}

export async function executeSummary(
  kv: KVNamespace,
  config: Config
): Promise<ServicesSummaryResponse> {
  const { version, versionWarning, candidates } = await fetchAndTransformEndpoints(kv, config);

  // Group candidates by serviceArea
  const byService = new Map<string, { entries: typeof candidates; domains: Set<string> }>();

  for (const entry of candidates) {
    const area = entry.serviceArea;
    if (!byService.has(area)) {
      byService.set(area, { entries: [], domains: new Set() });
    }
    const group = byService.get(area)!;
    group.entries.push(entry);
    if (entry.type === "host") {
      group.domains.add(entry.key);
    }
  }

  // Build summary per service area
  // Always include Common, Exchange, SharePoint, Skype even if empty
  const allAreas = ["Common", "Exchange", "SharePoint", "Skype"];
  const services: ServiceSummary[] = allAreas.map((area) => {
    const group = byService.get(area);
    const domains = group ? [...group.domains] : [];
    // Take up to 5 sample domains, sorted alphabetically
    const sampleDomains = domains.sort().slice(0, 5);
    return {
      serviceArea: area,
      entryCount: group ? group.entries.length : 0,
      sampleDomains,
    };
  });

  return { version, versionWarning, services };
}
