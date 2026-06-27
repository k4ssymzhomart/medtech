import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FooterCTA() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight">
          Найдите лучшую цену на свою услугу
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Один поиск вместо десятков сайтов клиник.
        </p>
        <Link
          href="/poisk"
          className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-[2px] border border-accent bg-accent px-7 font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Начать поиск
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
