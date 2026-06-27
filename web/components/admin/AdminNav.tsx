"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, Inbox, BookOpen, Archive } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/istochniki", label: "Источники", icon: Database },
  { href: "/admin/ochered", label: "Очередь", icon: Inbox },
  { href: "/admin/katalog", label: "Каталог", icon: BookOpen },
  { href: "/admin/arhiv", label: "Архив", icon: Archive },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {ITEMS.map((it) => {
        const active =
          it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm transition-colors",
              active
                ? "bg-surface font-medium text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            <it.icon size={16} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
