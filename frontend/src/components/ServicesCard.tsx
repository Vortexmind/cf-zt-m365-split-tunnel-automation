import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Switch, Button, Banner, Tooltip } from "@cloudflare/kumo";
import { Info } from "@phosphor-icons/react";
import { fetchServices, updateServices } from "../lib/api";
import { toggleService } from "../lib/services-toggle";
import type { ServicesConfig } from "../lib/types";

const ALL_SERVICES = ["Exchange", "SharePoint", "Skype"] as const;
type ServiceName = typeof ALL_SERVICES[number];

const SERVICE_DESCRIPTIONS: Record<ServiceName, string> = {
  Exchange: "Email, calendaring, and contacts (Exchange Online)",
  SharePoint: "SharePoint Online and OneDrive",
  Skype: "Microsoft Teams and Skype for Business",
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

export function ServicesCard({ onMutation }: { onMutation?: () => void }) {
  const [savedConfig, setSavedConfig] = useState<ServicesConfig | null>(null);
  const [selected, setSelected] = useState<Set<ServiceName>>(new Set(ALL_SERVICES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

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
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || saving || loading}
        >
          {saving ? "Saving\u2026" : "Save"}
        </Button>
      </div>

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
                  <Text>{service}</Text>
                  <div className="mt-0.5">
                    <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                      {SERVICE_DESCRIPTIONS[service]}
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={selected.has(service)}
                  onCheckedChange={(checked) => handleServiceToggle(service, checked)}
                  aria-label={`Toggle ${service}`}
                />
              </div>
            ))}
          </div>

          {/* Common info row */}
          <div className="mt-2 pt-2 border-t border-kumo-hairline">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-kumo-subtle" />
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                <strong>Common</strong> endpoints are always included regardless of the selection above.
                Common contains shared dependencies required by all M365 services.
              </Text>
            </div>
          </div>
        </>
      )}
    </LayerCard>
  );
}
