import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ClinicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/poisk"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />К поиску
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Карточка клиники</h1>
      <p className="mt-1 text-sm text-muted-2">
        ID <span className="numeric">{id}</span>
      </p>

      <div className="mt-8">
        <EmptyState
          icon={Building2}
          title="Здесь будут все услуги клиники"
          description="Контакты, часы работы, карта, ссылка на сайт и история цены по каждой услуге. Появится после подключения источников."
        />
      </div>
    </div>
  );
}
