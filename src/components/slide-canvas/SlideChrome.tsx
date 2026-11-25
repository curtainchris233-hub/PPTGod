import React from "react";
import type { SlideRenderContext } from "./types";

export function renderDecorativeMotif(ctx: SlideRenderContext) {
  const {
    palette,
    layout,
    slideType,
    isTerminal,
  } = ctx;
  const motif = layout.decorativeMotif;
  if (motif === "none") return null;

  if (motif === "spotlight-orb") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "-110px",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.accent}2B 0%, transparent 68%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-210px",
            left: "-120px",
            width: "440px",
            height: "440px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.chartColors[1]}1F 0%, transparent 70%)`,
          }}
        />
      </div>
    );
  }

  if (motif === "bauhaus-geo") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 960 540"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {slideType === "cover" ? (
          <>
            <rect
              x="690"
              y="0"
              width="270"
              height="270"
              fill={palette.chartColors[1]}
            />
            <circle cx="690" cy="365" r="95" fill={palette.chartColors[0]} />
            <rect
              x="785"
              y="270"
              width="175"
              height="270"
              fill={palette.chartColors[2]}
            />
            <line
              x1="0"
              y1="468"
              x2="960"
              y2="468"
              stroke={palette.border}
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <rect x="0" y="0" width="14" height="180" fill={palette.chartColors[0]} />
            <rect x="0" y="180" width="14" height="180" fill={palette.chartColors[1]} />
            <rect x="0" y="360" width="14" height="180" fill={palette.chartColors[2]} />
          </>
        )}
      </svg>
    );
  }

  if (motif === "ink-wash") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 960 540"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <path
          d="M0 455 Q 240 380 480 432 T 960 398 L 960 540 L 0 540 Z"
          fill={palette.chartColors[1]}
          opacity="0.09"
        />
        <path
          d="M0 485 Q 320 430 620 470 T 960 445 L 960 540 L 0 540 Z"
          fill={palette.text}
          opacity="0.05"
        />
        <rect
          x="24"
          y="24"
          width="912"
          height="492"
          fill="none"
          stroke={palette.border}
          strokeWidth="1"
        />
      </svg>
    );
  }

  if (motif === "corner-brackets") {
    const c = palette.accent;
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 960 540"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <path d="M24 44 L24 24 L44 24" fill="none" stroke={c} strokeWidth="2" />
        <path d="M916 24 L936 24 L936 44" fill="none" stroke={c} strokeWidth="2" />
        <path d="M24 496 L24 516 L44 516" fill="none" stroke={c} strokeWidth="2" />
        <path d="M916 516 L936 516 L936 496" fill="none" stroke={c} strokeWidth="2" />
      </svg>
    );
  }

  if (motif === "swiss-cross") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "26px",
          right: "36px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: "14px",
            height: "14px",
            position: "relative",
            display: "inline-block",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "5px",
              left: 0,
              width: "14px",
              height: "4px",
              background: palette.accent,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "5px",
              top: 0,
              width: "4px",
              height: "14px",
              background: palette.accent,
            }}
          />
        </span>
      </div>
    );
  }

  if (motif === "ribbon-accent") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: `linear-gradient(90deg, ${palette.accent} 0%, ${palette.chartColors[1]} 55%, ${palette.chartColors[2]} 100%)`,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (motif === "bento-dots") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "24px",
          right: "32px",
          display: "flex",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        {palette.chartColors.slice(0, 3).map((hex, idx) => (
          <span
            key={`bdot-${idx}`}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: hex,
              opacity: idx === 0 ? 1 : 0.45,
            }}
          />
        ))}
      </div>
    );
  }

  if (motif === "editorial-drop") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "18px",
          left: "24px",
          right: "24px",
          bottom: "18px",
          border: `1px solid ${palette.border}`,
          opacity: 0.65,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (motif === "hairline-rule") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: palette.accent,
          opacity: isTerminal ? 0.95 : 0.78,
          pointerEvents: "none",
        }}
      />
    );
  }

  return null;
}


export function renderTopChrome(ctx: SlideRenderContext, sectionLabel: string, sectionEn: string) {
  const {
    palette,
    slideType,
    topic,
    scenario,
    slideData,
    monoFont,
    isAcademic,
    isTerminal,
    radius,
  } = ctx;
  if (slideType === "cover") return null;

  const tagText = slideData?.sectionTag || sectionEn;

  if (isAcademic) {
    const steps = [
      "01 Intro",
      "02 Agenda",
      "03 Method",
      "04 Data",
      "05 Compare",
      "06 Roadmap",
    ];
    const activeIdx =
      slideType === "agenda"
        ? 1
        : slideType === "process" || slideType === "image-split"
        ? 2
        : slideType === "data" || slideType === "funnel-donut"
        ? 3
        : slideType === "comparison" || slideType === "swot"
        ? 4
        : 5;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1.5px solid ${palette.accent}`,
          paddingBottom: "10px",
          marginBottom: "18px",
          fontFamily: monoFont,
          fontSize: "11px",
        }}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          {steps.map((s, i) => (
            <span
              key={s}
              style={{
                color: i === activeIdx ? palette.accent : palette.muted,
                fontWeight: i === activeIdx ? 700 : 400,
              }}
            >
              {s}
            </span>
          ))}
        </div>
        <span style={{ color: palette.muted }}>{scenario}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "12px",
        marginBottom: "16px",
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: radius > 6 ? "999px" : "1px",
            background: palette.accent,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: monoFont,
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isTerminal ? palette.accent : palette.muted,
            fontWeight: isTerminal ? 700 : 500,
          }}
        >
          {tagText}
        </span>
        <span style={{ color: palette.border }}>/</span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: palette.text,
          }}
        >
          {sectionLabel}
        </span>
      </div>
      <span
        style={{
          fontFamily: monoFont,
          fontSize: "11px",
          color: palette.muted,
          maxWidth: "340px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {topic}
      </span>
    </div>
  );
}


export function renderFooter(ctx: SlideRenderContext) {
  const {
    palette,
    layout,
    slideType,
    topic,
    audience,
    englishTitle,
    monoFont,
    isConsulting,
    isAcademic,
    isTerminal,
    isClinical,
    effectiveTotalPages,
    currentPageLabel,
  } = ctx;
  if (!layout.showPageNumber || slideType === "cover") return null;
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "11px",
        color: palette.muted,
        fontFamily: monoFont,
      }}
    >
      <span>
        {isConsulting
          ? "Source: Internal Benchmark & Market Intelligence · Confidential"
          : isTerminal
          ? "LIVE TERMINAL TELEMETRY · DATA VERIFIED 2026"
          : isClinical
          ? "Clinical Evidence Deck · n=420 · p < 0.001"
          : isAcademic
          ? `${topic.slice(0, 32)} · Research Symposium 2026`
          : `${englishTitle.toUpperCase()} · ${audience}`}
      </span>
      <span style={{ color: palette.text, fontWeight: 600 }}>
        {currentPageLabel} / {String(effectiveTotalPages).padStart(2, "0")}
      </span>
    </div>
  );
}
