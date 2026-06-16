import { useState, useEffect } from "react";
import { LayerCard, Text, Banner, CloudflareLogo, Button } from "@cloudflare/kumo";
import { Sun, Moon } from "@phosphor-icons/react";
import { isSessionExpired, fetchConfigStatus, fetchSettings } from "./lib/api";
import type { ConfigStatus, SettingsConfig } from "./lib/types";
import { loadMode, saveMode, applyMode } from "./lib/theme";
import type { ColorMode } from "./lib/theme";
import { ActivityCard } from "./components/ActivityCard";
import { ScheduleCard } from "./components/ScheduleCard";
import { ServicesCard } from "./components/ServicesCard";
import { PreviewCard } from "./components/PreviewCard";
import { EntriesCard } from "./components/EntriesCard";
import { AccessUnconfigured } from "./components/AccessUnconfigured";
import { HistoryCard } from "./components/HistoryCard";
import { SettingsCard } from "./components/SettingsCard";

export function App() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigStatus()
      .then(setConfigStatus)
      .catch(() => setConfigStatus({ accessConfigured: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Text variant="secondary">Loading...</Text>
      </div>
    );
  }

  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (configStatus && !configStatus.accessConfigured && !isLocalhost) {
    return <AccessUnconfigured />;
  }

  return <Dashboard />;
}

function Dashboard() {
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());
  const [colorMode, setColorMode] = useState<ColorMode>(loadMode);
  const [tab, setTab] = useState<"dashboard" | "settings" | "history">("dashboard");
  const [dryRunEnabled, setDryRunEnabled] = useState(false);
  const [syncTriggeredAt, setSyncTriggeredAt] = useState(0);

  const handleSyncComplete = () => {
    setSyncTriggeredAt(Date.now());
  };

  useEffect(() => {
    fetchSettings()
      .then((config) => setDryRunEnabled(config.dryRun.value))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionExpired(isSessionExpired());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (newTab: "dashboard" | "settings" | "history") => {
    setTab(newTab);
    if (newTab === "dashboard") {
      fetchSettings()
        .then((config) => setDryRunEnabled(config.dryRun.value))
        .catch(() => {});
    }
  };

  const handleToggleMode = () => {
    const next: ColorMode = colorMode === "dark" ? "light" : "dark";
    saveMode(next);
    applyMode(next);
    setColorMode(next);
  };

  return (
    <div className="bg-kumo-canvas min-h-screen" style={{ color: "#e2e8f0", padding: "1.5rem" }}>
      {sessionExpired && (
        <Banner
          variant="error"
          title="Session expired"
          description="Please reload the page to re-authenticate."
          className="mb-4 max-w-[960px] mx-auto"
        />
      )}
      <div style={{ textAlign: "center", marginBottom: "2rem", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0 }}>
          <Button
            variant="secondary"
            icon={colorMode === "dark" ? Sun : Moon}
            onClick={handleToggleMode}
            aria-label={colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {colorMode === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
        <CloudflareLogo variant="glyph" color="color" className="w-12 h-12 mx-auto mb-2" />
        <Text variant="heading2" as="h1" DANGEROUS_style={{ color: "#f97316" }}>M365 Split Tunnel Automation</Text>
        <div style={{ marginTop: "0.25rem" }}>
          <Text variant="secondary">Automated sync of Microsoft 365 endpoints to your Zero Trust split tunnel exclude list</Text>
        </div>
      </div>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div className="flex gap-1 mb-4 border-b border-kumo-hairline">
          <button
            onClick={() => handleTabChange("dashboard")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "dashboard"
                ? "border-[#f97316] text-[#f97316]"
                : "border-transparent text-kumo-subtle hover:text-kumo-default"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleTabChange("settings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "settings"
                ? "border-[#f97316] text-[#f97316]"
                : "border-transparent text-kumo-subtle hover:text-kumo-default"
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => handleTabChange("history")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "history"
                ? "border-[#f97316] text-[#f97316]"
                : "border-transparent text-kumo-subtle hover:text-kumo-default"
            }`}
          >
            History
          </button>
        </div>
        {tab === "dashboard" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            {dryRunEnabled && (
              <Banner
                variant="alert"
                title="Dry Run mode is active"
                description="Syncs are computing changes but not applying them to the Cloudflare API. Disable Dry Run in Settings to apply changes."
                className="mb-0"
              />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ActivityCard syncTriggeredAt={syncTriggeredAt} />
              <ScheduleCard onSyncComplete={handleSyncComplete} />
            </div>
            <ServicesCard />
            <PreviewCard />
            <EntriesCard />
          </div>
        ) : tab === "settings" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            <SettingsCard />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            <HistoryCard />
          </div>
        )}
      </div>
    </div>
  );
}
