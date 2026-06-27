import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Phone, ExternalLink, Clock } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getClinic } from "@/lib/queries/clinic";
import { formatPrice, formatFreshness, freshnessState, pluralizeRu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClinic(id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/poisk" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={16} />К поиску
      </Link>

      {!data ? (
        <div className="mt-8">
          <EmptyState icon={Building2} title="Клиника не найдена" description="Возможно, ссылка устарела." />
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{data.clinic.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {[data.clinic.city, data.clinic.address].filter(Boolean).join(", ") || "город не указан"}
            </span>
            {data.clinic.phone && (
              <span className="inline-flex items-center gap-1"><Phone size={14} />{data.clinic.phone}</span>
            )}
            {data.clinic.website_url && (
              <a href={data.clinic.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                сайт <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Услуги и цены</h2>
            <span className="text-sm text-muted">{data.offers.length} услуг</span>
          </div>

          <div className="mt-3">
            {data.offers.length === 0 ? (
              <EmptyState icon={Building2} title="Нет актуальных цен" description="Для этой клиники пока нет свежих предложений." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Услуга</TH>
                    <TH>Срок</TH>
                    <TH>Обновлено</TH>
                    <TH className="text-right">Цена</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.offers.map((o) => {
                    const fresh = freshnessState(o.last_seen_at);
                    return (
                      <TR key={o.id}>
                        <TD>
                          <Link href={`/poisk?q=${encodeURIComponent(o.service!.canonical_name)}`} className="hover:text-accent">
                            {o.service!.canonical_name}
                          </Link>
                        </TD>
                        <TD className="text-muted">
                          {o.duration_days ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {o.duration_days} {pluralizeRu(o.duration_days, ["день", "дня", "дней"])}
                            </span>
                          ) : "—"}
                        </TD>
                        <TD>
                          <Badge variant={fresh === "fresh" ? "fresh" : "stale"}>
                            {formatFreshness(o.last_seen_at)}
                          </Badge>
                        </TD>
                        <TD className="numeric text-right font-semibold tabular-nums">{formatPrice(o.price)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
