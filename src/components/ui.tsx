import type { ReactNode } from "react";

/**
 * Shared building blocks for the redesigned screens. They only use theme
 * tokens (ink, paper, mint, …) so they follow light and dark mode.
 */

export function Card({
  children,
  className = "",
  as: Tag = "section",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  labelledBy?: string;
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={`min-w-0 rounded-2xl border border-line bg-white/70 p-5 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  id,
  title,
  action,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

export type Tone = "safe" | "tight" | "debt" | "neutral";

const toneClass: Record<Tone, string> = {
  safe: "status-safe",
  tight: "status-tight",
  debt: "status-debt",
  neutral: "bg-paper-deep text-ink-soft",
};

/** Status pill. Always carries a word, so colour is never the only signal. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

const barTone: Record<Tone, string> = {
  safe: "bg-mint-bright",
  tight: "bg-warn",
  debt: "bg-coral",
  neutral: "bg-ink-soft",
};

export function ProgressBar({
  value,
  tone = "safe",
  label,
  size = "md",
}: {
  /** 0–100 */
  value: number;
  tone?: Tone;
  label: string;
  size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`w-full overflow-hidden rounded-full bg-paper-deep ${size === "sm" ? "h-1.5" : "h-2"}`}
    >
      <div className={`h-full rounded-full ${barTone[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MiniStat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper-deep/60 px-3 py-2.5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="truncate font-mono text-[15px] font-medium text-ink">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}
