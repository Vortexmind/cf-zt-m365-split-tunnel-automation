import { LayerCard, Text, Badge, Button, CloudflareLogo } from "@cloudflare/kumo";

export function AccountNotConfigured() {
  return (
    <div className="bg-kumo-canvas min-h-screen flex flex-col items-center justify-center" style={{ padding: "2rem" }}>
      <CloudflareLogo variant="glyph" color="color" className="w-12 h-12" style={{ marginBottom: "1.5rem" }} />
      <Text variant="heading2" as="h1" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.5rem" }}>Account Setup Required</Text>
      <Text variant="secondary" DANGEROUS_style={{ maxWidth: "560px", textAlign: "center", marginBottom: "1.5rem" }}>
        The Cloudflare account ID is not configured. This Worker needs your account ID to manage split tunnel entries.
      </Text>

      <div style={{ maxWidth: "560px", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <LayerCard>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Badge variant="info">1</Badge>
            <Text variant="heading3" as="h3">Set the CF_ACCOUNT_ID environment variable</Text>
          </div>
          <Text variant="secondary" DANGEROUS_style={{ marginBottom: "0.75rem" }}>
            In the Cloudflare dashboard, go to Workers &amp; Pages, select your Worker, then Settings &gt; Variables and Secrets. Set CF_ACCOUNT_ID to your Cloudflare account ID.
          </Text>
          <Text variant="secondary" DANGEROUS_style={{ marginBottom: "0.75rem" }}>
            You can find your account ID in the Cloudflare dashboard URL (e.g., dash.cloudflare.com/YOUR_ACCOUNT_ID) or in the Workers &amp; Pages overview page.
          </Text>
          <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", textDecoration: "underline", fontSize: "0.875rem" }}>
            Open Cloudflare dashboard
          </a>
        </LayerCard>

        <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
