import { SlideFrame } from "../_components/SlideFrame";

// SVG architecture diagram
// viewBox 0 0 1720 580
// Main pipeline: 4 boxes across top at y=0..420
// Admin loop:    queue + admin boxes at y=470..570

const ACCENT = "#0070f3";
const BORDER = "#eaeaea";
const FG = "#0a0a0a";
const MUTED = "#666666";
const MUTED2 = "#8f8f8f";
const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
const SANS = "var(--font-manrope), system-ui, sans-serif";

// Box geometry
const BW = { src: 260, wkr: 460, supa: 270, next: 260 };
const GAP = 120;
const BOX_H = 420;

const X = {
  src: 0,
  wkr: BW.src + GAP,                              // 380
  supa: BW.src + GAP + BW.wkr + GAP,             // 960
  next: BW.src + GAP + BW.wkr + GAP + BW.supa + GAP, // 1350
};
// total width: X.next + BW.next = 1350 + 260 = 1610

const MID_Y = BOX_H / 2; // 210 — arrow midpoint

export default function Slide5() {
  return (
    <SlideFrame slide={5}>
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
            color: ACCENT,
            textTransform: "uppercase" as const,
            fontWeight: 600,
          }}
        >
          Архитектура
        </div>
        <div style={{ width: "1px", height: "18px", background: BORDER }} />
        <h2
          style={{
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: FG,
            margin: 0,
          }}
        >
          Как устроен сервис
        </h2>
      </div>

      {/* SVG diagram */}
      <div
        style={{
          position: "absolute",
          top: "172px",
          left: "100px",
          right: "100px",
        }}
      >
        <svg
          viewBox="0 0 1720 590"
          width="1720"
          height="590"
          style={{ display: "block" }}
        >
          <defs>
            {/* Blue arrowhead for main pipeline */}
            <marker
              id="arr-blue"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={ACCENT} strokeWidth="1" />
            </marker>
            {/* Gray arrowhead for admin loop */}
            <marker
              id="arr-gray"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={MUTED2} strokeWidth="1" />
            </marker>
          </defs>

          {/* ── MAIN PIPELINE BOXES ───────────────────────────────────── */}

          {/* Box 1: Источники */}
          <rect x={X.src} y={0} width={BW.src} height={BOX_H} fill="none" stroke={BORDER} />
          <text x={X.src + BW.src / 2} y={36} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, fill: FG }}>
            Источники
          </text>
          <line x1={X.src + 20} x2={X.src + BW.src - 20} y1={52} y2={52} stroke={BORDER} />
          {["HTML-страницы клиник", "PDF-прайс-листы", "SPA-клиенты (Playwright)"].map((t, i) => (
            <text key={i} x={X.src + 24} y={82 + i * 30} style={{ fontFamily: SANS, fontSize: 14, fill: MUTED }}>
              · {t}
            </text>
          ))}

          {/* Box 2: Python Worker */}
          <rect x={X.wkr} y={0} width={BW.wkr} height={BOX_H} fill="#fafafa" stroke={BORDER} />
          <text x={X.wkr + BW.wkr / 2} y={36} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, fill: FG }}>
            Python Worker
          </text>
          <line x1={X.wkr + 20} x2={X.wkr + BW.wkr - 20} y1={52} y2={52} stroke={BORDER} />

          {/* Steps */}
          {[
            { n: "①", label: "Fetch / Parse" },
            { n: "②", label: "Extract" },
            { n: "③", label: "Normalize" },
            { n: "④", label: "Write" },
          ].map((step, i) => (
            <g key={i}>
              <text x={X.wkr + 24} y={80 + i * 56} style={{ fontFamily: MONO, fontSize: 13, fill: ACCENT, fontWeight: 600 }}>
                {step.n}
              </text>
              <text x={X.wkr + 48} y={80 + i * 56} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, fill: FG }}>
                {step.label}
              </text>
            </g>
          ))}

          {/* Extractor sub-box */}
          <rect x={X.wkr + 20} y={200} width={BW.wkr - 40} height={160} fill="none" stroke={BORDER} rx={0} />
          <text x={X.wkr + 36} y={220} style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, fill: MUTED }}>
            Экстракторы
          </text>
          {["table-aware (HTML-таблицы)", "PDF parser (pdfminer)", "Playwright (SPA-рендеринг)"].map((t, i) => (
            <text key={i} x={X.wkr + 36} y={244 + i * 28} style={{ fontFamily: MONO, fontSize: 12, fill: MUTED }}>
              · {t}
            </text>
          ))}

          {/* Worker note: code-only */}
          <text x={X.wkr + 24} y={390} style={{ fontFamily: SANS, fontSize: 13, fill: MUTED2 }}>
            Без LLM · prefix + fuzzy matching · Human-in-the-loop очередь
          </text>

          {/* Box 3: Supabase */}
          <rect x={X.supa} y={0} width={BW.supa} height={BOX_H} fill="none" stroke={BORDER} />
          <text x={X.supa + BW.supa / 2} y={36} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, fill: FG }}>
            Supabase
          </text>
          <line x1={X.supa + 20} x2={X.supa + BW.supa - 20} y1={52} y2={52} stroke={BORDER} />
          {["PostgreSQL", "Storage", "Auth"].map((t, i) => (
            <text key={i} x={X.supa + 24} y={82 + i * 30} style={{ fontFamily: SANS, fontSize: 14, fill: MUTED }}>
              · {t}
            </text>
          ))}

          {/* Box 4: Next.js */}
          <rect x={X.next} y={0} width={BW.next} height={BOX_H} fill="none" stroke={BORDER} />
          <text x={X.next + BW.next / 2} y={36} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, fill: FG }}>
            Next.js 15
          </text>
          <line x1={X.next + 20} x2={X.next + BW.next - 20} y1={52} y2={52} stroke={BORDER} />
          {[
            { label: "Продукт", sub: "Поиск · Карта · Сравнение" },
            { label: "Адм. панель", sub: "Очередь · Источники · Каталог" },
          ].map((t, i) => (
            <g key={i}>
              <text x={X.next + 24} y={86 + i * 60} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, fill: FG }}>
                {t.label}
              </text>
              <text x={X.next + 24} y={104 + i * 60} style={{ fontFamily: MONO, fontSize: 11, fill: MUTED2 }}>
                {t.sub}
              </text>
            </g>
          ))}

          {/* ── MAIN PIPELINE ARROWS ─────────────────────────────────── */}

          {/* Src → Worker */}
          <path
            d={`M${X.src + BW.src},${MID_Y} L${X.wkr - 8},${MID_Y}`}
            stroke={ACCENT} strokeWidth="1.5" fill="none"
            markerEnd="url(#arr-blue)"
          />

          {/* Worker → Supabase */}
          <path
            d={`M${X.wkr + BW.wkr},${MID_Y} L${X.supa - 8},${MID_Y}`}
            stroke={ACCENT} strokeWidth="1.5" fill="none"
            markerEnd="url(#arr-blue)"
          />

          {/* Supabase → Next.js */}
          <path
            d={`M${X.supa + BW.supa},${MID_Y} L${X.next - 8},${MID_Y}`}
            stroke={ACCENT} strokeWidth="1.5" fill="none"
            markerEnd="url(#arr-blue)"
          />

          {/* ── ADMIN FEEDBACK LOOP ──────────────────────────────────── */}

          {/* Queue box — below Worker */}
          {(() => {
            const qx = X.wkr + 60;
            const qw = BW.wkr - 120;
            const qy = 470;
            const qh = 90;
            const qcx = qx + qw / 2;

            // Admin panel center x (centered on Next.js box)
            const adm_cx = X.next + BW.next / 2;

            return (
              <g>
                <rect x={qx} y={qy} width={qw} height={qh} fill="none" stroke={BORDER} />
                <text x={qcx} y={qy + 32} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, fill: FG }}>
                  Очередь заданий
                </text>
                <text x={qcx} y={qy + 52} textAnchor="middle" style={{ fontFamily: MONO, fontSize: 11, fill: MUTED2 }}>
                  Run Now · batch · retry
                </text>

                {/* Arrow: Next.js (admin) → Queue (L-shaped) */}
                <path
                  d={`M${adm_cx},${BOX_H} L${adm_cx},${qy + qh / 2} L${qx + qw + 8},${qy + qh / 2}`}
                  stroke={MUTED2} strokeWidth="1" strokeDasharray="5 4" fill="none"
                  markerEnd="url(#arr-gray)"
                />

                {/* Arrow: Queue → Worker (upward) */}
                <path
                  d={`M${qcx},${qy} L${qcx},${BOX_H + 8}`}
                  stroke={MUTED2} strokeWidth="1" strokeDasharray="5 4" fill="none"
                  markerEnd="url(#arr-gray)"
                />

                {/* Label on vertical arrow */}
                <text x={qcx + 8} y={qy - 12} style={{ fontFamily: MONO, fontSize: 11, fill: MUTED2 }}>
                  Worker picks up
                </text>

                {/* Панель администратора label */}
                <text x={adm_cx} y={BOX_H + 20} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 12, fill: MUTED2 }}>
                  Панель администратора
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </SlideFrame>
  );
}
