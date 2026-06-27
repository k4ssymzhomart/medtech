import { Search, ListOrdered, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Найдите услугу",
    text: "Введите название анализа, приёма или исследования.",
  },
  {
    icon: ListOrdered,
    title: "Сравните цены",
    text: "Все клиники в одном списке, отсортированы по цене.",
  },
  {
    icon: CheckCircle2,
    title: "Выберите клинику",
    text: "Адрес, рейтинг, дата обновления цены и запись.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight">Как это работает</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[2px] border border-border bg-border sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="bg-background p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-border text-accent">
                  <s.icon size={18} />
                </span>
                <span className="numeric text-sm text-muted-2">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
