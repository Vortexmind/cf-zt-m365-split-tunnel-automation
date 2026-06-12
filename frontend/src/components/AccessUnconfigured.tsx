import { LayerCard, Text, CloudflareLogo } from "@cloudflare/kumo";

export function AccessUnconfigured() {
  return (
    <div className="bg-kumo-canvas min-h-screen flex flex-col items-center justify-center" style={{ color: "#e2e8f0", padding: "2rem" }}>
      <CloudflareLogo variant="glyph" color="color" style={{ marginBottom: "1.5rem" }} />
      <Text variant="heading2" as="h1" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.5rem" }}>Authorization Required</Text>
      <Text variant="secondary" DANGEROUS_style={{ maxWidth: "480px", textAlign: "center", marginBottom: "1.5rem" }}>
        This dashboard requires Cloudflare Access for authentication. Please configure the following environment variables to enable Access.
      </Text>
      <LayerCard style={{ maxWidth: "480px", width: "100%" }}>
        <Text variant="heading3" as="h3" DANGEROUS_style={{ marginBottom: "0.75rem" }}>Required Configuration</Text>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div>
            <Text variant="mono" DANGEROUS_style={{ color: "#f97316" }}>ACCESS_TEAM_DOMAIN</Text>
            <Text variant="secondary">Your Cloudflare Access team domain (e.g. https://your-team.cloudflareaccess.com)</Text>
          </div>
          <div>
            <Text variant="mono" DANGEROUS_style={{ color: "#f97316" }}>ACCESS_POLICY_AUD</Text>
            <Text variant="secondary">The Application AUD tag from your Access application</Text>
          </div>
        </div>
      </LayerCard>
    </div>
  );
}
