import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Badge, Banner, Button, Tooltip } from "@cloudflare/kumo";
import { ArrowsClockwise, Info } from "@phosphor-icons/react";
import { fetchStatus } from "../lib/api";
import type { SyncState } from "../lib/types";
import { FieldRow } from "./FieldRow";

function formatDate(iso: string | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ActivityCard({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<SyncState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStatus();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <LayerCard className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Activity</Text>
          <Tooltip content="Automatically refreshes every 60 seconds. Shows the result of the last completed sync run." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
            <Info size={14} />
          </Tooltip>
        </div>
        <Button variant="secondary" icon={ArrowsClockwise} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>
      {loading && !data && <Text variant="secondary">Loading...</Text>}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <div className="divide-y divide-kumo-hairline">
          <FieldRow label="Last Synced" tooltip="Date and time of the last successful sync to Cloudflare">
            <Text variant="secondary">{formatDate(data.lastSyncedAt)}</Text>
          </FieldRow>
          <FieldRow label="M365 Version" tooltip="Microsoft's version identifier for the published endpoint dataset">
            <Text variant="mono">{data.lastVersion || "-"}</Text>
          </FieldRow>
          {data.lastResultSummary && (
            <>
              <FieldRow label="Candidates" tooltip="Number of M365 endpoints that matched your configured filters">
                <Text>{data.lastResultSummary.candidates}</Text>
              </FieldRow>
              <FieldRow label="Entries Added" tooltip="New entries added to the split tunnel list in the last sync">
                <Text DANGEROUS_style={data.lastResultSummary.added > 0 ? { color: "#22c55e" } : {}}>
                  {data.lastResultSummary.added}
                </Text>
              </FieldRow>
              <FieldRow label="Entries Removed" tooltip="Entries removed from the split tunnel list in the last sync">
                <Text DANGEROUS_style={data.lastResultSummary.removed > 0 ? { color: "#ef4444" } : {}}>
                  {data.lastResultSummary.removed}
                </Text>
              </FieldRow>
              {data.lastResultSummary.dryRun && (
                <div className="pt-2">
                  <Badge variant="info">Dry Run — no changes applied</Badge>
                </div>
              )}
            </>
          )}
          {data.lastError && (
            <Banner
              variant="error"
              title={data.lastError.type || "Sync Error"}
              description={data.lastError.message}
              className="mt-3"
            />
          )}
        </div>
      )}
    </LayerCard>
  );
}
