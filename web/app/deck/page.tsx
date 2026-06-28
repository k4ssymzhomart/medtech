import Link from "next/link";

const slides = [
  { n: 1, title: "Титул", desc: "MedServicePrice.kz — Aviasales для медицины" },
  { n: 2, title: "Проблема", desc: "Рынок непрозрачен" },
  { n: 3, title: "Решение + цифры", desc: "1 921 предложение, 36 клиник, 23 города" },
  { n: 4, title: "Продукт", desc: "Скриншоты — поиск, карта, клиника, сравнение" },
  { n: 5, title: "Архитектура", desc: "Источники → Worker → Supabase → Next.js" },
  { n: 6, title: "Данные и качество", desc: "Table-aware, PDF, Playwright, нормализация" },
  { n: 7, title: "Дорожная карта", desc: "2GIS, подписки, мобильное приложение, онлайн-запись" },
];

export default function DeckIndex() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        padding: "80px 100px",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "64px" }}>
        <div
          style={{
            fontSize: "13px",
            color: "#8f8f8f",
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            letterSpacing: "0.06em",
            marginBottom: "16px",
          }}
        >
          medserviceprice.kz / pitch deck / Команда 112
        </div>
        <h1
          style={{
            fontSize: "48px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: 0,
            marginBottom: "12px",
          }}
        >
          Питч-дек — MedServicePrice.kz
        </h1>
        <div style={{ fontSize: "18px", color: "#666666" }}>
          {slides.length} слайдов · скриншотировать при viewport 1920×1080
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "24px",
        }}
      >
        {slides.map((s) => (
          <Link
            key={s.n}
            href={`/deck/${s.n}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                border: "1px solid #eaeaea",
                borderRadius: "2px",
                padding: "32px 32px 28px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                transition: "border-color 0.1s",
              }}
            >
              {/* Slide number */}
              <div
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color: "#0070f3",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                }}
              >
                {String(s.n).padStart(2, "0")}
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#0a0a0a",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {s.title}
              </div>

              {/* Description */}
              <div style={{ fontSize: "15px", color: "#666666", lineHeight: 1.5 }}>
                {s.desc}
              </div>

              {/* Link */}
              <div
                style={{
                  fontSize: "13px",
                  color: "#0070f3",
                  marginTop: "4px",
                  letterSpacing: "0.02em",
                }}
              >
                /deck/{s.n} →
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: "64px", borderTop: "1px solid #eaeaea", paddingTop: "32px", fontSize: "14px", color: "#8f8f8f" }}>
        Каждый слайд — фиксированный фрейм 1920×1080 px · overflow: hidden · без скролла
      </div>
    </div>
  );
}
