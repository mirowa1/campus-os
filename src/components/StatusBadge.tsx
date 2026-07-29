import type { RiskStatus } from "@/lib/types";

const STYLES: Record<RiskStatus, { label: string; className: string }> = {
  on_track: {
    label: "On track",
    className: "bg-[var(--accent)]/15 text-[var(--accent)]",
  },
  at_risk: {
    label: "At risk",
    className: "bg-[var(--warn)]/15 text-[var(--warn)]",
  },
  failing_risk: {
    label: "Failing risk",
    className: "bg-[var(--danger)]/15 text-[var(--danger)]",
  },
  insufficient_data: {
    label: "Needs data",
    className: "bg-[var(--bg-soft)] text-[var(--muted)]",
  },
};

export function StatusBadge({ status }: { status: RiskStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
