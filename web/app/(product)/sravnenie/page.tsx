import Link from "next/link";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompareData } from "@/lib/queries/clinic";
import { formatPrice } from "@/lib/utils/format";

export const metadata = { title: "Сравнение клиник — MedServicePrice.kz" };
export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ clinics?: string; service?: string }>;
}) {
  const sp = await searchParams;
  const ids = (sp.clinics ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { clinics, rows } = ids.length ? await getCompareData(ids) : { clinics: [], rows: [] };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/poisk" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={16} />К поиску
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Сравнение клиник</h1>
      <p className="mt-1 text-sm text-muted">
        Цены выбранных клиник по общим услугам. Самая низкая цена в строке выделена.
      </p>

      <div className="mt-8">
        {clinics.length < 2 || rows.length === 0 ? (
          <EmptyState
            icon={GitCompareArrows}
            title="Выберите минимум две клиники"
            description="В результатах поиска отметьте «сравнить» у 2-4 клиник, затем нажмите «Сравнить»."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH className="min-w-[220px]">Услуга</TH>
                {clinics.map((c) => (
                  <TH key={c.id} className="text-right">
                    <Link href={`/klinika/${c.id}`} className="hover:text-accent">{c.name}</Link>
                    <div className="font-normal normal-case text-muted-2">{c.city}</div>
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.service.id}>
                  <TD>
                    <Link href={`/poisk?q=${encodeURIComponent(r.service.canonical_name)}`} className="hover:text-accent">
                      {r.service.canonical_name}
                    </Link>
                  </TD>
                  {clinics.map((c) => {
                    const p = r.prices[c.id];
                    const isMin = p != null && p === r.min && Object.keys(r.prices).length > 1;
                    return (
                      <TD key={c.id} className="text-right">
                        {p == null ? (
                          <span className="text-muted-2">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="numeric font-semibold tabular-nums">{formatPrice(p)}</span>
                            {isMin && <Badge variant="best">мин</Badge>}
                          </span>
                        )}
                      </TD>
                    );
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
