import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-semibold text-foreground">MedServicePrice.kz</span>
          <span className="mx-2">·</span>
          цены на медицинские услуги по Казахстану
        </div>
        <div className="flex items-center gap-6">
          <Link href="/poisk" className="transition-colors hover:text-foreground">
            Поиск
          </Link>
          <Link href="/sravnenie" className="transition-colors hover:text-foreground">
            Сравнение
          </Link>
          <Link href="/admin" className="transition-colors hover:text-foreground">
            Админка
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-2">
          Только публичные данные. Цены обновляются автоматически и носят
          справочный характер.
        </div>
      </div>
    </footer>
  );
}
