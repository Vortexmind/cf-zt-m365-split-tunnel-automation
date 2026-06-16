import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Switch, Button, Banner, Tooltip, Select, Input, Badge } from "@cloudflare/kumo";
import { Gear, Info, Warning } from "@phosphor-icons/react";
import { fetchSettings, updateSettings } from "../lib/api";
import type { SettingsConfig, SettingsUpdate, SettingSource } from "../lib/types";

const M365_INSTANCES = [
  { value: "Worldwide", label: "Worldwide" },
  { value: "China", label: "China" },
  { value: "USGovDoD", label: "USGovDoD" },
  { value: "USGovGCCHigh", label: "USGovGCCHigh" },
] as const;

const M365_CATEGORIES = ["Optimize", "Allow", "Default"] as const;
type CategoryName = typeof M365_CATEGORIES[number];

const CATEGORY_DESCRIPTIONS: Record<CategoryName, string> = {
  Optimize: "Microsoft-recommended for split tunneling. High-priority endpoints for network optimization (e.g., Exchange, Teams real-time traffic)",
  Allow: "Endpoints that should have network connectivity but are less sensitive to latency",
  Default: "Endpoints that can be handled with standard internet egress; no special optimization needed",
};

const SETTING_DESCRIPTIONS: Record<string, string> = {
  m365Instance: "Which Microsoft 365 cloud instance to fetch endpoints from",
  includeIpv6: "Include IPv6 address entries in the split tunnel exclude list",
  includeUrls: "Include URL entries in the split tunnel exclude list (in addition to IP ranges)",
  dryRun: "When enabled, syncs compute changes but do not apply them to the Cloudflare API",
  maxEntries: "Maximum number of split tunnel entries to manage (oldest entries beyond this limit are not added)",
};

function SourceBadge({ source }: { source: SettingSource }) {
  if (source === "kv") return <Badge variant="info">Custom</Badge>;
  if (source === "env") return <Badge variant="secondary">Env</Badge>;
  return <Badge variant="secondary">Default</Badge>;
}

/** Parse the comma-separated categories string into a Set */
function parseCategories(categories: string): Set<CategoryName> {
  const parts = categories.split(",").map((s) => s.trim());
  return new Set(parts.filter((s): s is CategoryName => (M365_CATEGORIES as readonly string[]).includes(s)));
}

/** Convert a Set of categories back to a comma-separated string */
function serializeCategories(categories: Set<CategoryName>): string {
  return [...categories].join(",");
}

/** Form state derived from SettingsConfig */
interface FormState {
  m365Instance: string;
  m365Categories: Set<CategoryName>;
  includeIpv6: boolean;
  includeUrls: boolean;
  dryRun: boolean;
  maxEntries: number;
}

function configToForm(config: SettingsConfig): FormState {
  return {
    m365Instance: config.m365Instance.value,
    m365Categories: parseCategories(config.m365Categories.value),
    includeIpv6: config.includeIpv6.value,
    includeUrls: config.includeUrls.value,
    dryRun: config.dryRun.value,
    maxEntries: config.maxEntries.value,
  };
}

function isDirty(form: FormState, saved: FormState): boolean {
  if (form.m365Instance !== saved.m365Instance) return true;
  if (serializeCategories(form.m365Categories) !== serializeCategories(saved.m365Categories)) return true;
  if (form.includeIpv6 !== saved.includeIpv6) return true;
  if (form.includeUrls !== saved.includeUrls) return true;
  if (form.dryRun !== saved.dryRun) return true;
  if (form.maxEntries !== saved.maxEntries) return true;
  return false;
}

function buildUpdate(form: FormState, saved: FormState): SettingsUpdate {
  const update: SettingsUpdate = {};
  if (form.m365Instance !== saved.m365Instance) update.m365Instance = form.m365Instance;
  if (serializeCategories(form.m365Categories) !== serializeCategories(saved.m365Categories))
    update.m365Categories = serializeCategories(form.m365Categories);
  if (form.includeIpv6 !== saved.includeIpv6) update.includeIpv6 = form.includeIpv6;
  if (form.includeUrls !== saved.includeUrls) update.includeUrls = form.includeUrls;
  if (form.dryRun !== saved.dryRun) update.dryRun = form.dryRun;
  if (form.maxEntries !== saved.maxEntries) update.maxEntries = form.maxEntries;
  return update;
}

