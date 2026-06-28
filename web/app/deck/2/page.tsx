import { SlideFrame } from "../_components/SlideFrame";

const problems = [
  {
    n: "01",
    title: "Цены разбросаны по десяткам сайтов",
    body: "Пациент обходит сайты клиник вручную, без гарантии актуальности. Средний поиск занимает от 30 до 60 минут — и нередко заканчивается звонком в регистратуру.",
  },
  {
    n: "02",
    title: "Данные в несовместимых форматах",
    body: "Клиники публикуют прайс-листы как HTML-страницы, PDF-документы и интерактивные SPA-формы. Ни один формат не совместим с другим — сравнение невозможно без ручной работы.",
  },
  {
    n: "03",
    title: "Разница в ценах достигает пяти раз",
    body: "Одна и та же услуга в одном городе стоит от 900 до 4 800 тенге. Без агрегатора пациент об этом не узнает и в большинстве случаев переплачивает.",
  },
];

export default function Slide2() {
  return (
    <SlideFrame slide={2}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "64px",
          display: "flex",
          flexDirection: "column",
          padding: "96px 100px 80px",
        }}
      >
        {/* Top section */}
        <div>
          {/* Slide label */}
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "0.12em",
              color: "#0070f3",
              textTransform: "uppercase" as const,
              fontWeight: 600,
              marginBottom: "28px",
            }}
          >
            Проблема
          </div>

          {/* Main heading */}
          <h2
            style={{
              fontSize: "80px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
              margin: "0 0 24px 0",
            }}
          >
            Рынок медицинских
            <br />
            услуг непрозрачен
          </h2>

          {/* Sub */}
          <div
            style={{
              fontSize: "22px",
              color: "#666666",
              lineHeight: 1.55,
            }}
          >
            Пациент тратит часы, чтобы сравнить цены — и всё равно не знает,
            актуальны ли они сегодня.
          </div>
        </div>

        {/* Push cards to bottom */}
        <div style={{ flex: 1 }} />

        {/* Three problem cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
          }}
        >
          {problems.map((p, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #eaeaea",
                borderRadius: "2px",
                padding: "40px 40px 44px",
              }}
            >
              {/* Number */}
              <div
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color: "#0070f3",
                  letterSpacing: "0.08em",
                  marginBottom: "24px",
                  fontWeight: 600,
                }}
              >
                {p.n}
              </div>

              {/* Accent bar */}
              <div
                style={{
                  width: "32px",
                  height: "3px",
                  background: "#0070f3",
                  marginBottom: "20px",
                }}
              />

              {/* Title */}
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#0a0a0a",
                  lineHeight: 1.3,
                  marginBottom: "18px",
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </div>

              {/* Body */}
              <div
                style={{
                  fontSize: "17px",
                  color: "#666666",
                  lineHeight: 1.65,
                }}
              >
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
