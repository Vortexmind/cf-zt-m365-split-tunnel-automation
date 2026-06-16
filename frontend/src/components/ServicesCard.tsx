import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Switch, Button, Banner, Badge, Tooltip } from "@cloudflare/kumo";
import { Info } from "@phosphor-icons/react";
import { fetchServices, updateServices, fetchServicesSummary } from "../lib/api";
import { toggleService } from "../lib/services-toggle";
import type { ServicesConfig, ServicesSummaryResponse, ServiceSummary } from "../lib/types";

const ALL_SERVICES = ["Exchange", "SharePoint", "Skype"] as const;
type ServiceName = typeof ALL_SERVICES[number];

const SERVICE_LABELS: Record<ServiceName, string> = {
  Exchange: "Exchange Online (Outlook, email)",
  SharePoint: "SharePoint Online & OneDrive",
  Skype: "Microsoft Teams / Skype",
};

const SERVICE_DESCRIPTIONS: Record<ServiceName, string> = {
  Exchange: "Email, calendaring, and contacts",
  SharePoint: "Document collaboration and cloud storage",
  Skype: "Real-time communication and meetings",
};

/** Convert API value to UI selection set. null means all three selected. */
function apiToSelection(services: string[] | null): Set<ServiceName> {
  if (services === null) return new Set(ALL_SERVICES);
  return new Set(services.filter((s): s is ServiceName => ALL_SERVICES.includes(s as ServiceName)));
}

/** Convert UI selection set to API value. All selected means null. */
function selectionToApi(selected: Set<ServiceName>): string[] | null {
  if (selected.size === ALL_SERVICES.length) return null;
  return [...selected];
}

function setsEqual(a: Set<ServiceName>, b: Set<ServiceName>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

export function ServicesCard({ onMutation, onSaveAndPreview }: { onMutation?: () => void; onSaveAndPreview?: () => void }) {
  const [savedConfig, setSavedConfig] = useState<ServicesConfig | null>(null);
  const [selected, setSelected] = useState<Set<ServiceName>>(new Set(ALL_SERVICES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ServicesSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchServices();
      setSavedConfig(config);
      setSelected(apiToSelection(config.services));
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setSaveError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const result = await fetchServicesSummary();
      setSummary(result);
    } catch {
      // Non-critical; summary is optional enrichment
    }
  }, []);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  function getSummary(serviceArea: string): ServiceSummary | undefined {
    return summary?.services.find(s => s.serviceArea === serviceArea);
  }

  const savedSelection = savedConfig ? apiToSelection(savedConfig.services) : new Set(ALL_SERVICES);
  const isDirty = !setsEqual(selected, savedSelection);
  const handleServiceToggle = (service: ServiceName, checked: boolean) => {
    setSelected(prev => toggleService(prev, service, checked));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const apiValue = selectionToApi(selected);
      const result = await updateServices(apiValue);
      setSavedConfig(result);
      setSelected(apiToSelection(result.services));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onMutation?.();
      loadSummary();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setSaveError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayerCard className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Services</Text>
          <Tooltip
            content="Controls which Microsoft 365 service areas are included in the split tunnel exclude list. Changes take effect on the next sync (scheduled or manual)."
            render={<span className="inline-flex cursor-default text-kumo-subtle" />}
          >
            <Info size={14} />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
          >
            {saving ? "Saving\u2026" : "Save"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await handleSave();
              onSaveAndPreview?.();
            }}
            disabled={!isDirty || saving || loading}
          >
            Save & Preview
          </Button>
        </div>
      </div>

      {!loading && (
        <div className="mb-3">
          <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
            Select which M365 services to exclude from the WARP tunnel. Excluded endpoints
            bypass Cloudflare and connect directly to Microsoft. Changes take effect on the
            next sync.
          </Text>
        </div>
      )}

      {loading && <Text variant="secondary">Loading\u2026</Text>}
      {saveSuccess && (
        <Banner
          variant="default"
          description="Service configuration saved. Changes will apply on the next sync."
          className="mb-3"
        />
      )}
      {saveError && (
        <Banner variant="error" description={saveError} className="mb-3" />
      )}

      {!loading && (
        <>
          {/* Individual service toggles */}
          <div className="divide-y divide-kumo-hairline">
            {ALL_SERVICES.map((service) => (
              <div key={service} className="flex items-center justify-between py-2.5">
                <div>
                  <Text>{SERVICE_LABELS[service]}</Text>
                  <div className="mt-0.5">
                    <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                      {SERVICE_DESCRIPTIONS[service]}
                      {getSummary(service) && (
                        <> &mdash; {getSummary(service)!.entryCount} endpoints</>
                      )}
                    </Text>
                  </div>
                  {getSummary(service) && getSummary(service)!.sampleDomains.length > 0 && (
                    <div className="mt-0.5">
                      <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {getSummary(service)!.sampleDomains.join(", ")}
                        {getSummary(service)!.entryCount > 5 && ", ..."}
                      </Text>
                    </div>
                  )}
                </div>
                <Switch
                  checked={selected.has(service)}
                  onCheckedChange={(checked) => handleServiceToggle(service, checked)}
                  aria-label={`Toggle ${service}`}
                />
              </div>
            ))}
          </div>

          {/* Common always included row */}
          <div className="mt-3 pt-3 border-t border-kumo-hairline">
            <div className="flex items-center justify-between py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <Text DANGEROUS_style={{ fontWeight: 600 }}>Common (always included)</Text>
                  <Badge variant="secondary">Required</Badge>
                </div>
                <div className="mt-0.5">
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    Authentication, Office portal, and shared dependencies needed by every M365 service
                    {getSummary("Common") && (
                      <> &mdash; {getSummary("Common")!.entryCount} endpoints</>
                    )}
                  </Text>
                </div>
                {getSummary("Common") && getSummary("Common")!.sampleDomains.length > 0 && (
                  <div className="mt-0.5">
                    <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {getSummary("Common")!.sampleDomains.join(", ")}
                      {getSummary("Common")!.entryCount > 5 && ", ..."}
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </LayerCard>
  );
}
