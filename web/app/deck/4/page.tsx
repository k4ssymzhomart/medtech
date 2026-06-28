import { SlideFrame } from "../_components/SlideFrame";

// Drop real screenshots into /public/deck/ and swap the placeholder divs
// below for: <img src="/deck/screen-*.png" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'2px'}} alt="..." />
const screens = [
  { label: "Поиск и сортировка", desc: "результаты, дешевле — выше" },
  { label: "Карта клиник", desc: "ценовые пины на Leaflet-карте" },
  { label: "Карточка клиники", desc: "услуги, адрес, часы, рейтинг" },
  { label: "Сравнение цен", desc: "несколько клиник рядом" },
];

export default function Slide4() {
  return (
    <SlideFrame slide={4}>
      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: "72px",
          left: "100px",
          right: "100px",
          display: "flex",
          alignItems: "center",
          gap: "28px",
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
          Продукт
        </div>
        <div
          style={{
            width: "1px",
            height: "18px",
            background: "#eaeaea",
          }}
        />
        <h2
          style={{
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: 0,
          }}
        >
          Живые экраны приложения
        </h2>
      </div>

      {/* 2×2 grid */}
      <div
        style={{
          position: "absolute",
          top: "166px",
          left: "100px",
          right: "100px",
          bottom: "80px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "20px",
        }}
      >
        {screens.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Screenshot placeholder */}
            <div
              style={{
                flex: 1,
                border: "1px solid #eaeaea",
                borderRadius: "2px",
                background: "#fafafa",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              {/* Crosshair icon */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="0.5" y="0.5" width="39" height="39" stroke="#eaeaea" strokeWidth="1"/>
                <line x1="20" y1="0" x2="20" y2="40" stroke="#eaeaea" strokeWidth="1"/>
                <line x1="0" y1="20" x2="40" y2="20" stroke="#eaeaea" strokeWidth="1"/>
                <circle cx="20" cy="20" r="6" stroke="#c0c0c0" strokeWidth="1" fill="none"/>
              </svg>
              <div
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color: "#c0c0c0",
                  letterSpacing: "0.04em",
                }}
              >
                скриншот — {s.label.toLowerCase()}
              </div>
            </div>

            {/* Label */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "10px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#0a0a0a",
                  letterSpacing: "-0.01em",
                }}
              >
                {s.label}
              </span>
              <span style={{ fontSize: "13px", color: "#8f8f8f" }}>
                {s.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}
