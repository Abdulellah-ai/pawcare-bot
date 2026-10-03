"use client";

import { useState, useTransition } from "react";
import type { DalResult } from "@/lib/dal/result";

type Tone = "primary" | "neutral" | "danger";
const TONES: Record<Tone, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  neutral: "border border-border bg-surface hover:bg-surface-2",
  danger: "border border-danger text-danger hover:bg-danger-soft",
};

/** Runs a Server Action, shows pending state and a safe inline error. Optional confirm() for irreversible actions. */
export function ActionButton({
  action, children, confirmText, tone = "neutral", disabled,
}: {
  action: () => Promise<DalResult<unknown>>;
  children: React.ReactNode;
  confirmText?: string;
  tone?: Tone;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setError(r.message);
          });
        }}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]}`}
      >
        {pending ? "جارٍ التنفيذ…" : children}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
