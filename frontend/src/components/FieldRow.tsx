import { Text, Tooltip } from "@cloudflare/kumo";
import { Info } from "@phosphor-icons/react";

export function FieldRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
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
