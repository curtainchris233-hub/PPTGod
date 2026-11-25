import React from "react";
import type {
  DeckSlideBar,
  DeckSlideKpi,
  DeckSlideStep,
} from "@/types/prompt";
import { renderFooter, renderTopChrome } from "./SlideChrome";
import { CN_NUMS, type SlideRenderContext } from "./types";

export function renderAgenda(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    topic,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    isChinese,
    isSwiss,
    isEditorial,
    cardStyle,
    effectiveTotalPages,
    outline,
  } = ctx;
  const agendaSteps: DeckSlideStep[] =
    slideData?.steps && slideData.steps.length > 0
      ? slideData.steps
      : outline.map((item, idx) => ({
          code: item.range,
          title: item.chapter,
          desc: item.focus,
          _idx: idx,
        }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "目录与叙事节奏", "02 / AGENDA")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isSwiss || isEditorial ? "250px 1fr" : "1fr",
          gap: "24px",
          flex: 1,
          alignItems: "center",
        }}
      >
        {(isSwiss || isEditorial) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              borderRight: `1px solid ${palette.border}`,
              paddingRight: "22px",
              height: "100%",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                color: palette.accent,
                letterSpacing: "0.14em",
              }}
            >
              CONTENTS
            </span>
            <h3
              style={{
                fontFamily: headingFont,
                fontWeight: typography.titleWeight,
                fontSize: "32px",
                lineHeight: 1.18,
                margin: 0,
                color: palette.text,
              }}
            >
              {slideData?.title || "四段式演进结构"}
            </h3>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: palette.muted,
                margin: 0,
              }}
            >
              围绕「{topic.slice(0, 22)}」展开，全篇共 {effectiveTotalPages}{" "}
              页，逐层推进决策说服力。
            </p>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isSwiss || isEditorial ? "1fr" : "1fr 1fr",
            gap: "14px",
          }}
        >
          {agendaSteps.slice(0, 4).map((item, idx) => (
            <div
              key={`ag-${idx}`}
              style={{
                ...cardStyle,
                padding: isSwiss || isEditorial ? "14px 18px" : "20px 22px",
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                background:
                  isBrutalist && idx === 0
                    ? palette.accentSoft
                    : palette.surface,
              }}
            >
              <div
                style={{
                  fontFamily: isChinese ? headingFont : monoFont,
                  fontSize: isChinese ? "24px" : "22px",
                  fontWeight: 700,
                  color: idx === 0 ? palette.accent : palette.text,
                  minWidth: "40px",
                  lineHeight: 1.1,
                }}
              >
                {isChinese ? CN_NUMS[idx] || `0${idx + 1}` : `0${idx + 1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: headingFont,
                      fontSize: "17px",
                      fontWeight: 600,
                      color: palette.text,
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontFamily: monoFont,
                      fontSize: "11px",
                      color: palette.muted,
                    }}
                  >
                    {item.code}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                    color: palette.muted,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderProcess(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    radius,
    cardStyle,
  } = ctx;
  const steps: DeckSlideStep[] =
    slideData?.steps && slideData.steps.length > 0
      ? slideData.steps
      : [
          {
            code: "STEP 01",
            title: "全量感知与统一接入",
            desc: "聚合多源文档与业务指标，建立标准化输入清洗与权限隔离规范",
          },
          {
            code: "STEP 02",
            title: "智能编排核心引擎",
            desc: "基于确定性视觉规则与核心算法引擎，输出高信噪比决策模块",
          },
          {
            code: "STEP 03",
            title: "场景闭环与持续度量",
            desc: "直连终端业务工作流，实时追踪转化指标并驱动系统飞轮自迭代",
          },
        ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "核心架构与方法闭环", "03 / ARCHITECTURE")}
      <div style={{ marginBottom: "16px" }}>
        <h3
          style={{
            fontFamily: headingFont,
            fontWeight: typography.titleWeight,
            letterSpacing: typography.titleTracking,
            fontSize: "26px",
            lineHeight: 1.24,
            margin: "0 0 6px 0",
            color: palette.text,
          }}
        >
          {slideData?.title || "三层递进式核心能力架构与业务闭环"}
        </h3>
        {slideData?.subtitle && (
          <p style={{ margin: 0, fontSize: "13px", color: palette.muted }}>
            {slideData.subtitle}
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 22px 1fr 22px 1fr",
          alignItems: "stretch",
          gap: "6px",
          flex: 1,
        }}
      >
        {steps.slice(0, 3).map((st, idx) => (
          <React.Fragment key={`proc-${idx}`}>
            <div
              style={{
                ...cardStyle,
                padding: "22px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background:
                  idx === 1 && isBrutalist
                    ? palette.accentSoft
                    : palette.surface,
                borderColor: idx === 1 ? palette.accent : palette.border,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: monoFont,
                    fontSize: "11px",
                    fontWeight: 700,
                    color: idx === 1 && !isBrutalist ? "#FFFFFF" : palette.accent,
                    background:
                      idx === 1 && !isBrutalist
                        ? palette.accent
                        : palette.accentSoft,
                    padding: "4px 10px",
                    borderRadius: `${Math.min(radius, 99)}px`,
                    marginBottom: "16px",
                  }}
                >
                  {st.code || `STEP 0${idx + 1}`}
                </div>
                <div
                  style={{
                    fontFamily: headingFont,
                    fontSize: "20px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: palette.text,
                    marginBottom: "10px",
                  }}
                >
                  {st.title}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: 1.65,
                    color: palette.muted,
                  }}
                >
                  {st.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "10px",
                  borderTop: `1px solid ${palette.border}`,
                  fontFamily: monoFont,
                  fontSize: "10.5px",
                  color: palette.muted,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>MODULE 0{idx + 1}</span>
                <span style={{ color: palette.accent, fontWeight: 700 }}>
                  {idx === 0 ? "INPUT" : idx === 1 ? "ENGINE" : "OUTCOME"}
                </span>
              </div>
            </div>
            {idx < 2 && (
              <div
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: monoFont,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: palette.accent,
                }}
              >
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Unified Foundation Bar */}
      <div
        style={{
          marginTop: "14px",
          padding: "10px 18px",
          borderRadius: `${radius}px`,
          background: palette.accentSoft,
          border: `1px solid ${palette.accent}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: palette.text,
          fontWeight: 600,
        }}
      >
        <span>底层统一底座 · 细粒度权限安全 · 实时指标观测 · 标准化接口治理</span>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: "11px",
            color: isBrutalist ? palette.text : palette.accent,
          }}
        >
          FOUNDATION LAYER
        </span>
      </div>

      {renderFooter(ctx)}
    </div>
  );
}



