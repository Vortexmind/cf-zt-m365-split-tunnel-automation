import { useState, useCallback } from "react";
import { LayerCard, Text, Badge, Button, Banner, Table, Loader } from "@cloudflare/kumo";
import { Eye } from "@phosphor-icons/react";
import { fetchPreview } from "../lib/api";
import type { PreviewResult } from "../lib/types";

export function PreviewCard() {
  const [data, setData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPreview();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <LayerCard>
      <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.875rem" }}>Preview</Text>
      {!data && !loading && !error && (
        <Text variant="secondary">Click &quot;Run Preview&quot; to compare current state with latest M365 endpoints.</Text>
      )}
      {loading && <Loader size="base" />}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Version</Text>
            <Text>{data.version || "-"}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Candidates</Text>
            <Text>{data.candidates}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Total After Merge</Text>
            <Text>{data.totalAfter}</Text>
          </div>
          {data.versionWarning && (
            <Banner variant="alert" description={data.versionWarning} className="mt-3" />
          )}
          <Text variant="heading3" as="h3" DANGEROUS_style={{ color: "#94a3b8", margin: "0.875rem 0 0.5rem" }}>
            Added ({data.added.length})
          </Text>
          {data.added.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Key</Table.Head>
                  <Table.Head>Type</Table.Head>
                  <Table.Head>Description</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.added.map((entry) => (
                  <Table.Row key={entry.key}>
                    <Table.Cell>{entry.key}</Table.Cell>
                    <Table.Cell><Badge variant={entry.type === "address" ? "info" : "secondary"}>{entry.type}</Badge></Table.Cell>
                    <Table.Cell>{entry.description}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Text variant="secondary">No additions</Text>
          )}
          <Text variant="heading3" as="h3" DANGEROUS_style={{ color: "#94a3b8", margin: "0.875rem 0 0.5rem" }}>
            Removed ({data.removed.length})
          </Text>
          {data.removed.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Key</Table.Head>
                  <Table.Head>Type</Table.Head>
                  <Table.Head>Description</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.removed.map((entry) => (
                  <Table.Row key={entry.key}>
                    <Table.Cell>{entry.key}</Table.Cell>
                    <Table.Cell><Badge variant={entry.type === "address" ? "info" : "secondary"}>{entry.type}</Badge></Table.Cell>
                    <Table.Cell>{entry.description}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Text variant="secondary">No removals</Text>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button variant="primary" icon={Eye} onClick={handlePreview} disabled={loading}>
          Run Preview
        </Button>
      </div>
    </LayerCard>
  );
}
