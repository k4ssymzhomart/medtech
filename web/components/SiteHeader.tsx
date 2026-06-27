import Link from "next/link";
import { Activity } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-accent text-accent-foreground">
            <Activity size={16} />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            MedServicePrice<span className="text-muted">.kz</span>
          </span>
        </Link>

        <nav className="flex items-center gap-7 text-sm">
          <Link href="/poisk" className="text-muted transition-colors hover:text-foreground">
            Поиск
          </Link>
          <Link href="/sravnenie" className="text-muted transition-colors hover:text-foreground">
            Сравнение
          </Link>
          <Link
            href="/poisk"
            className="inline-flex h-9 items-center rounded-[2px] border border-accent bg-accent px-4 font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Начать поиск
          </Link>
        </nav>
      </div>
    </header>
  );
}
