import { SlideFrame } from "../_components/SlideFrame";

const stats = [
  { num: "1 921", label: "предложений в базе" },
  { num: "36", label: "сетей клиник" },
  { num: "23", label: "города Казахстана" },
  { num: "90", label: "услуг сравнимы в 5+ городах" },
];

export default function Slide1() {
  return (
    <SlideFrame>
      {/* Left column */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "1040px",
          height: "1016px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 100px",
        }}
      >
        {/* Domain label */}
        <div
          style={{
            fontSize: "14px",
            color: "#8f8f8f",
            letterSpacing: "0.06em",
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            marginBottom: "36px",
          }}
        >
          medserviceprice.kz
        </div>

        {/* Main heading */}
        <h1
          style={{
            fontSize: "92px",
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: "0 0 28px 0",
          }}
        >
          MedService
          <br />
          Price.kz
        </h1>

        {/* Accent bar */}
        <div
          style={{
            width: "64px",
            height: "4px",
            background: "#0070f3",
            marginBottom: "32px",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "42px",
            fontWeight: 600,
            color: "#0070f3",
            lineHeight: 1.2,
            marginBottom: "32px",
            letterSpacing: "-0.02em",
          }}
        >
          Aviasales для медицины
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "20px",
            color: "#666666",
            lineHeight: 1.65,
            maxWidth: "680px",
          }}
        >
          Агрегатор цен на медицинские услуги в Казахстане.
          <br />
          Сравните клиники по всему Казахстану за минуту.
        </div>
      </div>

      {/* Vertical divider */}
      <div
        style={{
          position: "absolute",
          left: "1040px",
          top: "80px",
          width: "1px",
          height: "872px",
          background: "#eaeaea",
        }}
      />

      {/* Right column — live stats */}
      <div
        style={{
          position: "absolute",
          left: "1080px",
          top: 0,
          width: "840px",
          height: "1016px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 80px",
        }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              padding: "44px 0",
              borderBottom: i < stats.length - 1 ? "1px solid #eaeaea" : "none",
            }}
          >
            <div
              style={{
                fontSize: "76px",
                fontWeight: 700,
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.03em",
                color: i === 0 ? "#0070f3" : "#0a0a0a",
                lineHeight: 1,
                marginBottom: "10px",
              }}
            >
              {s.num}
            </div>
            <div
              style={{
                fontSize: "18px",
                color: "#666666",
                letterSpacing: "0.01em",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}
