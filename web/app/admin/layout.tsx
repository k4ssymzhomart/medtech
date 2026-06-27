import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { title: "Админка — MedServicePrice.kz" };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border p-4">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-accent text-accent-foreground">
            <Activity size={16} />
          </span>
          <span className="text-sm font-bold tracking-tight">Админка</span>
        </Link>
        <AdminNav />
        <Link
          href="/"
          className="mt-auto flex items-center gap-1.5 px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          На сайт
          <ArrowUpRight size={14} />
        </Link>
      </aside>
      <div className="flex-1">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </div>
    </div>
  );
}
