import { SlideFrame } from "../_components/SlideFrame";

const roadmap = [
  {
    phase: "Ближайшее",
    tag: "Q3 2025",
    items: [
      {
        title: "Рейтинги и часы работы из 2GIS",
        desc: "Автоматическое обогащение карточек клиник актуальными данными через 2GIS API.",
      },
      {
        title: "Свежесть цен",
        desc: "Автоматическая пометка устаревших предложений и периодический пересбор прайс-листов.",
      },
    ],
  },
  {
    phase: "Среднесрочное",
    tag: "Q4 2025",
    items: [
      {
        title: "Подписки клиник",
        desc: "Расширенные карточки с акционными ценами, онлайн-записью и верификацией клиники.",
      },
      {
        title: "Мобильное приложение",
        desc: "React Native-приложение: поиск, карта и избранные клиники в кармане.",
      },
    ],
  },
  {
    phase: "Долгосрочное",
    tag: "2026",
    items: [
      {
        title: "Онлайн-запись на приём",
        desc: "Прямая запись к врачу из карточки клиники без звонка в регистратуру.",
      },
      {
        title: "Партнёрства с клиниками",
        desc: "CRM-интеграции, аналитика трафика и инструменты для клиник-партнёров.",
      },
    ],
  },
];

export default function Slide7() {
  return (
    <SlideFrame slide={7}>
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
          Дорожная карта
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
          Что дальше
        </h2>
      </div>

      {/* Roadmap columns */}
      <div
        style={{
          position: "absolute",
          top: "168px",
          left: "100px",
          right: "100px",
          bottom: "80px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "32px",
        }}
      >
        {roadmap.map((phase, pi) => (
          <div key={pi} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Phase header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                paddingBottom: "20px",
                borderBottom: "1px solid #eaeaea",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  background: pi === 0 ? "#0070f3" : "#eaeaea",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#0a0a0a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {phase.phase}
                </div>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color: pi === 0 ? "#0070f3" : "#8f8f8f",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                }}
              >
                {phase.tag}
              </div>
            </div>

            {/* Items */}
            {phase.items.map((item, ii) => (
              <div
                key={ii}
                style={{
                  border: "1px solid #eaeaea",
                  borderRadius: "2px",
                  padding: "28px 28px 30px",
                  background: pi === 0 ? "#ffffff" : "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#0a0a0a",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    color: "#666666",
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: "80px",
          left: "100px",
          fontSize: "16px",
          color: "#8f8f8f",
        }}
      >
        MedServicePrice.kz — Команда 112 · 2024
      </div>
    </SlideFrame>
  );
}
