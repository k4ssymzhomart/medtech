interface SlideFrameProps {
  children: React.ReactNode;
  slide?: number;
  total?: number;
}

export function SlideFrame({ children, slide, total = 7 }: SlideFrameProps) {
  return (
    <div
      style={{
        width: "1920px",
        height: "1080px",
        overflow: "hidden",
        position: "relative",
        background: "#ffffff",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
        color: "#0a0a0a",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        flexShrink: 0,
      }}
    >
      {children}

      {/* Bottom strip — slide number left, team badge right */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "64px",
          borderTop: "1px solid #eaeaea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#8f8f8f",
            fontFamily:
              "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.04em",
          }}
        >
          {slide !== undefined ? `${slide} / ${total}` : ""}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "#8f8f8f",
            fontFamily:
              "var(--font-jetbrains-mono), ui-monospace, monospace",
            letterSpacing: "0.06em",
          }}
        >
          Команда 112
        </span>
      </div>
    </div>
  );
}
