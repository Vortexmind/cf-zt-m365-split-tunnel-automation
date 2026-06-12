import { useState, useCallback } from "react";
import { LayerCard, Text, Badge, Button, Table, Loader, Banner } from "@cloudflare/kumo";
import { FolderOpen } from "@phosphor-icons/react";
import { fetchEntries } from "../lib/api";
import type { EntriesResult, SplitTunnelEntry } from "../lib/types";

function entryKey(entry: SplitTunnelEntry): string {
  return "address" in entry ? entry.address : entry.host;
}

function entryType(entry: SplitTunnelEntry): "address" | "host" {
  return "address" in entry ? "address" : "host";
}

function EntriesTable({ entries }: { entries: SplitTunnelEntry[] }) {
  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Address/Host</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head>Description</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {entries.map((entry) => (
          <Table.Row key={entryKey(entry)}>
            <Table.Cell>{entryKey(entry)}</Table.Cell>
            <Table.Cell><Badge variant={entryType(entry) === "address" ? "info" : "secondary"}>{entryType(entry)}</Badge></Table.Cell>
            <Table.Cell>{entry.description || ""}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export function EntriesCard() {
  const [data, setData] = useState<EntriesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEntries();
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
      <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.875rem" }}>Current Configuration</Text>
      {!data && !loading && !error && (
        <Text variant="secondary">Click &quot;Load Configuration&quot; to view the current split tunnel exclude list.</Text>
      )}
      {loading && <Loader size="base" />}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Total</Text>
            <Text>{data.totalCount} (M365-managed: {data.managedCount}, Preserved: {data.preservedCount})</Text>
          </div>
          <Text variant="heading3" as="h3" DANGEROUS_style={{ color: "#94a3b8", margin: "0.875rem 0 0.5rem" }}>
            Managed Entries ({data.managedCount})
          </Text>
          {data.managed.length > 0 ? (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <EntriesTable entries={data.managed} />
            </div>
          ) : (
            <Text variant="secondary">No entries</Text>
          )}
          <Text variant="heading3" as="h3" DANGEROUS_style={{ color: "#94a3b8", margin: "0.875rem 0 0.5rem" }}>
            Preserved Entries ({data.preservedCount})
          </Text>
          {data.preserved.length > 0 ? (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <EntriesTable entries={data.preserved} />
            </div>
          ) : (
            <Text variant="secondary">No entries</Text>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button variant="primary" icon={FolderOpen} onClick={handleLoad} disabled={loading}>
          Load Configuration
        </Button>
      </div>
    </LayerCard>
  );
}
