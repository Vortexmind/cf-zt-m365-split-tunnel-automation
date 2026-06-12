import { useState, useEffect, useCallback } from "react";
import { LayerCard, Text, Badge, Button, Dialog, Tooltip } from "@cloudflare/kumo";
import { Pause, Play, ArrowsClockwise, Trash, Info } from "@phosphor-icons/react";
import { fetchSchedule, updateSchedule, forceSync, removeManaged } from "../lib/api";
import type { ScheduleState } from "../lib/types";

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
      // handled
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
      // handled
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
      // handled
    } finally {
      setRemoving(false);
    }
  };

  return (
    <LayerCard className="p-4 flex flex-col">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Text variant="heading3" as="h2" DANGEROUS_style={{ color: "#f97316" }}>Schedule</Text>
            <Tooltip content="Controls whether the automated sync runs on the configured cron schedule." render={<span className="inline-flex cursor-default text-kumo-subtle" />}>
              <Info size={14} />
            </Tooltip>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data?.paused ? (
              <Button variant="primary" icon={Play} onClick={handleToggle} disabled={toggling}>
                Resume
              </Button>
            ) : (
              <Button variant="secondary-destructive" icon={Pause} onClick={handleToggle} disabled={toggling}>
                Pause
              </Button>
            )}
            <Tooltip content="Immediately run a sync against the current M365 endpoint data, regardless of schedule state." render={<span className="inline-flex" />}>
              <Button variant="primary" icon={ArrowsClockwise} onClick={handleForceSync} disabled={syncing}>
                {syncing ? "Syncing\u2026" : "Sync Now"}
              </Button>
            </Tooltip>
          </div>
        </div>
        {loading && !data && <Text variant="secondary">Loading...</Text>}
        {data && (
          <div className="divide-y divide-kumo-hairline">
            <FieldRow label="Cron" tooltip="Standard cron expression for the sync schedule (server-side trigger)">
              <Text variant="mono">{data.cron || "-"}</Text>
            </FieldRow>
            <FieldRow label="Schedule">
              <Text variant="secondary">{data.description || "-"}</Text>
            </FieldRow>
            <FieldRow label="State" tooltip="When Paused, the scheduled handler skips execution but manual Sync Now still works">
              {data.paused ? <Badge variant="warning">Paused</Badge> : <Badge variant="success">Active</Badge>}
            </FieldRow>
          </div>
        )}
      </div>
      <div className="pt-3 mt-3 border-t border-kumo-hairline flex gap-2 flex-wrap">
        <Tooltip content="Removes all M365-managed split tunnel entries. Preserved (manually added) entries are kept. The next scheduled sync will re-add M365 entries." render={<span className="inline-flex" />}>
          <Dialog.Root role="alertdialog">
            <Dialog.Trigger render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
              <Button variant="destructive" icon={Trash} disabled={removing} {...props}>
                Remove Managed
              </Button>
            )} />
            <Dialog className="p-6">
              <Dialog.Title>Remove Managed Entries</Dialog.Title>
              <Dialog.Description>
                This will remove all M365-managed entries from the split tunnel exclude list.
                Preserved entries (those without the M365 managed tag) will be kept intact.
                The next scheduled sync will re-populate M365 entries. Continue?
              </Dialog.Description>
              <div className="flex gap-2 justify-end mt-4">
                <Dialog.Close render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
                  <Button variant="secondary" {...props}>Cancel</Button>
                )} />
                <Dialog.Close render={(props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
                  <Button variant="destructive" onClick={handleRemove} disabled={removing} {...props}>
                    {removing ? "Removing\u2026" : "Remove Entries"}
                  </Button>
                )} />
              </div>
            </Dialog>
          </Dialog.Root>
        </Tooltip>
      </div>
    </LayerCard>
  );
}
