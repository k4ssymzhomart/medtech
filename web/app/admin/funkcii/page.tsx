import { ToggleRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getFlags } from "@/lib/queries/flags";
import { FlagsClient } from "./FlagsClient";

export const metadata = { title: "Функции — Админка" };
export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const flags = await getFlags();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Функции</h1>
      <p className="mt-1 text-sm text-muted">
        Экспериментальные возможности. Включайте, когда готовы — на демо держите выключенными.
      </p>

      <div className="mt-6">
        {flags.length === 0 ? (
          <EmptyState
            icon={ToggleRight}
            title="Таблица флагов ещё не создана"
            description="Примените миграцию supabase/migrations/20260628090000_geo_and_flags.sql в SQL Editor, и флаги появятся здесь."
          />
        ) : (
          <FlagsClient flags={flags} />
        )}
      </div>
    </div>
  );
}
