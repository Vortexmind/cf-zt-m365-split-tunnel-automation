import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Badge, Button, Dialog } from "@cloudflare/kumo";
import { Pause, Play, ArrowsClockwise, Trash } from "@phosphor-icons/react";
import { fetchSchedule, updateSchedule, forceSync, removeManaged } from "../lib/api";
import type { ScheduleState } from "../lib/types";

export function ScheduleCard() {
  const [data, setData] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSchedule();
      setData(result);
    } catch {
      // Session expired handled by apiFetch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const result = await updateSchedule(!data.paused);
      setData(result);
    } catch {
      // Session expired handled by apiFetch
    } finally {
      setToggling(false);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      load();
    } catch {
      // Session expired handled by apiFetch
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeManaged();
      load();
    } catch {
      // Session expired handled by apiFetch
    } finally {
      setRemoving(false);
    }
  };

  return (
    <LayerCard>
      <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316", marginBottom: "0.875rem" }}>Schedule</Text>
      {loading && !data && <Text variant="secondary">Loading...</Text>}
      {data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Cron</Text>
            <Text variant="mono">{data.cron || "-"}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">Description</Text>
            <Text>{data.description || "-"}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", fontSize: "0.875rem" }}>
            <Text variant="secondary">State</Text>
            {data.paused ? <Badge variant="warning">Paused</Badge> : <Badge variant="success">Active</Badge>}
          </div>
        </>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
        {data?.paused ? (
          <Button variant="primary" icon={Play} onClick={handleToggle} disabled={toggling}>
            Resume
          </Button>
        ) : (
          <Button variant="destructive" icon={Pause} onClick={handleToggle} disabled={toggling}>
            Pause
          </Button>
        )}
        <Button variant="secondary" icon={ArrowsClockwise} onClick={handleForceSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Force Sync Now"}
        </Button>
        <Dialog.Root role="alertdialog">
          <Dialog.Trigger render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <Button variant="destructive" icon={Trash} disabled={removing} {...props}>Remove Managed</Button>} />
          <Dialog className="p-6">
            <Dialog.Title>Remove Managed Entries</Dialog.Title>
            <Dialog.Description>
              This will remove all M365-managed entries from the split tunnel exclude list. Preserved entries will be kept. Continue?
            </Dialog.Description>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <Dialog.Close render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <Button variant="secondary" {...props}>Cancel</Button>} />
              <Dialog.Close render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <Button variant="destructive" onClick={handleRemove} disabled={removing} {...props}>{removing ? "Removing..." : "Remove"}</Button>} />
            </div>
          </Dialog>
        </Dialog.Root>
      </div>
    </LayerCard>
  );
}
