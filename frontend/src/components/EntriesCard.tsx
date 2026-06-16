import { useState, useCallback, useEffect } from "react";
import { LayerCard, Text, Badge, Button, Table, Loader, Banner, Tooltip } from "@cloudflare/kumo";
import { ArrowsClockwise, Info } from "@phosphor-icons/react";
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
    <div className="overflow-x-auto">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Address / Host</Table.Head>
            <Table.Head>Type</Table.Head>
            <Table.Head>Description</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {entries.map((entry) => (
            <Table.Row key={entryKey(entry)}>
              <Table.Cell><Text variant="mono">{entryKey(entry)}</Text></Table.Cell>
              <Table.Cell><Badge variant={entryType(entry) === "address" ? "info" : "secondary"}>{entryType(entry)}</Badge></Table.Cell>
              <Table.Cell>{entry.description || ""}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

export function EntriesCard({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<EntriesResult | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { handleLoad(); }, [handleLoad, refreshKey]);

  return (
    <LayerCard className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Current Configuration</Text>
          <Tooltip content="Reads the current split tunnel exclude list from Cloudflare and shows which entries are managed by this automation and which are manually preserved." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
            <Info size={14} />
          </Tooltip>
        </div>
        <Button variant="secondary" icon={ArrowsClockwise} onClick={handleLoad} disabled={loading}>
          Refresh
        </Button>
      </div>
      {loading && <div className="flex items-center gap-2 py-2"><Loader size="base" /><Text variant="secondary">Loading configuration\u2026</Text></div>}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <>
          <div className="flex gap-6 mb-4">
            <div>
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.75rem" }}>Total</Text>
              <Text DANGEROUS_style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.totalCount}</Text>
            </div>
            <div>
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.75rem" }}>Managed</Text>
              <Text DANGEROUS_style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.managedCount}</Text>
            </div>
            <div>
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.75rem" }}>Preserved</Text>
              <Text DANGEROUS_style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.preservedCount}</Text>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-1 mb-2">
              <Text variant="secondary" DANGEROUS_style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                Managed Entries ({data.managedCount})
              </Text>
              <Tooltip content="Entries whose description starts with the managed tag (e.g. [m365-auto]). Owned by this automation and replaced on each sync." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
                <Info size={13} />
              </Tooltip>
            </div>
            {data.managed.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <EntriesTable entries={data.managed} />
              </div>
            ) : (
              <Text variant="secondary">No managed entries found.</Text>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1 mb-2">
              <Text variant="secondary" DANGEROUS_style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                Preserved Entries ({data.preservedCount})
              </Text>
              <Tooltip content="Entries without the managed tag. Manually maintained and never modified by the automation." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
                <Info size={13} />
              </Tooltip>
            </div>
            {data.preserved.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <EntriesTable entries={data.preserved} />
              </div>
            ) : (
              <Text variant="secondary">No preserved entries found.</Text>
            )}
          </div>
        </>
      )}
    </LayerCard>
  );
}
