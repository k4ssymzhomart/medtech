"use client";

import { useState, useTransition } from "react";
import { toggleFlag } from "@/lib/actions/admin";
import type { FeatureFlag } from "@/lib/queries/flags";

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
        on ? "border-accent bg-accent" : "border-border bg-surface"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function FlagsClient({ flags }: { flags: FeatureFlag[] }) {
  const [state, setState] = useState(flags);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function flip(key: string, next: boolean) {
    setBusy(key);
    setState((s) => s.map((f) => (f.key === key ? { ...f, enabled: next } : f)));
    start(async () => {
      try {
        await toggleFlag(key, next);
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <ul className="divide-y divide-border rounded-[2px] border border-border">
      {state.map((f) => (
        <li key={f.key} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{f.label ?? f.key}</span>
              <code className="rounded-[2px] bg-surface px-1.5 py-0.5 text-xs text-muted">{f.key}</code>
            </div>
            {f.description && <p className="mt-0.5 text-sm text-muted">{f.description}</p>}
          </div>
          <Toggle on={f.enabled} disabled={pending && busy === f.key} onClick={() => flip(f.key, !f.enabled)} />
        </li>
      ))}
    </ul>
  );
}
