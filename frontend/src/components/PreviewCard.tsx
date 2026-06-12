import { useState, useCallback } from "react";
import { LayerCard, Text, Badge, Button, Banner, Table, Loader, Tooltip } from "@cloudflare/kumo";
import { Eye, Info } from "@phosphor-icons/react";
import { fetchPreview } from "../lib/api";
import type { PreviewResult } from "../lib/types";

function FieldRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="flex items-center gap-1 shrink-0">
        <Text variant="secondary">{label}</Text>
        {tooltip && (
          <Tooltip content={tooltip} render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
            <Info size={13} />
          </Tooltip>
        )}
      </div>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}

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
    <LayerCard className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Preview</Text>
          <Tooltip content="Fetches the latest M365 endpoints and shows what would change if a sync ran now. Does not apply any changes." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
            <Info size={14} />
          </Tooltip>
        </div>
        <Button variant="secondary" icon={Eye} onClick={handlePreview} disabled={loading}>
          Run Preview
        </Button>
      </div>
      {!data && !loading && !error && (
        <Text variant="secondary">Click Run Preview to see what the next sync would add or remove — no changes are applied.</Text>
      )}
      {loading && <div className="flex items-center gap-2 py-2"><Loader size="base" /><Text variant="secondary">Fetching M365 endpoints\u2026</Text></div>}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <>
          <div className="divide-y divide-kumo-hairline">
            <FieldRow label="M365 Version">
              <Text variant="mono">{data.version || "-"}</Text>
            </FieldRow>
            <FieldRow label="Candidates" tooltip="Total M365 endpoints matching your service area, category, and IP version filters">
              <Text>{data.candidates}</Text>
            </FieldRow>
            <FieldRow label="Total After Merge" tooltip="How many entries the split tunnel list would contain after this sync, including preserved entries">
              <Text>{data.totalAfter}</Text>
            </FieldRow>
          </div>
          {data.versionWarning && (
            <Banner variant="alert" description={data.versionWarning} className="mt-3" />
          )}
          <div className="mt-4">
            <Text variant="secondary" DANGEROUS_style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
              To Add ({data.added.length})
            </Text>
            {data.added.length > 0 ? (
              <div className="mt-1 overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Address / Host</Table.Head>
                      <Table.Head>Type</Table.Head>
                      <Table.Head>Description</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.added.map((entry) => (
                      <Table.Row key={entry.key}>
                        <Table.Cell><Text variant="mono">{entry.key}</Text></Table.Cell>
                        <Table.Cell><Badge variant={entry.type === "address" ? "info" : "secondary"}>{entry.type}</Badge></Table.Cell>
                        <Table.Cell>{entry.description}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            ) : (
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>None</Text>
            )}
          </div>
          <div className="mt-4">
            <Text variant="secondary" DANGEROUS_style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
              To Remove ({data.removed.length})
            </Text>
            {data.removed.length > 0 ? (
              <div className="mt-1 overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Address / Host</Table.Head>
                      <Table.Head>Type</Table.Head>
                      <Table.Head>Description</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.removed.map((entry) => (
                      <Table.Row key={entry.key}>
                        <Table.Cell><Text variant="mono">{entry.key}</Text></Table.Cell>
                        <Table.Cell><Badge variant={entry.type === "address" ? "info" : "secondary"}>{entry.type}</Badge></Table.Cell>
                        <Table.Cell>{entry.description}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            ) : (
              <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>None</Text>
            )}
          </div>
        </>
      )}
    </LayerCard>
  );
}
