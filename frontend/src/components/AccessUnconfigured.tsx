import { LayerCard, Text, Badge, Button, CloudflareLogo } from "@cloudflare/kumo";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

export function AccessUnconfigured() {
  return (
    <div className="bg-kumo-canvas min-h-screen flex flex-col items-center justify-center" style={{ padding: "2rem" }}>
      <CloudflareLogo variant="glyph" color="color" style={{ marginBottom: "1.5rem" }} />
      <Text variant="heading2" as="h1" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.5rem" }}>Authorization Required</Text>
      <Text variant="secondary" DANGEROUS_style={{ maxWidth: "560px", textAlign: "center", marginBottom: "1.5rem" }}>
        This dashboard requires Cloudflare Access for authentication. Follow the steps below to set up Access and configure your Worker.
      </Text>

      <div style={{ maxWidth: "560px", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Step 1 */}
        <LayerCard>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Badge variant="info">1</Badge>
            <Text variant="heading3" as="h3">Create a Cloudflare Access application</Text>
          </div>
          <Text variant="secondary" DANGEROUS_style={{ marginBottom: "0.75rem" }}>
            In the Zero Trust dashboard, create a new Self-hosted Access application for your Worker's hostname.
          </Text>
          <div style={{ marginBottom: "0.75rem" }}>
            <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Your hostname:</Text>
            <Text variant="mono" DANGEROUS_style={{ color: "#f97316" }}>{hostname}</Text>
          </div>
          <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", textDecoration: "underline", fontSize: "0.875rem" }}>
            Open Zero Trust dashboard
          </a>
        </LayerCard>

        {/* Step 2 */}
        <LayerCard>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Badge variant="info">2</Badge>
            <Text variant="heading3" as="h3">Copy the Application AUD tag</Text>
          </div>
          <Text variant="secondary">
            In the Access application settings, find the Application AUD tag. You will need this in the next step.
          </Text>
        </LayerCard>

        {/* Step 3 */}
        <LayerCard>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Badge variant="info">3</Badge>
            <Text variant="heading3" as="h3">Set environment variables</Text>
          </div>
          <Text variant="secondary" DANGEROUS_style={{ marginBottom: "0.75rem" }}>
            In the Cloudflare dashboard, go to Workers &amp; Pages, select your Worker, then Settings &gt; Variables and Secrets. Set the following:
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem" }}>
              <Text variant="mono" DANGEROUS_style={{ color: "#f97316" }}>ACCESS_TEAM_DOMAIN</Text>
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}> = your team domain (e.g., https://your-team.cloudflareaccess.com)</Text>
            </div>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem" }}>
              <Text variant="mono" DANGEROUS_style={{ color: "#f97316" }}>ACCESS_POLICY_AUD</Text>
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}> = the AUD tag from Step 2</Text>
            </div>
          </div>
          <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem", marginBottom: "0.75rem", fontStyle: "italic" }}>
            Do not set these via wrangler --var, as they would be overwritten on every deploy.
          </Text>
          <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", textDecoration: "underline", fontSize: "0.875rem" }}>
            Open Cloudflare dashboard
          </a>
        </LayerCard>

        {/* Step 4 */}
        <LayerCard>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Badge variant="info">4</Badge>
            <Text variant="heading3" as="h3">Reload the page</Text>
          </div>
          <Text variant="secondary" DANGEROUS_style={{ marginBottom: "0.75rem" }}>
            After setting the environment variables, reload this page. The dashboard should load with Access authentication.
          </Text>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </LayerCard>
      </div>
    </div>
  );
}
