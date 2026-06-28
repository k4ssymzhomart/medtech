import { SlideFrame } from "../_components/SlideFrame";

const methods = [
  {
    n: "01",
    title: "Table-aware экстрактор",
    body: "Парсит HTML-таблицы прайс-листов: находит заголовки, нормализует строки, сопоставляет с каталогом по prefix + fuzzy match.",
  },
  {
    n: "02",
    title: "PDF parser",
    body: "pdfminer извлекает текст из PDF-прайсов: поколонная разбивка, страничный анализ, устойчив к типографским артефактам.",
  },
  {
    n: "03",
    title: "Playwright (SPA-рендеринг)",
    body: "Headless-браузер для клиник на Vue/React: ждёт динамической загрузки, делает снимок DOM после рендеринга.",
  },
  {
    n: "04",
    title: "Human-in-the-loop очередь",
    body: "Неразрешённые позиции попадают в очередь администратора. Специалист сопоставляет позицию с каталогом — без платных LLM-вызовов.",
  },
];

const quality = [
  { label: "Нет оплаченных LLM-вызовов", detail: "code-only pipeline" },
  { label: "1 921 предложение", detail: "из открытых источников" },
  { label: "4 категории услуг", detail: "анализы · приёмы · УЗИ · диагностика" },
  { label: "Свежесть данных", detail: "метка актуальности на каждой карточке" },
  { label: "Дедупликация", detail: "нормализованные названия услуг по каталогу" },
];

export default function Slide6() {
  return (
    <SlideFrame slide={6}>
      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: "68px",
          left: "100px",
          right: "100px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            letterSpacing: "0.12em",
            color: "#0070f3",
            textTransform: "uppercase" as const,
            fontWeight: 600,
          }}
        >
          Данные и качество
        </div>
        <div style={{ width: "1px", height: "18px", background: "#eaeaea" }} />
        <h2
          style={{
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: 0,
          }}
        >
          Как мы добиваемся качества без LLM
        </h2>
      </div>

      {/* Two columns */}
      <div
        style={{
          position: "absolute",
          top: "168px",
          left: "100px",
          right: "100px",
          bottom: "80px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
        }}
      >
        {/* Left — extraction methods */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "13px",
              color: "#8f8f8f",
              letterSpacing: "0.06em",
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              marginBottom: "4px",
            }}
          >
            МЕТОДЫ ИЗВЛЕЧЕНИЯ
          </div>

          {methods.map((m, i) => (
            <div
              key={i}
              style={{
                borderLeft: "3px solid #0070f3",
                paddingLeft: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    color: "#0070f3",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  {m.n}
                </span>
                <span
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "#0a0a0a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {m.title}
                </span>
              </div>
              <div style={{ fontSize: "15px", color: "#666666", lineHeight: 1.5 }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>

        {/* Right — quality signals */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "13px",
              color: "#8f8f8f",
              letterSpacing: "0.06em",
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              marginBottom: "28px",
            }}
          >
            КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ КАЧЕСТВА
          </div>

          <div
            style={{
              border: "1px solid #eaeaea",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            {quality.map((q, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "22px 28px",
                  borderBottom: i < quality.length - 1 ? "1px solid #eaeaea" : "none",
                  gap: "0",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#0a0a0a",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {q.label}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#8f8f8f",
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    textAlign: "right" as const,
                  }}
                >
                  {q.detail}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div
            style={{
              marginTop: "auto",
              padding: "24px 28px",
              border: "1px solid #eaeaea",
              borderRadius: "2px",
              background: "#fafafa",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#0a0a0a",
                marginBottom: "6px",
              }}
            >
              Human-in-the-loop без LLM
            </div>
            <div style={{ fontSize: "14px", color: "#666666", lineHeight: 1.5 }}>
              Администратор вручную разрешает неоднозначные позиции через
              очередь в панели — нулевые API-расходы на нормализацию.
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
