import { SlideFrame } from "../_components/SlideFrame";

const bigStats = [
  {
    num: "1 921",
    label: "ценовых предложений",
    sub: "из открытых прайс-листов клиник",
  },
  {
    num: "36",
    label: "сетей клиник",
    sub: "по всему Казахстану",
  },
  {
    num: "23",
    label: "города",
    sub: "охват от Алматы до Петропавловска",
  },
  {
    num: "90",
    label: "услуг сравнимы",
    sub: "присутствуют в 5 и более городах",
  },
];

export default function Slide3() {
  return (
    <SlideFrame slide={3}>
      {/* Left column — text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "720px",
          height: "1016px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 100px",
        }}
      >
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
          Решение
        </div>

        {/* Heading */}
        <h2
          style={{
            fontSize: "64px",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: "0 0 28px 0",
          }}
        >
          Мы собрали
          <br />
          рынок в одном
          <br />
          месте
        </h2>

        {/* Accent bar */}
        <div
          style={{
            width: "48px",
            height: "4px",
            background: "#0070f3",
            marginBottom: "28px",
          }}
        />

        {/* Body */}
        <div
          style={{
            fontSize: "19px",
            color: "#666666",
            lineHeight: 1.65,
          }}
        >
          Автоматический сбор, нормализация
          <br />
          и сравнение цен на медицинские услуги.
          <br />
          <br />
          4 категории услуг: анализы, приёмы врачей,
          <br />
          УЗИ и функциональная диагностика.
        </div>
      </div>

      {/* Vertical divider */}
      <div
        style={{
          position: "absolute",
          left: "720px",
          top: "80px",
          width: "1px",
          height: "872px",
          background: "#eaeaea",
        }}
      />

      {/* Right column — 2×2 stats grid */}
      <div
        style={{
          position: "absolute",
          left: "760px",
          top: 0,
          right: 0,
          height: "1016px",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0",
            width: "100%",
          }}
        >
          {bigStats.map((s, i) => {
            const isRight = i % 2 === 1;
            const isBottom = i >= 2;
            return (
              <div
                key={i}
                style={{
                  padding: "60px 60px",
                  borderRight: !isRight ? "1px solid #eaeaea" : "none",
                  borderBottom: !isBottom ? "1px solid #eaeaea" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "84px",
                    fontWeight: 700,
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.04em",
                    color: i === 0 ? "#0070f3" : "#0a0a0a",
                    lineHeight: 1,
                    marginBottom: "12px",
                  }}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#0a0a0a",
                    marginBottom: "6px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    color: "#8f8f8f",
                    lineHeight: 1.4,
                  }}
                >
                  {s.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
