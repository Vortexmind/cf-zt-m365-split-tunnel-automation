import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Badge, Banner, Button, Tooltip } from "@cloudflare/kumo";
import { ArrowsClockwise, Info } from "@phosphor-icons/react";
import { fetchHistory } from "../lib/api";
import type { HistoryEntry, HistoryOutcome, HistoryOpType, HistoryTrigger } from "../lib/types";

function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  if (!iso) return "-";
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

function outcomeVariant(outcome: HistoryOutcome): "success" | "error" | "warning" | "info" {
  switch (outcome) {
    case "success": return "success";
    case "error": return "error";
    case "skipped": return "warning";
    case "dry_run": return "info";
  }
}

function outcomeLabel(outcome: HistoryOutcome): string {
  switch (outcome) {
    case "success": return "Success";
    case "error": return "Error";
    case "skipped": return "Skipped";
    case "dry_run": return "Dry Run";
  }
}

function opTypeLabel(opType: HistoryOpType): string {
  switch (opType) {
    case "sync": return "Sync";
    case "remove": return "Remove";
  }
}

function triggerLabel(trigger: HistoryTrigger): string {
  switch (trigger) {
    case "manual": return "Manual";
    case "cron": return "Cron";
  }
}

function formatDetails(entry: HistoryEntry): string {
  if (entry.outcome === "error") {
    return entry.errorMessage || entry.errorType || "Unknown error";
  }
  if (entry.outcome === "skipped") {
    if (entry.opType === "sync" && entry.version) {
      return `Up to date (v${entry.version})`;
    }
    if (entry.opType === "remove") {
      return "No managed entries to remove";
    }
    return "No changes";
  }
  if (entry.opType === "sync") {
    const parts: string[] = [];
    if (entry.added && entry.added > 0) parts.push(`${entry.added} added`);
    if (entry.removed && entry.removed > 0) parts.push(`${entry.removed} removed`);
    if (entry.candidates !== undefined) parts.push(`${entry.candidates} candidates`);
    if (entry.preserved !== undefined) parts.push(`${entry.preserved} preserved`);
    return parts.length > 0 ? parts.join(", ") : "No changes";
  }
  if (entry.opType === "remove") {
    const parts: string[] = [];
    if (entry.removedCount !== undefined) parts.push(`${entry.removedCount} removed`);
    if (entry.preservedCount !== undefined) parts.push(`${entry.preservedCount} preserved`);
    return parts.length > 0 ? parts.join(", ") : "Done";
  }
  return "";
}

export function HistoryCard() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHistory();
      setEntries(result);
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
    <LayerCard className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Run History</Text>
          <Tooltip content="Shows sync and remove operations from the last 30 days. Entries are pruned automatically." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
            <Info size={14} />
          </Tooltip>
        </div>
        <Button variant="secondary" icon={ArrowsClockwise} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading && entries.length === 0 && <Text variant="secondary">Loading...</Text>}
      {error && <Banner variant="error" description={error} />}

      {!loading && entries.length === 0 && !error && (
        <Text variant="secondary">No history recorded yet. History is collected from this point forward.</Text>
      )}

      {entries.length > 0 && (
        <div className="divide-y divide-kumo-hairline">
          {entries.map((entry) => (
            <div key={entry.timestamp} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Tooltip content={formatDate(entry.timestamp)} render={<span className="inline-flex" />}>
                    <Text variant="mono" DANGEROUS_style={{ fontSize: "0.8125rem" }}>{formatRelative(entry.timestamp)}</Text>
                  </Tooltip>
                  <Badge variant={entry.opType === "sync" ? "info" : "warning"}>{opTypeLabel(entry.opType)}</Badge>
                  {entry.opType === "sync" && (
                    <Badge variant="neutral">{triggerLabel(entry.trigger)}</Badge>
                  )}
                </div>
                <Badge variant={outcomeVariant(entry.outcome)}>{outcomeLabel(entry.outcome)}</Badge>
              </div>
              <div className="mt-1">
                <Text variant="secondary" DANGEROUS_style={{ fontSize: "0.8125rem" }}>{formatDetails(entry)}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </LayerCard>
  );
}