export function SettingsCard({ onMutation }: { onMutation?: () => void }) {
  const [savedConfig, setSavedConfig] = useState<SettingsConfig | null>(null);
  const [form, setForm] = useState<FormState>({
    m365Instance: "Worldwide",
    m365Categories: new Set<CategoryName>(["Optimize", "Allow", "Default"]),
    includeIpv6: false,
    includeUrls: false,
    dryRun: false,
    maxEntries: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchSettings();
      setSavedConfig(config);
      setForm(configToForm(config));
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setSaveError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savedForm = savedConfig ? configToForm(savedConfig) : form;
  const dirty = isDirty(form, savedForm);
  const noCategoriesSelected = form.m365Categories.size === 0;

  const handleCategoryToggle = (category: CategoryName, checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.m365Categories);
      if (checked) {
        next.add(category);
      } else {
        next.delete(category);
      }
      return { ...prev, m365Categories: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const update = buildUpdate(form, savedForm);
      const result = await updateSettings(update);
      setSavedConfig(result);
      setForm(configToForm(result));
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

  const handleResetToDefaults = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const result = await updateSettings({});
      setSavedConfig(result);
      setForm(configToForm(result));
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
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>
            Settings
          </Text>
          <Tooltip
            content="Configure how the M365 split tunnel sync behaves. Settings can come from environment variables, KV overrides, or defaults."
            render={<span className="inline-flex cursor-default text-kumo-subtle" />}
          >
            <Info size={14} />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={handleResetToDefaults} disabled={saving || loading}>
            Reset to Defaults
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!dirty || saving || loading}>
            {saving ? "Saving\u2026" : "Save"}
          </Button>
        </div>
      </div>

      {loading && <Text variant="secondary">Loading\u2026</Text>}
      {saveSuccess && (
        <Banner
          variant="default"
          description="Settings saved. Changes will apply on the next sync."
          className="mb-3"
        />
      )}
      {saveError && <Banner variant="error" description={saveError} className="mb-3" />}

      {!loading && savedConfig && (
        <>
          {/* M365 Endpoints section */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Gear size={14} className="text-kumo-subtle" />
              <Text DANGEROUS_style={{ fontWeight: 600 }}>M365 Endpoints</Text>
            </div>

            {/* M365 Instance */}
            <div className="flex items-center justify-between py-2.5 border-t border-kumo-hairline">
              <div className="min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <Text>M365 Instance</Text>
                  <SourceBadge source={savedConfig.m365Instance.source} />
                </div>
                <div className="mt-0.5">
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    {SETTING_DESCRIPTIONS.m365Instance}
                  </Text>
                </div>
              </div>
              <div className="shrink-0">
                <Select
                  value={form.m365Instance}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, m365Instance: value as string }))}
                  aria-label="M365 Instance"
                  size="sm"
                >
                  {M365_INSTANCES.map((inst) => (
                    <Select.Option key={inst.value} value={inst.value}>
                      {inst.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* M365 Categories */}
            <div className="border-t border-kumo-hairline">
              <div className="flex items-center gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <Text>M365 Categories</Text>
                  <SourceBadge source={savedConfig.m365Categories.source} />
                </div>
              </div>
              <div className="divide-y divide-kumo-hairline">
                {M365_CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center justify-between py-2.5 pl-3">
                    <div className="min-w-0 mr-4">
                      <div className="flex items-center gap-2">
                        <Text>{category}</Text>
                        {category === "Optimize" && <Badge variant="success">Recommended</Badge>}
                      </div>
                      <div className="mt-0.5">
                        <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                          {CATEGORY_DESCRIPTIONS[category]}
                        </Text>
                      </div>
                    </div>
                    <Switch
                      checked={form.m365Categories.has(category)}
                      onCheckedChange={(checked) => handleCategoryToggle(category, checked)}
                      aria-label={`Toggle ${category} category`}
                    />
                  </div>
                ))}
              </div>
              {noCategoriesSelected && (
                <Banner
                  variant="alert"
                  title="No categories selected"
                  description="At least one category must be selected for the sync to include any endpoints."
                  className="mt-2"
                />
              )}
            </div>

            {/* Include IPv6 */}
            <div className="flex items-center justify-between py-2.5 border-t border-kumo-hairline">
              <div className="min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <Text>Include IPv6</Text>
                  <SourceBadge source={savedConfig.includeIpv6.source} />
                </div>
                <div className="mt-0.5">
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    {SETTING_DESCRIPTIONS.includeIpv6}
                  </Text>
                </div>
              </div>
              <Switch
                checked={form.includeIpv6}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, includeIpv6: checked }))}
                aria-label="Toggle Include IPv6"
              />
            </div>

            {/* Include URLs */}
            <div className="flex items-center justify-between py-2.5 border-t border-kumo-hairline">
              <div className="min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <Text>Include URLs</Text>
                  <SourceBadge source={savedConfig.includeUrls.source} />
                </div>
                <div className="mt-0.5">
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    {SETTING_DESCRIPTIONS.includeUrls}
                  </Text>
                </div>
              </div>
              <Switch
                checked={form.includeUrls}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, includeUrls: checked }))}
                aria-label="Toggle Include URLs"
              />
            </div>
          </div>

          {/* Sync Behavior section */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Gear size={14} className="text-kumo-subtle" />
              <Text DANGEROUS_style={{ fontWeight: 600 }}>Sync Behavior</Text>
            </div>

            {/* Dry Run */}
            <div className="flex items-center justify-between py-2.5 border-t border-kumo-hairline">
              <div className="min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <Text>Dry Run</Text>
                  <SourceBadge source={savedConfig.dryRun.source} />
                </div>
                <div className="mt-0.5 flex items-start gap-1.5">
                  <Warning size={14} className="mt-0.5 shrink-0 text-kumo-warning" />
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    {SETTING_DESCRIPTIONS.dryRun}
                  </Text>
                </div>
              </div>
              <Switch
                checked={form.dryRun}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, dryRun: checked }))}
                aria-label="Toggle Dry Run"
              />
            </div>

            {/* Max Entries */}
            <div className="flex items-center justify-between py-2.5 border-t border-kumo-hairline">
              <div className="min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <Text>Max Entries</Text>
                  <SourceBadge source={savedConfig.maxEntries.source} />
                </div>
                <div className="mt-0.5">
                  <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>
                    {SETTING_DESCRIPTIONS.maxEntries}
                  </Text>
                </div>
              </div>
              <Input
                type="number"
                min={1}
                value={form.maxEntries}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) {
                    setForm((prev) => ({ ...prev, maxEntries: val }));
                  }
                }}
                aria-label="Max Entries"
                size="sm"
                className="w-24"
              />
            </div>
          </div>
        </>
      )}
    </LayerCard>
  );
}
