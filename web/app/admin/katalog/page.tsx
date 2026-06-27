import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminStats } from "@/lib/queries/admin";

export const metadata = { title: "Каталог — Админка" };

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const s = await getAdminStats();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Каталог услуг</h1>
      <p className="mt-1 text-sm text-muted">
        Услуги, категории и синонимы. Сейчас в каталоге{" "}
        <span className="numeric text-foreground">{s.catalog}</span> услуг в{" "}
        <span className="numeric text-foreground">{s.categories}</span>{" "}
        категориях.
      </p>

      <div className="mt-6">
        <EmptyState
          icon={BookOpen}
          title="Редактирование каталога подключается позже"
          description="CRUD по услугам, категориям и синонимам появится здесь. Каталог уже наполнен сидом и используется автодополнением в поиске."
        />
      </div>
    </div>
  );
}
