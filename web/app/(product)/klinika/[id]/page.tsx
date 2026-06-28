import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Phone, ExternalLink, Clock, Navigation, Star } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClinicLogo } from "@/components/ui/ClinicLogo";
import { Sparkline } from "@/components/ui/Sparkline";
import { ClinicMiniMap } from "@/components/product/ClinicMiniMap";
import { getClinic } from "@/lib/queries/clinic";
import { twogisRoute } from "@/lib/utils/maps";
import { isOpenNow, todayHours } from "@/lib/utils/hours";
import { formatPrice, formatFreshness, freshnessState, pluralizeRu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClinic(id);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/poisk" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} />К поиску
        </Link>
        <div className="mt-8">
          <EmptyState icon={Building2} title="Клиника не найдена" description="Возможно, ссылка устарела." />
        </div>
      </div>
    );
  }

  const { clinic, offers } = data;
  const categories = [...new Set(offers.map((o) => o.service?.category?.name).filter(Boolean) as string[])];
  const prices = offers.map((o) => o.price);
  const priceRange = prices.length
    ? prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? `от ${formatPrice(Math.min(...prices))}`
      : formatPrice(prices[0])
    : null;
  const hasGeo = clinic.lat != null && clinic.lng != null;
  const open = isOpenNow(clinic.working_hours);
  const hours = todayHours(clinic.working_hours);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/poisk" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={16} />К поиску
      </Link>

      {/* Identity header */}
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <div className="flex items-start gap-4">
            <ClinicLogo name={clinic.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight tracking-tight">{clinic.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {categories.map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
                {clinic.rating != null && (
                  <span className="inline-flex items-center gap-1 text-sm text-foreground">
                    <Star size={14} className="fill-current text-warning" />
                    {clinic.rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-sm text-muted">
            <div className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {[clinic.city, clinic.address].filter(Boolean).join(", ") || "город не указан"}
            </div>
            {(hours || clinic.working_hours) && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} />
                  {hours ? `сегодня ${hours}` : "сегодня закрыто"}
                </span>
                <Badge variant={open ? "fresh" : "stale"}>{open ? "работает сейчас" : "закрыто"}</Badge>
              </div>
            )}
            {clinic.phone && (
              <div className="inline-flex items-center gap-1.5">
                <Phone size={14} />
                {clinic.phone}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {clinic.phone && (
              <a
                href={`tel:${clinic.phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-accent bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
              >
                <Phone size={15} /> Позвонить
              </a>
            )}
            {hasGeo && (
              <a
                href={twogisRoute(clinic.lat!, clinic.lng!)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-border px-4 text-sm font-medium hover:border-foreground"
              >
                <Navigation size={15} /> Маршрут
              </a>
            )}
            {clinic.website_url && (
              <a
                href={clinic.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-border px-4 text-sm font-medium hover:border-foreground"
              >
                <ExternalLink size={15} /> Сайт
              </a>
            )}
          </div>
        </div>

        {hasGeo && <ClinicMiniMap lat={clinic.lat!} lng={clinic.lng!} />}
      </div>

      {/* Services */}
      <div className="mt-10 flex items-baseline justify-between border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Услуги и цены</h2>
        <span className="text-sm text-muted">
          {offers.length} услуг{priceRange ? ` · ${priceRange}` : ""}
        </span>
      </div>

      <div className="mt-3">
        {offers.length === 0 ? (
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
              {offers.map((o) => {
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
                      <Badge variant={fresh === "fresh" ? "fresh" : "stale"}>{formatFreshness(o.last_seen_at)}</Badge>
                    </TD>
                    <TD className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <Sparkline points={o.history} />
                        <span className="numeric font-semibold tabular-nums">{formatPrice(o.price)}</span>
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
