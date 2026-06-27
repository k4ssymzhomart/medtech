import {
  BookOpen,
  Layers,
  Database,
  Tag,
  Inbox,
  Archive,
  LucideIcon,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { getAdminStats } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-border text-muted">
          <Icon size={18} />
        </span>
        <div>
          <div className="numeric text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-sm text-muted">{label}</div>
        </div>
      </CardBody>
    </Card>
  );
}

export default async function AdminDashboard() {
  const s = await getAdminStats();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
      <p className="mt-1 text-sm text-muted">
        Состояние системы. Счётчики берутся из живой базы.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={BookOpen} label="услуг в каталоге" value={s.catalog} />
        <Kpi icon={Layers} label="категорий" value={s.categories} />
        <Kpi icon={Database} label="источников" value={s.sources} />
        <Kpi icon={Tag} label="активных предложений" value={s.offers} />
        <Kpi icon={Inbox} label="в очереди на разбор" value={s.queue} />
        <Kpi icon={Archive} label="в архиве" value={s.archived} />
      </div>

      <p className="mt-6 text-xs text-muted-2">
        Запуски парсинга, логи и метрики появятся после подключения источников.
      </p>
    </div>
  );
}
