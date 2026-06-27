"use client";

// Minimal toast primitive (wired to admin actions in a later phase). Monochrome,
// sharp, bordered — no shadow.
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Toast = { id: number; message: string; variant?: "default" | "accent" };
type ToastCtx = { toast: (message: string, variant?: Toast["variant"]) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback<ToastCtx["toast"]>((message, variant = "default") => {
    const id = Date.now() + Math.floor(performance.now());
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-[2px] border px-4 py-2 text-sm",
              t.variant === "accent"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-background text-foreground",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
