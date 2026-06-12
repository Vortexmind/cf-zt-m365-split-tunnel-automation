import { useState, useEffect } from "react";
import { LayerCard, Text, Banner, CloudflareLogo } from "@cloudflare/kumo";
import { isSessionExpired, fetchConfigStatus } from "./lib/api";
import type { ConfigStatus } from "./lib/types";
import { ActivityCard } from "./components/ActivityCard";
import { ScheduleCard } from "./components/ScheduleCard";
import { PreviewCard } from "./components/PreviewCard";
import { EntriesCard } from "./components/EntriesCard";
import { AccessUnconfigured } from "./components/AccessUnconfigured";

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

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionExpired(isSessionExpired());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <CloudflareLogo variant="glyph" color="color" className="w-12 h-12 mx-auto mb-2" />
        <Text variant="heading2" as="h1" DANGEROUS_style={{ color: "#f97316" }}>M365 Split Tunnel Automation</Text>
        <div style={{ marginTop: "0.25rem" }}>
          <Text variant="secondary">Automated sync of Microsoft 365 endpoints to your Zero Trust split tunnel exclude list</Text>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem", maxWidth: "960px", margin: "0 auto" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ActivityCard />
          <ScheduleCard />
        </div>
        <PreviewCard />
        <EntriesCard />
      </div>
    </div>
  );
}
