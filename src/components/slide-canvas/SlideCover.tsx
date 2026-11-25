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
    isChalkboard,
    isScientific,
    isCivic,
    isPmo,
    isPolaroid,
    radius,
    cardStyle,
    effectiveTotalPages,
  } = ctx;
  const coverTitle = slideData?.title || topic;
  const coverSubtitle = slideData?.subtitle || subtitle;
  const coverTag = slideData?.sectionTag || scenario;

  if (isChalkboard) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.45fr 0.9fr",
          gap: "24px",
          padding: "10px 6px",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: "4px",
                background: palette.accentSoft,
                color: palette.accent,
                border: `1px dashed ${palette.accent}`,
              }}
            >
              {coverTag} · 板书微课
            </span>
            <span style={{ fontFamily: monoFont, fontSize: "11px", color: palette.muted }}>
              {effectiveTotalPages} SLIDES
            </span>
          </div>

          <div>
            <h2
              style={{
                fontFamily: headingFont,
                fontWeight: typography.titleWeight,
                letterSpacing: typography.titleTracking,
                fontSize: "42px",
                lineHeight: 1.2,
                color: palette.text,
                margin: "0 0 14px 0",
                paddingBottom: "12px",
                borderBottom: `2.5px dashed ${palette.accent}`,
              }}
            >
              {coverTitle}
            </h2>
            <p
              style={{
                fontSize: "17px",
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
              display: "flex",
              gap: "20px",
              fontFamily: monoFont,
              fontSize: "12px",
              color: palette.muted,
            }}
          >
            <span>授课对象：{audience}</span>
            <span>·</span>
            <span>{englishTitle}</span>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            padding: "22px",
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
                fontWeight: 700,
                color: palette.accent,
                letterSpacing: "0.1em",
                marginBottom: "14px",
              }}
            >
              CHALKBOARD LESSON PLAN
            </div>
            {[
              ["01 情境导入", "用日常现象提出核心驱动问题"],
              ["02 原理拆解", "板书式阶梯推导与公式拆解"],
              ["03 互动演练", "课堂随堂提问与分组实验验证"],
              ["04 归纳巩固", "知识树复盘与分层课后拓展"],
            ].map(([h, d]) => (
              <div
                key={h}
                style={{
                  marginBottom: "12px",
                  paddingBottom: "10px",
                  borderBottom: `1px dashed ${palette.border}`,
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 700, color: palette.text }}>{h}</div>
                <div style={{ fontSize: "12px", color: palette.muted, marginTop: "3px" }}>{d}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: "11px", color: palette.accent }}>
            ★ 护眼高对比板书规范 · 后排清晰可读
          </div>
        </div>
      </div>
    );
  }

  if (isScientific) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `1px solid ${palette.border}`,
            paddingBottom: "12px",
            fontFamily: monoFont,
            fontSize: "11px",
            color: palette.muted,
          }}
        >
          <span style={{ color: palette.accent, fontWeight: 700 }}>
            {coverTag.toUpperCase()} · SCIENTIFIC EVIDENCE DECK
          </span>
          <span>OKABE-ITO COLORBLIND-SAFE · {effectiveTotalPages} SLIDES</span>
        </div>

        <div style={{ maxWidth: "780px" }}>
          <h2
            style={{
              fontFamily: headingFont,
              fontWeight: typography.titleWeight,
              letterSpacing: typography.titleTracking,
              fontSize: "43px",
              lineHeight: 1.18,
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
              borderLeft: `3.5px solid ${palette.accent}`,
              paddingLeft: "16px",
            }}
          >
            {coverSubtitle}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `1px solid ${palette.border}`,
            paddingTop: "16px",
          }}
        >
          <div>
            <div style={{ fontFamily: monoFont, fontSize: "10px", color: palette.muted }}>
              AUDIENCE / REVIEW PANEL
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: palette.text, marginTop: "3px" }}>
              {audience}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: monoFont, fontSize: "10px", color: palette.muted }}>
              CVD-SAFE LEGEND:
            </span>
            {palette.chartColors.map((c, idx) => (
              <span
                key={`${c}-${idx}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontFamily: monoFont,
                  fontSize: "10px",
                  color: palette.text,
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "2px",
                    background: c,
                    display: "inline-block",
                  }}
                />
                {`C${idx + 1}`}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isCivic) {
    const gold = palette.chartColors[1] || "#B45309";
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "center",
          padding: "20px 36px 14px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 20px",
            background: palette.accent,
            color: "#FFFFFF",
            borderRadius: "3px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.14em",
          }}
        >
          <span>★</span>
          <span>{coverTag} · 专项工作汇报</span>
          <span>★</span>
        </div>

        <div style={{ maxWidth: "740px" }}>
          <h2
            style={{
              fontFamily: headingFont,
              fontWeight: typography.titleWeight,
              letterSpacing: typography.titleTracking,
              fontSize: "44px",
              lineHeight: 1.2,
              color: palette.text,
              margin: "0 0 18px 0",
            }}
          >
            {coverTitle}
          </h2>
          <div
            style={{
              width: "120px",
              height: "3px",
              background: `linear-gradient(90deg, ${palette.accent}, ${gold})`,
              margin: "0 auto 18px",
            }}
          />
          <p
            style={{
              fontSize: "18px",
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
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${palette.border}`,
            paddingTop: "14px",
            fontSize: "13px",
            color: palette.muted,
          }}
        >
          <span>汇报对象：<strong style={{ color: palette.text }}>{audience}</strong></span>
          <span style={{ color: gold, fontWeight: 700 }}>{englishTitle}</span>
          <span style={{ fontFamily: monoFont }}>{effectiveTotalPages} 页 · 2026</span>
        </div>
      </div>
    );
  }

  if (isPmo) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: "22px",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "4px",
                background: palette.accent,
                color: "#FFFFFF",
              }}
            >
              PMO · {coverTag}
            </span>
            <span style={{ fontFamily: monoFont, fontSize: "11px", color: "#16A34A", fontWeight: 700 }}>
              ● OVERALL: ON TRACK
            </span>
          </div>

          <div>
            <h2
              style={{
                fontFamily: headingFont,
                fontWeight: typography.titleWeight,
                letterSpacing: typography.titleTracking,
                fontSize: "40px",
                lineHeight: 1.18,
                color: palette.text,
                margin: "0 0 14px 0",
              }}
            >
              {coverTitle}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.58, color: palette.muted, margin: 0 }}>
              {coverSubtitle}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              borderTop: `1px solid ${palette.border}`,
              paddingTop: "14px",
              fontSize: "12px",
              color: palette.muted,
            }}
          >
            <span>评审方：<strong style={{ color: palette.text }}>{audience}</strong></span>
            <span style={{ fontFamily: monoFont }}>{effectiveTotalPages} SLIDES</span>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontFamily: monoFont, fontSize: "11px", fontWeight: 700, color: palette.accent }}>
            PROJECT HEALTH MATRIX (RAG)
          </div>
          {[
            { label: "进度里程碑 Schedule", status: "正常 ON TRACK", color: "#16A34A" },
            { label: "研发质量 Quality", status: "达标 99.2%", color: "#16A34A" },
            { label: "跨部门依赖 Dependencies", status: "关注 WATCH", color: "#D97706" },
            { label: "预算投入 Budget", status: "可控 -4.2%", color: "#2563EB" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 10px",
                borderRadius: "4px",
                background: palette.bg,
                borderLeft: `3.5px solid ${row.color}`,
              }}
            >
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: palette.text }}>{row.label}</span>
              <span style={{ fontFamily: monoFont, fontSize: "11px", fontWeight: 700, color: row.color }}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPolaroid) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.35fr 0.95fr",
          gap: "24px",
          paddingRight: "18px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <span
            style={{
              alignSelf: "flex-start",
              fontFamily: monoFont,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              padding: "5px 12px",
              borderRadius: "999px",
              background: palette.accentSoft,
              color: palette.accent,
            }}
          >
            35MM · {coverTag} · 2026
          </span>
          <h2
            style={{
              fontFamily: headingFont,
              fontWeight: typography.titleWeight,
              letterSpacing: typography.titleTracking,
              fontSize: "43px",
              lineHeight: 1.18,
              color: palette.text,
              margin: 0,
            }}
          >
            {coverTitle}
          </h2>
          <p style={{ fontSize: "17px", lineHeight: 1.65, color: palette.muted, margin: 0 }}>
            {coverSubtitle}
          </p>
          <div style={{ fontFamily: monoFont, fontSize: "12px", color: palette.muted }}>
            STORY FOR · {audience} · {effectiveTotalPages} FRAMES
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${palette.border}`,
            borderRadius: `${radius}px`,
            padding: "16px 16px 26px",
            boxShadow: "0 12px 30px rgba(44, 34, 30, 0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              height: "230px",
              borderRadius: "4px",
              background: `linear-gradient(135deg, ${palette.accent}28 0%, ${palette.chartColors[1]}30 55%, ${palette.bg} 100%)`,
              border: `1px solid ${palette.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              position: "relative",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: palette.accent,
                fontWeight: 700,
              }}
            >
              FRAME 01 / {String(effectiveTotalPages).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {palette.chartColors.map((c, idx) => (
                <span
                  key={`${c}-${idx}`}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "999px",
                    background: c,
                    border: "2px solid #FFFFFF",
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: "12px", color: palette.muted }}>
              {englishTitle}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: monoFont,
              fontSize: "11px",
              color: palette.muted,
            }}
          >
            <span>ISO 400 · WARM FILM</span>
            <span style={{ color: palette.accent, fontWeight: 700 }}>2026 LOG</span>
          </div>
        </div>
      </div>
    );
  }

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
