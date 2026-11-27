import React from "react";
import type {
  DataDisplayMode,
  DeckSlideBar,
  DeckSlideKpi,
  DeckSlideStep,
  SlideChartSeries,
  SlideTableData,
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
    layout,
    slideData,
    headingFont,
    monoFont,
    isBrutalist,
    isConsulting,
    radius,
    cardStyle,
  } = ctx;

  const displayMode: DataDisplayMode = slideData?.dataDisplay || "col";
  const isAcademicStyle =
    layout.archetype === "academic-paper" ||
    layout.archetype === "scientific-figure" ||
    layout.archetype === "clinical-clean";

  const rawBars: DeckSlideBar[] =
    slideData?.bars && slideData.bars.length > 0
      ? slideData.bars
      : [
          { label: "Q1", v1: 42, v2: 56 },
          { label: "Q2", v1: 54, v2: 71 },
          { label: "Q3", v1: 63, v2: 88 },
          { label: "Q4", v1: 74, v2: 112 },
        ];
  const bars = rawBars.slice(0, 8);
  const isSingle = Boolean(slideData?.singleSeries);

  const hasMultiSeries =
    Boolean(slideData?.chartCategories?.length) &&
    Boolean(slideData?.chartSeries?.length);

  const categories: string[] = hasMultiSeries
    ? slideData!.chartCategories!.slice(0, 8)
    : bars.map((b) => b.label);

  const seriesList: SlideChartSeries[] = hasMultiSeries
    ? slideData!.chartSeries!.slice(0, 4)
    : isSingle
      ? [{ name: "核心实证值", values: bars.map((b) => Math.max(0, Number(b.v2) || 0)) }]
      : [
          { name: "基准方案", values: bars.map((b) => Math.max(0, Number(b.v1) || 0)) },
          { name: "新架构", values: bars.map((b) => Math.max(0, Number(b.v2) || 0)) },
        ];

  const allSeriesVals = seriesList.flatMap((s) =>
    categories.map((_, idx) => Math.max(0, Number(s.values[idx]) || 0))
  );
  const peak = Math.max(0.5, ...allSeriesVals);
  const maxV =
    peak < 10
      ? Math.max(0.5, Number((peak * 1.2).toPrecision(2)) || 1)
      : Math.max(10, Math.ceil((peak * 1.15) / 10) * 10);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) =>
    maxV < 5 ? Number((maxV * r).toFixed(1)) : Math.round(maxV * r)
  );

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

  const topTagRight =
    displayMode === "kpi-only"
      ? "04 / KEY METRICS"
      : displayMode === "data-matrix"
        ? "04 / DATA TABLE"
        : "04 / DATA INSIGHT";
  const topTagLeft =
    displayMode === "kpi-only"
      ? "核心量化指标焦点"
      : displayMode === "data-matrix"
        ? isAcademicStyle
          ? "学术三线表与实证对照"
          : "多维指标评分矩阵"
        : "数据洞察与增长曲线";

  const headlineNode = (
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
  );

  /* ---- 1. Pure Hero KPI Showcase (`big-number` / `kpi-only`) ---- */
  if (displayMode === "kpi-only") {
    const heroKpis = kpis.slice(0, 3);
    const colCnt = Math.max(1, heroKpis.length);
    const extraBullets = (slideData?.bullets || []).slice(0, 3);
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {renderTopChrome(ctx, topTagLeft, topTagRight)}
        {headlineNode}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${colCnt}, minmax(0, 1fr))`,
              gap: "18px",
              flex: extraBullets.length > 0 ? "1.35" : "1",
              minHeight: 0,
            }}
          >
            {heroKpis.map((kpi, idx) => {
              const highlight = idx === 0;
              return (
                <div
                  key={`hero-kpi-${idx}`}
                  style={{
                    ...cardStyle,
                    padding: colCnt === 1 ? "26px 32px" : "22px 22px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: highlight ? palette.accentSoft : palette.surface,
                    borderColor: highlight ? palette.accent : palette.border,
                  }}
                >
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: highlight && !isBrutalist ? palette.accent : palette.muted,
                    }}
                  >
                    {kpi.label}
                  </div>
                  <div
                    style={{
                      fontFamily: headingFont,
                      fontSize: colCnt === 1 ? "58px" : colCnt === 2 ? "46px" : "38px",
                      fontWeight: 800,
                      lineHeight: 1.05,
                      color: highlight && !isBrutalist ? palette.accent : palette.text,
                      margin: "8px 0",
                    }}
                  >
                    {kpi.value}
                  </div>
                  <div
                    style={{
                      borderTop: `1px solid ${palette.border}`,
                      paddingTop: "8px",
                      fontSize: "12px",
                      lineHeight: 1.45,
                      color: palette.muted,
                    }}
                  >
                    {kpi.note || "源资料实证核心指标"}
                  </div>
                </div>
              );
            })}
          </div>
          {extraBullets.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${extraBullets.length}, minmax(0, 1fr))`,
                gap: "14px",
              }}
            >
              {extraBullets.map((b, bIdx) => (
                <div
                  key={`hero-pt-${bIdx}`}
                  style={{
                    ...cardStyle,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: palette.accent,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "12px", color: palette.text, lineHeight: 1.4 }}>
                    {b}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {renderFooter(ctx)}
      </div>
    );
  }

  /* ---- 2. Native Academic 3-Line / Executive Data Table (`data-matrix`) ---- */
  if (displayMode === "data-matrix") {
    const resolvedTable: SlideTableData =
      slideData?.tableData &&
      slideData.tableData.headers.length > 0 &&
      slideData.tableData.rows.length > 0
        ? slideData.tableData
        : {
            headers: ["指标维度", ...seriesList.map((s) => s.name)],
            rows: categories.map((cat, rIdx) => [
              cat,
              ...seriesList.map((s) => {
                const v = s.values[rIdx] ?? 0;
                return s.unit ? `${v}${s.unit}` : String(v);
              }),
            ]),
          };

    const visibleHeaders = resolvedTable.headers.slice(0, 8);
    const visibleRows = resolvedTable.rows.slice(0, 8);
    const hlSet = new Set(
      (resolvedTable.highlightCoords || []).map(([r, c]) => `${r}:${c}`)
    );
    const denseRows = visibleRows.length >= 6;

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {renderTopChrome(ctx, topTagLeft, topTagRight)}
        {headlineNode}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <div
            style={
              isAcademicStyle
                ? {
                    background: "transparent",
                    padding: "4px 2px",
                    overflow: "hidden",
                  }
                : {
                    ...cardStyle,
                    padding: "14px 18px",
                    overflow: "hidden",
                  }
            }
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: denseRows ? "11.5px" : "12.5px",
                borderTop: isAcademicStyle ? `2px solid ${palette.text}` : "none",
                borderBottom: isAcademicStyle ? `2px solid ${palette.text}` : "none",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: isAcademicStyle ? "transparent" : palette.accentSoft,
                    borderBottom: isAcademicStyle
                      ? `1.25px solid ${palette.text}`
                      : `1.5px solid ${palette.border}`,
                  }}
                >
                  {visibleHeaders.map((h, cIdx) => (
                    <th
                      key={`th-${cIdx}`}
                      style={{
                        padding: denseRows ? "7px 10px" : "9px 12px",
                        textAlign: cIdx === 0 ? "left" : "right",
                        fontWeight: 700,
                        color: palette.text,
                        fontFamily: cIdx === 0 ? headingFont : monoFont,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rIdx) => (
                  <tr
                    key={`tr-${rIdx}`}
                    style={{
                      borderBottom:
                        isAcademicStyle || rIdx === visibleRows.length - 1
                          ? "none"
                          : `1px solid ${palette.border}`,
                    }}
                  >
                    {visibleHeaders.map((_, cIdx) => {
                      const isOptimal = hlSet.has(`${rIdx}:${cIdx}`);
                      return (
                        <td
                          key={`td-${rIdx}-${cIdx}`}
                          style={{
                            padding: denseRows ? "6px 10px" : "8px 12px",
                            textAlign: cIdx === 0 ? "left" : "right",
                            fontFamily: cIdx === 0 ? undefined : monoFont,
                            fontWeight: isOptimal || cIdx === 0 ? 700 : 500,
                            color: isOptimal ? palette.accent : palette.text,
                            background:
                              isOptimal && !isAcademicStyle
                                ? palette.accentSoft
                                : "transparent",
                          }}
                        >
                          {row[cIdx] ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {slideData?.bullets?.[0] && (
            <div
              style={{
                fontSize: "12px",
                color: palette.muted,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: palette.accent,
                }}
              >
                TAKEAWAY
              </span>
              <span>{slideData.bullets[0]}</span>
            </div>
          )}
        </div>
        {renderFooter(ctx)}
      </div>
    );
  }

  /* ---- 3..6. Synchronized 4 Chart Variants (`col` | `bar` | `line` | `doughnut`) ---- */
  const chartHeaderTitle =
    displayMode === "bar"
      ? "关键基准横向对比条形图"
      : displayMode === "line"
        ? "核心指标演进趋势折线图"
        : displayMode === "doughnut"
          ? "结构占比环形分布图"
          : seriesList.length <= 1
            ? "关键量化指标实证分布"
            : "多维序列核心指标对比";

  const seriesPalette = [
    palette.chartColors[0],
    palette.chartColors[1],
    palette.chartColors[2],
    palette.chartColors[3] || palette.accent,
  ];

  const renderChartSvg = () => {
    const catCount = Math.max(1, categories.length);

    if (displayMode === "doughnut") {
      const vals = categories.map((_, idx) => Math.max(0, Number(seriesList[0]?.values[idx]) || 0));
      const total = Math.max(1, vals.reduce((acc, v) => acc + v, 0));
      const cx = 128;
      const cy = 112;
      const r = 74;
      const circ = 2 * Math.PI * r;
      let offset = 0;
      const topIdx = vals.reduce((best, v, idx) => (v > (vals[best] ?? 0) ? idx : best), 0);
      const topPct = Math.round(((vals[topIdx] ?? 0) / total) * 100);

      return (
        <svg
          viewBox="0 0 430 225"
          style={{ width: "100%", flex: 1, overflow: "visible" }}
          role="img"
          aria-label="结构占比环形分布图"
        >
          {categories.map((cat, idx) => {
            const frac = Math.max(0.01, vals[idx] / total);
            const dash = Number((frac * circ).toFixed(2));
            const gap = Number(Math.max(0, circ - dash).toFixed(2));
            const curOffset = Number((-offset).toFixed(2));
            offset += dash;
            return (
              <circle
                key={`dn-${idx}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seriesPalette[idx % seriesPalette.length]}
                strokeWidth="26"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={curOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fill={palette.text}
            fontSize="24"
            fontWeight="800"
            fontFamily={headingFont}
          >
            {`${topPct}%`}
          </text>
          <text
            x={cx}
            y={cy + 17}
            textAnchor="middle"
            fill={palette.muted}
            fontSize="10.5"
            fontFamily={monoFont}
          >
            {(categories[topIdx] || "核心项").slice(0, 9)}
          </text>
          {categories.slice(0, 6).map((cat, idx) => {
            const ly = 36 + idx * 28;
            const pct = Math.round((vals[idx] / total) * 100);
            return (
              <g key={`dn-leg-${idx}`}>
                <rect
                  x="242"
                  y={ly - 8}
                  width="10"
                  height="10"
                  rx="2"
                  fill={seriesPalette[idx % seriesPalette.length]}
                />
                <text x="258" y={ly} fill={palette.text} fontSize="11">
                  {cat.slice(0, 10)}
                </text>
                <text
                  x="414"
                  y={ly}
                  textAnchor="end"
                  fill={palette.muted}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily={monoFont}
                >
                  {`${pct}%`}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }

    if (displayMode === "bar") {
      const rowCats = categories.slice(0, 6);
      const rowStep = 190 / Math.max(1, rowCats.length);
      const barLeft = 112;
      const barMaxW = 266;
      const activeSeries = seriesList.slice(0, 2);
      return (
        <svg
          viewBox="0 0 430 225"
          style={{ width: "100%", flex: 1, overflow: "visible" }}
          role="img"
          aria-label="关键基准横向对比条形图"
        >
          <line x1={barLeft} y1="14" x2={barLeft} y2="206" stroke={palette.border} strokeWidth="1" />
          {rowCats.map((cat, idx) => {
            const cy = 20 + idx * rowStep + rowStep / 2;
            if (activeSeries.length === 1) {
              const val = Math.max(0, Number(activeSeries[0].values[idx]) || 0);
              const w = Math.max(4, Number(((val / maxV) * barMaxW).toFixed(1)));
              const bh = Math.min(20, Math.max(11, rowStep * 0.54));
              return (
                <g key={`hbar-${idx}`}>
                  <text
                    x={barLeft - 8}
                    y={cy + 4}
                    textAnchor="end"
                    fill={palette.text}
                    fontSize="10.5"
                    fontFamily={monoFont}
                  >
                    {cat.slice(0, 12)}
                  </text>
                  <rect
                    x={barLeft}
                    y={cy - bh / 2}
                    width={w}
                    height={bh}
                    rx={Math.min(radius, 4)}
                    fill={seriesPalette[idx === 0 ? 0 : idx % 2 === 0 ? 0 : 1]}
                  />
                  <text
                    x={barLeft + w + 6}
                    y={cy + 4}
                    fill={palette.text}
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily={monoFont}
                  >
                    {`${val}${activeSeries[0].unit || ""}`}
                  </text>
                </g>
              );
            }
            const v0 = Math.max(0, Number(activeSeries[0].values[idx]) || 0);
            const v1 = Math.max(0, Number(activeSeries[1].values[idx]) || 0);
            const w0 = Math.max(3, Number(((v0 / maxV) * barMaxW).toFixed(1)));
            const w1 = Math.max(3, Number(((v1 / maxV) * barMaxW).toFixed(1)));
            const bh = Math.min(10, Math.max(6, rowStep * 0.3));
            return (
              <g key={`hbar-${idx}`}>
                <text
                  x={barLeft - 8}
                  y={cy + 4}
                  textAnchor="end"
                  fill={palette.text}
                  fontSize="10.5"
                  fontFamily={monoFont}
                >
                  {cat.slice(0, 12)}
                </text>
                <rect
                  x={barLeft}
                  y={cy - bh - 1}
                  width={w0}
                  height={bh}
                  rx="2"
                  fill={seriesPalette[0]}
                />
                <rect
                  x={barLeft}
                  y={cy + 1}
                  width={w1}
                  height={bh}
                  rx="2"
                  fill={seriesPalette[1]}
                  opacity="0.82"
                />
                <text
                  x={barLeft + Math.max(w0, w1) + 6}
                  y={cy + 4}
                  fill={palette.text}
                  fontSize="10"
                  fontWeight="700"
                  fontFamily={monoFont}
                >
                  {`${v0}${activeSeries[0].unit || ""}`}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }

    const plotW = 372;
    const stepX = plotW / catCount;

    if (displayMode === "line") {
      return (
        <svg
          viewBox="0 0 430 225"
          style={{ width: "100%", flex: 1, overflow: "visible" }}
          role="img"
          aria-label="核心指标趋势折线图"
        >
          {ticks.map((tick, tIdx) => {
            const y = Number((195 - (tick / maxV) * 164).toFixed(1));
            return (
              <g key={`ltick-${tIdx}`}>
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
          {categories.map((cat, idx) => {
            const cx = Number((44 + idx * stepX + stepX / 2).toFixed(1));
            return (
              <text
                key={`lcat-${idx}`}
                x={cx}
                y="214"
                textAnchor="middle"
                fill={palette.muted}
                fontSize="10.5"
                fontFamily={monoFont}
              >
                {cat.slice(0, 10)}
              </text>
            );
          })}
          {seriesList.map((ser, sIdx) => {
            const color = seriesPalette[sIdx % seriesPalette.length];
            const pts = categories
              .map((_, idx) => {
                const cx = Number((44 + idx * stepX + stepX / 2).toFixed(1));
                const v = Math.max(0, Number(ser.values[idx]) || 0);
                const cy = Number((195 - (v / maxV) * 164).toFixed(1));
                return `${cx},${cy}`;
              })
              .join(" ");
            return (
              <g key={`lser-${sIdx}`}>
                <polyline fill="none" stroke={color} strokeWidth="2.8" points={pts} />
                {categories.map((_, idx) => {
                  const cx = Number((44 + idx * stepX + stepX / 2).toFixed(1));
                  const v = Math.max(0, Number(ser.values[idx]) || 0);
                  const cy = Number((195 - (v / maxV) * 164).toFixed(1));
                  return (
                    <g key={`ldot-${sIdx}-${idx}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="4.2"
                        fill={palette.surface}
                        stroke={color}
                        strokeWidth="2.4"
                      />
                      {sIdx === 0 && (
                        <text
                          x={cx}
                          y={cy - 8}
                          textAnchor="middle"
                          fill={palette.text}
                          fontSize="10.5"
                          fontWeight="700"
                          fontFamily={monoFont}
                        >
                          {v}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      );
    }

    /* Default: Vertical Column Chart (`col`), supporting 1..4 real series */
    const sCount = Math.max(1, seriesList.length);
    return (
      <svg
        viewBox="0 0 430 225"
        style={{ width: "100%", flex: 1, overflow: "visible" }}
        role="img"
        aria-label="关键量化指标柱状图"
      >
        {ticks.map((tick, tIdx) => {
          const y = Number((195 - (tick / maxV) * 168).toFixed(1));
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

        {categories.map((cat, i) => {
          const cx = Number((44 + i * stepX + stepX / 2).toFixed(1));
          const r = Math.min(radius, 4);
          if (sCount === 1) {
            const v0 = Math.max(0, Number(seriesList[0].values[i]) || 0);
            const h0 = Number(((v0 / maxV) * 168).toFixed(1));
            const singleW = Math.min(36, Math.max(14, stepX * 0.44));
            return (
              <g key={`bar-${i}`}>
                <rect
                  x={cx - singleW / 2}
                  y={195 - h0}
                  width={singleW}
                  height={h0}
                  rx={r}
                  fill={seriesPalette[i % 2 === 0 ? 0 : 1]}
                />
                <text
                  x={cx}
                  y={195 - h0 - 6}
                  textAnchor="middle"
                  fill={palette.text}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily={monoFont}
                >
                  {v0}
                </text>
                <text
                  x={cx}
                  y="214"
                  textAnchor="middle"
                  fill={palette.muted}
                  fontSize="10.5"
                  fontFamily={monoFont}
                >
                  {cat.slice(0, 10)}
                </text>
              </g>
            );
          }

          const groupW = Math.min(54, stepX * 0.72);
          const gap = 3;
          const barW = Math.max(6, (groupW - gap * (sCount - 1)) / sCount);
          const startX = cx - groupW / 2;

          return (
            <g key={`bar-grp-${i}`}>
              {seriesList.map((ser, sIdx) => {
                const v = Math.max(0, Number(ser.values[i]) || 0);
                const h = Number(((v / maxV) * 168).toFixed(1));
                const bx = startX + sIdx * (barW + gap);
                const isLead = hasMultiSeries ? sIdx === 0 : sIdx === sCount - 1;
                const fill = !hasMultiSeries && sCount === 2 && sIdx === 0
                  ? palette.chartColors[2]
                  : seriesPalette[sIdx % seriesPalette.length];
                return (
                  <g key={`bar-${i}-${sIdx}`}>
                    <rect
                      x={bx}
                      y={195 - h}
                      width={barW}
                      height={h}
                      rx={Math.min(r, 3)}
                      fill={fill}
                      opacity={!hasMultiSeries && sCount === 2 && sIdx === 0 ? 0.75 : 1}
                    />
                    {isLead && (
                      <text
                        x={bx + barW / 2}
                        y={195 - h - 5}
                        textAnchor="middle"
                        fill={palette.text}
                        fontSize="10"
                        fontWeight="700"
                        fontFamily={monoFont}
                      >
                        {v}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={cx}
                y="214"
                textAnchor="middle"
                fill={palette.muted}
                fontSize="10.5"
                fontFamily={monoFont}
              >
                {cat.slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, topTagLeft, topTagRight)}
      {headlineNode}

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
              gap: "8px",
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
              {chartHeaderTitle}
            </span>
            {seriesList.length > 1 && displayMode !== "doughnut" ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  fontFamily: monoFont,
                  fontSize: "10px",
                  color: palette.muted,
                }}
              >
                {seriesList.map((ser, sIdx) => {
                  const swatch =
                    !hasMultiSeries && seriesList.length === 2 && sIdx === 0
                      ? palette.chartColors[2]
                      : seriesPalette[sIdx % seriesPalette.length];
                  return (
                    <span
                      key={`leg-${sIdx}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          background: swatch,
                          display: "inline-block",
                        }}
                      />
                      {ser.name.slice(0, 10)}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          {renderChartSvg()}
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
