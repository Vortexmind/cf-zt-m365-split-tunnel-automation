import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Badge, Banner, Button } from "@cloudflare/kumo";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { fetchStatus } from "../lib/api";
import type { SyncState } from "../lib/types";

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

export function ActivityCard() {
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

  useEffect(() => { load(); }, [load]);

  return (
    <LayerCard>
      <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.875rem" }}>Activity</Text>
      {loading && !data && <Text variant="secondary">Loading...</Text>}
      {error && <Banner variant="error" description={error} />}
      {data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Last Synced</Text>
            <Text>{formatDate(data.lastSyncedAt)}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">M365 Version</Text>
            <Text>{data.lastVersion || "-"}</Text>
          </div>
          {data.lastResultSummary && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
                <Text variant="secondary">Candidates</Text>
                <Text>{data.lastResultSummary.candidates}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
                <Text variant="secondary">Added</Text>
                <Text DANGEROUS_style={{ color: "#6ee7b7" }}>{data.lastResultSummary.added}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
                <Text variant="secondary">Removed</Text>
                <Text DANGEROUS_style={{ color: "#f87171" }}>{data.lastResultSummary.removed}</Text>
              </div>
              {data.lastResultSummary.dryRun && (
                <div style={{ marginTop: "0.5rem" }}>
                  <Badge variant="info">Dry Run</Badge>
                </div>
              )}
            </>
          )}
          {data.lastError && (
            <Banner
              variant="error"
              title={data.lastError.type || "Error"}
              description={data.lastError.message}
              className="mt-3"
            />
          )}
        </>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button variant="secondary" icon={ArrowsClockwise} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>
    </LayerCard>
  );
}
