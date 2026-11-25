import React from "react";
import type { SlideRenderContext } from "./types";

export function renderCover(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    topic,
    subtitle,
    audience,
    englishTitle,
    scenario,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    isBauhaus,
    isChinese,
    isSwiss,
    isKeynote,
    isConsulting,
    isBlueprint,
    isBento,
    isTerminal,
    isClinical,
    isEditorial,
    isEmerald,
    radius,
    cardStyle,
    effectiveTotalPages,
  } = ctx;
  const coverTitle = slideData?.title || topic;
  const coverSubtitle = slideData?.subtitle || subtitle;
  const coverTag = slideData?.sectionTag || scenario;

  if (isKeynote) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "20px 44px",
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: monoFont,
            fontSize: "12px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: palette.accent,
            background: palette.accentSoft,
            padding: "6px 16px",
            borderRadius: "999px",
            marginBottom: "28px",
            border: `1px solid ${palette.accent}40`,
          }}
        >
          {coverTag} · KEYNOTE 2026
        </span>
        <h2
          style={{
            fontFamily: headingFont,
            fontWeight: typography.titleWeight,
            letterSpacing: typography.titleTracking,
            fontSize: "50px",
            lineHeight: 1.14,
            color: palette.text,
            margin: "0 0 22px 0",
            maxWidth: "760px",
          }}
        >
          {coverTitle}
        </h2>
        <p
          style={{
            fontSize: "19px",
            lineHeight: 1.55,
            color: palette.muted,
            margin: "0 0 42px 0",
            maxWidth: "620px",
          }}
        >
          {coverSubtitle}
        </p>
        <div
          style={{
            display: "flex",
            gap: "28px",
            fontFamily: monoFont,
            fontSize: "12px",
            color: palette.muted,
            borderTop: `1px solid ${palette.border}`,
            paddingTop: "18px",
          }}
        >
          <span>AUDIENCE · {audience}</span>
          <span>DECK · {effectiveTotalPages} SLIDES</span>
          <span>16:9 STAGE</span>
        </div>
      </div>
    );
  }

  if (isBento) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: "18px",
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: "36px 38px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              alignSelf: "flex-start",
              fontFamily: monoFont,
              fontSize: "11px",
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: "999px",
              background: palette.accentSoft,
              color: palette.accent,
            }}
          >
            {coverTag} · 2026 RELEASE
          </span>
          <div>
            <h2
              style={{
                fontFamily: headingFont,
                fontWeight: typography.titleWeight,
                letterSpacing: typography.titleTracking,
                fontSize: "40px",
                lineHeight: 1.16,
                margin: "0 0 16px",
                color: palette.text,
              }}
            >
              {coverTitle}
            </h2>
            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: palette.muted,
                margin: 0,
              }}
            >
              {coverSubtitle}
            </p>
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "11.5px",
              color: palette.muted,
            }}
          >
            {audience} · {effectiveTotalPages} SLIDES
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div
            style={{
              ...cardStyle,
              padding: "24px 26px",
              background: palette.accent,
              borderColor: palette.accent,
              color: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontFamily: monoFont, fontSize: "11px", opacity: 0.85 }}>
              KEY UPGRADE
            </span>
            <div style={{ fontSize: "48px", fontWeight: 800, lineHeight: 1 }}>
              3.2×
            </div>
            <span style={{ fontSize: "13px", opacity: 0.9 }}>
              全链路流转效率跃升
            </span>
          </div>
          <div
            style={{
              ...cardStyle,
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                color: palette.muted,
              }}
            >
              MODULAR DESIGN SYSTEM
            </span>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: palette.text,
                lineHeight: 1.3,
              }}
            >
              {englishTitle}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {palette.chartColors.map((hex, i) => (
                <span
                  key={`bsw-${i}`}
                  style={{
                    width: "22px",
                    height: "8px",
                    borderRadius: "999px",
                    background: hex,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChinese) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 140px",
          gap: "32px",
          alignItems: "center",
          padding: "16px 24px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px 8px",
                background: palette.accent,
                color: "#FFFDF9",
                fontSize: "12px",
                fontFamily: headingFont,
                letterSpacing: "0.18em",
                borderRadius: "2px",
              }}
            >
              {coverTag}
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                letterSpacing: "0.16em",
                color: palette.muted,
              }}
            >
              {englishTitle.toUpperCase()}
            </span>
          </div>
          <h2
            style={{
              fontFamily: headingFont,
              fontWeight: typography.titleWeight,
              letterSpacing: typography.titleTracking,
              fontSize: "46px",
              lineHeight: 1.24,
              color: palette.text,
              margin: 0,
            }}
          >
            {coverTitle}
          </h2>
          <div
            style={{
              width: "64px",
              height: "2px",
              background: palette.accent,
            }}
          />
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.7,
              color: palette.muted,
              margin: 0,
              maxWidth: "560px",
            }}
          >
            {coverSubtitle}
          </p>
          <div
            style={{
              marginTop: "24px",
              fontSize: "13px",
              color: palette.muted,
              display: "flex",
              gap: "24px",
            }}
          >
            <span>面向：{audience}</span>
            <span>共 {effectiveTotalPages} 页</span>
          </div>
        </div>
        <div
          style={{
            height: "330px",
            borderLeft: `1px solid ${palette.border}`,
            paddingLeft: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              writingMode: "vertical-rl",
              fontFamily: headingFont,
              fontSize: "15px",
              letterSpacing: "0.35em",
              color: palette.muted,
            }}
          >
            丙午年 · 雅集呈览
          </div>
          <div
            style={{
              width: "44px",
              height: "44px",
              border: `2px solid ${palette.accent}`,
              color: palette.accent,
              fontFamily: headingFont,
              fontSize: "15px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            印
          </div>
        </div>
      </div>
    );
  }

  if (isSwiss) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "230px 1fr",
          gap: "36px",
        }}
      >
        <div
          style={{
            borderRight: `1px solid ${palette.border}`,
            paddingRight: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                letterSpacing: "0.14em",
                color: palette.accent,
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              EDITION 01 / {effectiveTotalPages}P
            </div>
            <div
              style={{
                fontSize: "84px",
                fontWeight: 800,
                lineHeight: 0.92,
                letterSpacing: "-0.06em",
                color: palette.text,
              }}
            >
              01
            </div>
          </div>
          <div
            style={{
              borderTop: `1px solid ${palette.border}`,
              paddingTop: "16px",
              fontSize: "12px",
              color: palette.muted,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontWeight: 700, color: palette.text }}>
              {coverTag}
            </div>
            <div>{audience}</div>
            <div style={{ fontFamily: monoFont, marginTop: "6px" }}>
              16:9 GRID SYSTEM
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: palette.muted,
            }}
          >
            {englishTitle}
          </div>
          <div>
            <h2
              style={{
                fontFamily: headingFont,
                fontWeight: typography.titleWeight,
                letterSpacing: typography.titleTracking,
                fontSize: "48px",
                lineHeight: 1.12,
                color: palette.text,
                margin: "0 0 20px 0",
              }}
            >
              {coverTitle}
            </h2>
            <p
              style={{
                fontSize: "18px",
                lineHeight: 1.55,
                color: palette.muted,
                margin: 0,
                maxWidth: "560px",
              }}
            >
              {coverSubtitle}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span
              style={{
                height: "4px",
                width: "84px",
                background: palette.accent,
                display: "inline-block",
              }}
            />
            <span
              style={{ height: "1px", flex: 1, background: palette.border }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isBauhaus) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          maxWidth: "600px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              background: palette.text,
              color: palette.bg,
              fontFamily: monoFont,
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 10px",
              letterSpacing: "0.12em",
            }}
          >
            {coverTag}
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: "12px",
              color: palette.text,
              fontWeight: 600,
            }}
          >
            {englishTitle.toUpperCase()}
          </span>
        </div>

        <div>
          <h2
            style={{
              fontFamily: headingFont,
              fontWeight: typography.titleWeight,
              letterSpacing: typography.titleTracking,
              fontSize: "48px",
              lineHeight: 1.08,
              color: palette.text,
              margin: "0 0 18px 0",
            }}
          >
            {coverTitle}
          </h2>
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.55,
              color: palette.muted,
              margin: 0,
            }}
          >
            {coverSubtitle}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "24px",
            fontFamily: monoFont,
            fontSize: "12px",
            color: palette.text,
            fontWeight: 600,
          }}
        >
          <span>TARGET · {audience}</span>
          <span>PAGES · {effectiveTotalPages}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom:
            isEditorial || isEmerald || isConsulting || isTerminal || isClinical
              ? `1px solid ${palette.border}`
              : "none",
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              padding: "5px 12px",
              background: palette.accentSoft,
              color: isBrutalist ? palette.text : palette.accent,
              border: isBrutalist
                ? `2px solid ${palette.border}`
                : `1px solid ${palette.accent}35`,
              borderRadius: `${Math.min(radius, 99)}px`,
              fontFamily: monoFont,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {coverTag}
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: "11px",
              letterSpacing: "0.14em",
              color: palette.muted,
              textTransform: "uppercase",
            }}
          >
            {englishTitle}
          </span>
        </div>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: "12px",
            color: palette.muted,
          }}
        >
          {effectiveTotalPages} SLIDES · 2026
        </span>
      </div>

      <div style={{ maxWidth: "740px", margin: "12px 0" }}>
        {(isBlueprint || isTerminal) && (
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "12px",
              color: palette.accent,
              marginBottom: "12px",
            }}
          >
            {isTerminal
              ? "TERMINAL // EQUITY & STRATEGY BRIEFING · LIVE"
              : "> INIT_PRESENTATION_SPEC // ARCH_MODE=ACTIVE"}
          </div>
        )}
        <h2
          style={{
            fontFamily: headingFont,
            fontWeight: typography.titleWeight,
            letterSpacing: typography.titleTracking,
            fontSize: isEditorial ? "50px" : "46px",
            lineHeight: 1.16,
            color: palette.text,
            margin: "0 0 18px 0",
          }}
        >
          {coverTitle}
        </h2>
        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.6,
            color: palette.muted,
            margin: 0,
            maxWidth: "640px",
          }}
        >
          {coverSubtitle}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
          paddingTop: "18px",
          borderTop: `1px solid ${palette.border}`,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: palette.muted,
              marginBottom: "4px",
            }}
          >
            AUDIENCE
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: palette.text }}>
            {audience}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: palette.muted,
              marginBottom: "4px",
            }}
          >
            STRUCTURE
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: palette.text }}>
            4 核心章节 · {effectiveTotalPages} 页叙事
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: palette.muted,
              marginBottom: "4px",
            }}
          >
            ACCENT SYSTEM
          </div>
          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            {palette.chartColors.map((hex, i) => (
              <span
                key={`csw-${i}`}
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: radius > 6 ? "999px" : "2px",
                  background: hex,
                  border: `1px solid ${palette.border}`,
                  display: "inline-block",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