export function renderData(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    isConsulting,
    radius,
    cardStyle,
  } = ctx;
  const rawBars: DeckSlideBar[] =
    slideData?.bars && slideData.bars.length > 0
      ? slideData.bars
      : [
          { label: "Q1", v1: 42, v2: 56 },
          { label: "Q2", v1: 54, v2: 71 },
          { label: "Q3", v1: 63, v2: 88 },
          { label: "Q4", v1: 74, v2: 112 },
        ];
  const bars = rawBars.slice(0, 6);
  const peak = Math.max(
    10,
    ...bars.flatMap((b) => [Number(b.v1) || 0, Number(b.v2) || 0])
  );
  const maxV = Math.ceil((peak * 1.15) / 10) * 10;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxV * r));
  const plotW = 372;
  const stepX = plotW / Math.max(1, bars.length);

  const kpis: DeckSlideKpi[] =
    slideData?.kpis && slideData.kpis.length > 0
      ? slideData.kpis
      : [
          {
            label: "核心指标增幅 · YoY",
            value: "+151%",
            note: "较去年同期实现翻倍以上增长",
          },
          {
            label: "关键节点响应耗时",
            value: "14.2ms",
            note: "P99 尾延迟降低 74%，稳定达标",
          },
          {
            label: "客户留存与复购率",
            value: "94.6%",
            note: "净金额留存 NDR 持续领跑行业",
          },
        ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "数据洞察与增长曲线", "04 / DATA INSIGHT")}

      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: isConsulting ? "23px" : "26px",
          lineHeight: 1.25,
          margin: "0 0 18px 0",
          color: palette.text,
        }}
      >
        {slideData?.title ||
          "核心转化效率实现 2.6 倍跃升，单位履约成本同比下降 38%"}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr",
          gap: "20px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Chart Card */}
        <div
          style={{
            ...cardStyle,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: palette.text,
              }}
            >
              季度核心效能指数对比（基准 vs 优化后）
            </span>
            <div
              style={{
                display: "flex",
                gap: "12px",
                fontFamily: monoFont,
                fontSize: "10.5px",
                color: palette.muted,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    background: palette.chartColors[2],
                    display: "inline-block",
                  }}
                />
                基准方案
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    background: palette.chartColors[0],
                    display: "inline-block",
                  }}
                />
                新架构
              </span>
            </div>
          </div>

          <svg
            viewBox="0 0 430 225"
            style={{ width: "100%", flex: 1, overflow: "visible" }}
            role="img"
            aria-label="季度核心效能对比柱状与趋势图"
          >
            {ticks.map((tick, tIdx) => {
              const y = 195 - (tick / maxV) * 168;
              return (
                <g key={`tick-${tIdx}`}>
                  <line
                    x1="38"
                    y1={y}
                    x2="416"
                    y2={y}
                    stroke={palette.border}
                    strokeDasharray={tIdx === 0 ? "none" : "3 3"}
                    strokeWidth="1"
                  />
                  <text
                    x="30"
                    y={y + 4}
                    textAnchor="end"
                    fill={palette.muted}
                    fontSize="10"
                    fontFamily={monoFont}
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {bars.map((b, i) => {
              const cx = 44 + i * stepX + stepX / 2;
              const barW = Math.min(24, Math.max(12, stepX * 0.28));
              const v1 = Math.max(0, Number(b.v1) || 0);
              const v2 = Math.max(0, Number(b.v2) || 0);
              const h1 = (v1 / maxV) * 168;
              const h2 = (v2 / maxV) * 168;
              const r = Math.min(radius, 4);
              return (
                <g key={`bar-${i}`}>
                  <rect
                    x={cx - barW - 3}
                    y={195 - h1}
                    width={barW}
                    height={h1}
                    rx={r}
                    fill={palette.chartColors[2]}
                    opacity="0.72"
                  />
                  <rect
                    x={cx + 3}
                    y={195 - h2}
                    width={barW}
                    height={h2}
                    rx={r}
                    fill={palette.chartColors[0]}
                  />
                  <text
                    x={cx + 3 + barW / 2}
                    y={195 - h2 - 6}
                    textAnchor="middle"
                    fill={palette.text}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily={monoFont}
                  >
                    {v2}
                  </text>
                  <text
                    x={cx}
                    y="214"
                    textAnchor="middle"
                    fill={palette.muted}
                    fontSize="11"
                    fontFamily={monoFont}
                  >
                    {b.label}
                  </text>
                </g>
              );
            })}

            <polyline
              fill="none"
              stroke={palette.chartColors[1]}
              strokeWidth="2.5"
              points={bars
                .map((b, i) => {
                  const cx = 44 + i * stepX + stepX / 2;
                  const barW = Math.min(24, Math.max(12, stepX * 0.28));
                  const v2 = Math.max(0, Number(b.v2) || 0);
                  return `${cx + 3 + barW / 2},${195 - (v2 / maxV) * 168}`;
                })
                .join(" ")}
            />
            {bars.map((b, i) => {
              const cx = 44 + i * stepX + stepX / 2;
              const barW = Math.min(24, Math.max(12, stepX * 0.28));
              const v2 = Math.max(0, Number(b.v2) || 0);
              return (
                <circle
                  key={`dot-${i}`}
                  cx={cx + 3 + barW / 2}
                  cy={195 - (v2 / maxV) * 168}
                  r="4"
                  fill={palette.surface}
                  stroke={palette.chartColors[1]}
                  strokeWidth="2.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Right KPI Stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {kpis.slice(0, 3).map((kpi, idx) => {
            const highlight = idx === 0;
            return (
              <div
                key={`kpi-${idx}`}
                style={{
                  ...cardStyle,
                  padding: "15px 18px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  background: highlight ? palette.accentSoft : palette.surface,
                  borderColor: highlight ? palette.accent : palette.border,
                }}
              >
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: "10.5px",
                    color:
                      highlight && !isBrutalist
                        ? palette.accent
                        : palette.muted,
                    letterSpacing: "0.06em",
                    marginBottom: "4px",
                  }}
                >
                  {kpi.label}
                </div>
                <div
                  style={{
                    fontFamily: headingFont,
                    fontSize: "30px",
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color:
                      highlight && !isBrutalist
                        ? palette.accent
                        : palette.text,
                    marginBottom: "4px",
                  }}
                >
                  {kpi.value}
                </div>
                <div style={{ fontSize: "11.5px", color: palette.muted }}>
                  {kpi.note}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderComparison(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    radius,
    cardStyle,
  } = ctx;
  const leftTitle = slideData?.leftTitle || "传统离散工作流";
  const rightTitle = slideData?.rightTitle || "新一代系统化引擎";
  const leftPoints =
    slideData?.leftPoints && slideData.leftPoints.length > 0
      ? slideData.leftPoints
      : [
          "分散式手动流程，跨角色沟通成本高",
          "视觉标准不统一，交付质量依赖个人经验",
          "迭代周期长达 5–7 天，难以快速响应决策",
        ];
  const rightPoints =
    slideData?.rightPoints && slideData.rightPoints.length > 0
      ? slideData.rightPoints
      : [
          "统一设计系统驱动，结构与视觉一键联动",
          "内置多场景高颜值模板，输出稳定达标",
          "从主题到成品交付缩短至 15 分钟内",
        ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "方案双栏对比矩阵", "05 / COMPARISON")}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          fontSize: "26px",
          margin: "0 0 18px 0",
          color: palette.text,
        }}
      >
        {slideData?.title || "传统模式与新一代方案的核心能力边界对比"}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          flex: 1,
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${palette.border}`,
              paddingBottom: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: "10.5px",
                  color: palette.muted,
                }}
              >
                OPTION A · BASELINE
              </div>
              <div
                style={{
                  fontFamily: headingFont,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: palette.text,
                  marginTop: "2px",
                }}
              >
                {leftTitle}
              </div>
            </div>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                padding: "3px 9px",
                border: `1px solid ${palette.border}`,
                borderRadius: `${Math.min(radius, 99)}px`,
                color: palette.muted,
              }}
            >
              现状痛点
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {leftPoints.slice(0, 4).map((pt, i) => (
              <div
                key={`lp-${i}`}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  fontSize: "13.5px",
                  lineHeight: 1.55,
                  color: palette.muted,
                }}
              >
                <span style={{ fontFamily: monoFont, fontSize: "12px", marginTop: "2px" }}>
                  0{i + 1}
                </span>
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              paddingTop: "12px",
              borderTop: `1px dashed ${palette.border}`,
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: palette.muted,
            }}
          >
            <span>综合人效评分</span>
            <strong style={{ fontFamily: monoFont, color: palette.text }}>
              54 / 100
            </strong>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            background: isBrutalist ? palette.accentSoft : palette.surface,
            borderColor: palette.accent,
            borderWidth: isBrutalist ? "2.5px" : "1.5px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${palette.accent}44`,
              paddingBottom: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: "10.5px",
                  color: isBrutalist ? palette.text : palette.accent,
                  fontWeight: 700,
                }}
              >
                OPTION B · RECOMMENDED
              </div>
              <div
                style={{
                  fontFamily: headingFont,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: palette.text,
                  marginTop: "2px",
                }}
              >
                {rightTitle}
              </div>
            </div>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "11px",
                padding: "3px 10px",
                background: palette.accent,
                color: "#FFFFFF",
                borderRadius: `${Math.min(radius, 99)}px`,
                fontWeight: 700,
              }}
            >
              推荐路径
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {rightPoints.slice(0, 4).map((pt, i) => (
              <div
                key={`rp-${i}`}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  fontSize: "13.5px",
                  lineHeight: 1.55,
                  color: palette.text,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: "12px",
                    color: isBrutalist ? palette.text : palette.accent,
                    fontWeight: 700,
                    marginTop: "2px",
                  }}
                >
                  ✓0{i + 1}
                </span>
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              paddingTop: "12px",
              borderTop: `1px solid ${palette.accent}44`,
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: palette.text,
            }}
          >
            <span>综合人效评分</span>
            <strong
              style={{
                fontFamily: monoFont,
                color: isBrutalist ? palette.text : palette.accent,
              }}
            >
              96 / 100 (+78%)
            </strong>
          </div>
        </div>
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderTimeline(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    cardStyle,
  } = ctx;
  const phases: DeckSlideStep[] =
    slideData?.steps && slideData.steps.length > 0
      ? slideData.steps
      : [
          {
            code: "Q1 · PHASE 1",
            title: "标杆试点验证",
            desc: "聚焦核心高频业务场景，完成首批种子客户交付与指标校准",
          },
          {
            code: "Q2 · PHASE 2",
            title: "标准套件沉淀",
            desc: "抽象行业通用模板与自动化流水线，覆盖 60% 主力流程",
          },
          {
            code: "Q3 · PHASE 3",
            title: "渠道规模扩张",
            desc: "开放生态伙伴协同接口，推动跨区域复制与边际降本",
          },
          {
            code: "Q4 · PHASE 4",
            title: "复利飞轮成型",
            desc: "建立全自动数据预警与季度迭代体系，巩固长期护城河",
          },
        ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "推进路线图与里程碑", "06 / ROADMAP")}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: "26px",
          margin: "0 0 22px 0",
          color: palette.text,
        }}
      >
        {slideData?.title || "2026 分阶段实施路线图与关键交付节点"}
      </h3>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Horizontal Axis */}
        <div
          aria-hidden="true"
          style={{
            height: "3px",
            background: `linear-gradient(90deg, ${palette.accent} 0%, ${palette.chartColors[1]} 65%, ${palette.border} 100%)`,
            marginBottom: "20px",
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {phases.slice(0, 4).map((_, idx) => (
            <div
              key={`axis-dot-${idx}`}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "999px",
                  background: idx === 0 ? palette.accent : palette.surface,
                  border: `3px solid ${
                    idx <= 1 ? palette.accent : palette.chartColors[1]
                  }`,
                  marginTop: "-7px",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "14px",
          }}
        >
          {phases.slice(0, 4).map((p, idx) => (
            <div
              key={`phase-${idx}`}
              style={{
                ...cardStyle,
                padding: "18px 16px",
                minHeight: "205px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background:
                  idx === 0 && isBrutalist
                    ? palette.accentSoft
                    : palette.surface,
                borderColor: idx === 0 ? palette.accent : palette.border,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: "10.5px",
                    fontWeight: 700,
                    color: idx === 0 && !isBrutalist ? palette.accent : palette.muted,
                    letterSpacing: "0.06em",
                    marginBottom: "10px",
                  }}
                >
                  {p.code || `PHASE 0${idx + 1}`}
                </div>
                <div
                  style={{
                    fontFamily: headingFont,
                    fontSize: "17px",
                    fontWeight: 700,
                    color: palette.text,
                    marginBottom: "8px",
                  }}
                >
                  {p.title}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12.5px",
                    lineHeight: 1.55,
                    color: palette.muted,
                  }}
                >
                  {p.desc}
                </p>
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: "10px",
                  color: palette.accent,
                  fontWeight: 700,
                  paddingTop: "10px",
                  borderTop: `1px solid ${palette.border}`,
                }}
              >
                MILESTONE 0{idx + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {renderFooter(ctx)}
    </div>
  );
}



export function renderQuote(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    topic,
    audience,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    cardStyle,
  } = ctx;
  const quoteText =
    slideData?.quoteText ||
    `围绕「${topic.slice(0, 22)}」，真正决定长期胜负的不是短期堆料，而是高确定性的设计系统与执行闭环。`;
  const quoteAuthor =
    slideData?.quoteAuthor || `${audience} · 2026 核心战略共识`;
  const kpis: DeckSlideKpi[] =
    slideData?.kpis && slideData.kpis.length > 0
      ? slideData.kpis
      : [
          { label: "决策对齐效率", value: "3.4×", note: "评审沟通成本锐减" },
          { label: "视觉一致率", value: "99.2%", note: "跨团队母版统一" },
          { label: "交付周期", value: "< 15m", note: "从大纲直出成品" },
        ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {renderTopChrome(ctx, "核心洞察与焦点金句", "07 / SPOTLIGHT")}

      <div
        style={{
          ...cardStyle,
          padding: "28px 36px",
          position: "relative",
          borderColor: palette.accent,
          background: isBrutalist ? palette.accentSoft : palette.surface,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "74px",
            lineHeight: 0.65,
            color: isBrutalist ? palette.text : palette.accent,
            opacity: 0.9,
            marginBottom: "8px",
          }}
        >
          “
        </div>
        <blockquote
          style={{
            margin: "0 0 18px 0",
            fontFamily: headingFont,
            fontWeight: typography.titleWeight,
            letterSpacing: typography.titleTracking,
            fontSize: "29px",
            lineHeight: 1.36,
            color: palette.text,
          }}
        >
          {quoteText}
        </blockquote>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "13px",
            color: palette.muted,
            fontFamily: monoFont,
          }}
        >
          <span
            style={{
              width: "28px",
              height: "2px",
              background: palette.accent,
              display: "inline-block",
            }}
          />
          <span>{quoteAuthor}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "14px",
          marginTop: "14px",
        }}
      >
        {kpis.slice(0, 3).map((k, idx) => (
          <div
            key={`qkpi-${idx}`}
            style={{
              ...cardStyle,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: "10.5px",
                  color: palette.muted,
                }}
              >
                {k.label}
              </div>
              <div style={{ fontSize: "11.5px", color: palette.muted, marginTop: "2px" }}>
                {k.note}
              </div>
            </div>
            <div
              style={{
                fontFamily: headingFont,
                fontSize: "24px",
                fontWeight: 700,
                color: palette.accent,
              }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {renderFooter(ctx)}
    </div>
  );
}



export function renderClosing(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    topic,
    audience,
    englishTitle,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    isKeynote,
    cardStyle,
  } = ctx;
  const pillars: DeckSlideStep[] =
    slideData?.steps && slideData.steps.length > 0
      ? slideData.steps
      : [
          {
            code: "01",
            title: "立即启动试点",
            desc: "聚焦高价值核心场景，两周完成验证闭环",
          },
          {
            code: "02",
            title: "建立统一规范",
            desc: "沉淀可复用的数据口径与视觉表达标准",
          },
          {
            code: "03",
            title: "规模化扩张",
            desc: "围绕关键里程碑滚动复盘，放大复利收益",
          },
        ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {renderTopChrome(ctx, "核心总结与行动建议", "08 / KEY TAKEAWAYS")}

      <div style={{ textAlign: isKeynote ? "center" : "left", margin: "4px 0 18px" }}>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: palette.accent,
            marginBottom: "8px",
          }}
        >
          THANK YOU & NEXT STEPS
        </div>
        <h3
          style={{
            fontFamily: headingFont,
            fontWeight: typography.titleWeight,
            letterSpacing: typography.titleTracking,
            fontSize: "38px",
            lineHeight: 1.18,
            color: palette.text,
            margin: 0,
          }}
        >
          {slideData?.title || `让「${topic.slice(0, 20)}」从共识走向落地`}
        </h3>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
        }}
      >
        {pillars.slice(0, 3).map((p, idx) => (
          <div
            key={`cls-${idx}`}
            style={{
              ...cardStyle,
              padding: "18px 20px",
              background:
                idx === 0 && isBrutalist ? palette.accentSoft : palette.surface,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: "12px",
                fontWeight: 700,
                color: palette.accent,
                marginBottom: "8px",
              }}
            >
              STEP {p.code || `0${idx + 1}`}
            </div>
            <div
              style={{
                fontFamily: headingFont,
                fontSize: "18px",
                fontWeight: 700,
                color: palette.text,
                marginBottom: "6px",
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontSize: "12.5px",
                lineHeight: 1.55,
                color: palette.muted,
              }}
            >
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "20px",
          paddingTop: "14px",
          borderTop: `1px solid ${palette.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: monoFont,
          fontSize: "11.5px",
          color: palette.muted,
        }}
      >
        <span>Q&A SESSION · {audience}</span>
        <span style={{ color: palette.text, fontWeight: 600 }}>
          PPTGOD SPEC · {englishTitle.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
