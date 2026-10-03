import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface p-4 ${className}`}>{children}</section>;
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "accent";
const BADGE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</p>;
}

export const bookingTone = (s: string): Tone => ({ new: "info", confirmed: "accent", completed: "ok", cancelled: "neutral" } as Record<string, Tone>)[s] ?? "neutral";
export const handoffTone = (s: string): Tone => ({ open: "danger", taken: "warn", resolved: "ok" } as Record<string, Tone>)[s] ?? "neutral";
export const reasonTone = (r: string): Tone => (r === "emergency" ? "danger" : r === "complaint" ? "warn" : "info");
export const severityTone = (s: string): Tone => ({ info: "info", warning: "warn", error: "danger", critical: "danger" } as Record<string, Tone>)[s] ?? "neutral";
