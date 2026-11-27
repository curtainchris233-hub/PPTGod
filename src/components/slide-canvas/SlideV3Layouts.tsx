import React from "react";
import {
  pickDefaultArtworkForArchetype,
  renderArtworkSvgString,
} from "@/lib/slideArtworks";
import type {
  DeckSlideFunnelStage,
  DeckSlideTeamMember,
} from "@/types/prompt";
import { renderFooter, renderTopChrome } from "./SlideChrome";
import type { SlideRenderContext } from "./types";

export function renderImageSplit(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    layout,
    topic,
    subtitle,
    slideData,
    headingFont,
    monoFont,
    radius,
    cardStyle,
  } = ctx;
  const slot = slideData?.imageSlot;
  const isRight = slot?.layout === "right";
  const hasCustomDataUrl =
    slot?.kind === "data-url" &&
    typeof slot.dataUrl === "string" &&
    slot.dataUrl.startsWith("data:image/");
  const isPlaceholder = !hasCustomDataUrl && slot?.kind === "placeholder";
  const presetId =
    slot?.presetId || pickDefaultArtworkForArchetype(layout.archetype);
  const artworkSvgMarkup =
    hasCustomDataUrl || isPlaceholder
      ? ""
      : renderArtworkSvgString(presetId, palette).replace(
          "<svg ",
          '<svg style="width:100%;height:100%;display:block" '
        );
  const placeholderHint =
    slot?.promptHint ||
    `在此粘贴「${(slideData?.title || topic).slice(0, 18)}」相关架构图、实验截图或业务配图`;
  const caption =
    slot?.caption ||
    (isPlaceholder ? "配图留白占位框 · 导出 PPTX 可直接贴图" : `${topic.slice(0, 18)} · 核心视觉构成`);
  const bullets =
    slideData?.bullets && slideData.bullets.length > 0
      ? slideData.bullets
      : [
          "直观展示核心产品界面、架构蓝图或落地实景，大幅降低决策理解门槛",
          "5:5 黄金分栏配合风格自适应色卡，兼顾编辑部审美与商业说服力",
          "支持本地实拍图上传自动压缩、AI 生图与 12 套免 Key 矢量插画切换",
        ];

  const visualCard = (
    <div
      style={{
        ...cardStyle,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: `${Math.max(0, radius - 3)}px`,
          overflow: "hidden",
          background: palette.bg,
          border: isPlaceholder
            ? `1.5px dashed ${palette.accent}`
            : `1px solid ${palette.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isPlaceholder ? "18px" : 0,
        }}
      >
        {hasCustomDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={slot!.dataUrl!}
            alt={caption}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : isPlaceholder ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "10px",
              maxWidth: "88%",
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="6"
                width="28"
                height="24"
                rx="3"
                stroke={palette.accent}
                strokeWidth="1.6"
                strokeDasharray="3 2.5"
              />
              <circle cx="13" cy="14" r="2.5" stroke={palette.muted} strokeWidth="1.4" />
              <path
                d="M8 26L15.5 18.5L21 23.5L25 19.5L29 26"
                stroke={palette.muted}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: palette.accent,
                background: palette.accentSoft,
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              配图占位建议
            </span>
            <p
              style={{
                margin: 0,
                fontSize: "11.5px",
                lineHeight: 1.55,
                color: palette.muted,
              }}
            >
              {placeholderHint.slice(0, 84)}
            </p>
          </div>
        ) : (
          <div
            aria-label={caption}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            dangerouslySetInnerHTML={{ __html: artworkSvgMarkup }}
          />
        )}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: "10.5px",
          color: palette.muted,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {caption}
      </div>
    </div>
  );

  const copyColumn = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        justifyContent: "center",
        minHeight: 0,
      }}
    >
      {(slideData?.subtitle || subtitle) && (
        <p
          style={{
            margin: "0 0 4px 0",
            fontSize: "13px",
            lineHeight: 1.55,
            color: palette.muted,
          }}
        >
          {slideData?.subtitle || subtitle}
        </p>
      )}
      {bullets.slice(0, 4).map((b, idx) => (
        <div
          key={`imsp-${idx}`}
          style={{
            ...cardStyle,
            padding: "12px 14px",
            borderColor: idx === 0 ? palette.accent : palette.border,
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: "12px",
              fontWeight: 700,
              color: palette.accent,
              paddingTop: "1px",
              flexShrink: 0,
            }}
          >
            {String(idx + 1).padStart(2, "0")}
          </span>
          <span
            style={{
              fontSize: "12.5px",
              lineHeight: 1.5,
              color: palette.text,
            }}
          >
            {b}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "图文分栏展示", "04 / VISUAL SPLIT")}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: "24px",
          lineHeight: 1.24,
          color: palette.text,
          margin: "0 0 14px 0",
        }}
      >
        {slideData?.title || `核心视觉展示：以高保真形态呈现「${topic.slice(0, 14)}」`}
      </h3>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: isRight ? "1.05fr 1fr" : "1fr 1.05fr",
          gap: "18px",
        }}
      >
        {isRight ? (
          <>
            {copyColumn}
            {visualCard}
          </>
        ) : (
          <>
            {visualCard}
            {copyColumn}
          </>
        )}
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderSwot(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    topic,
    slideData,
    headingFont,
    monoFont,
    radius,
    cardStyle,
  } = ctx;
  const swot = slideData?.swot || {
    strengths: [
      "核心架构与算法壁垒领先，端到端效率显著超越行业基准",
      "已跑通多家标杆客户私有化验证，形成可复制行业套件",
    ],
    weaknesses: [
      "跨区域渠道伙伴网络仍在爬坡期，需加大赋能投入",
      "部分长尾细分场景的自动化配置向导仍待打磨",
    ],
    opportunities: [
      "企业数字化与 AI 预算向高 ROI 刚需落地场景集中",
      "安全合规与国产算力升级催生存量系统替换窗口期",
    ],
    threats: [
      "通用型大厂产品快速迭代，中低端市场价格竞争加剧",
      "大客户采购决策周期延长，对首期见效速度要求更高",
    ],
  };

  const quads = [
    {
      code: "S",
      title: "STRENGTHS · 核心优势",
      points: swot.strengths,
      badgeColor: palette.chartColors[0] || palette.accent,
    },
    {
      code: "W",
      title: "WEAKNESSES · 短板待补",
      points: swot.weaknesses,
      badgeColor: palette.chartColors[2] || palette.muted,
    },
    {
      code: "O",
      title: "OPPORTUNITIES · 外部机遇",
      points: swot.opportunities,
      badgeColor: palette.chartColors[1] || palette.text,
    },
    {
      code: "T",
      title: "THREATS · 外部挑战",
      points: swot.threats,
      badgeColor: palette.muted,
    },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "SWOT 战略矩阵", "08 / SWOT MATRIX")}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: "24px",
          lineHeight: 1.24,
          color: palette.text,
          margin: "0 0 14px 0",
        }}
      >
        {slideData?.title || `「${topic.slice(0, 14)}」SWOT 四象限战略态势与攻防策略`}
      </h3>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "14px",
        }}
      >
        {quads.map((q, qIdx) => (
          <div
            key={q.code}
            style={{
              ...cardStyle,
              padding: "14px 18px",
              borderColor: qIdx === 0 ? palette.accent : palette.border,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: `${Math.min(6, radius)}px`,
                  background: q.badgeColor,
                  color: "#FFFFFF",
                  fontFamily: monoFont,
                  fontSize: "13px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {q.code}
              </span>
              <span
                style={{
                  fontFamily: headingFont,
                  fontSize: "13.5px",
                  fontWeight: 700,
                  color: qIdx === 0 ? palette.accent : palette.text,
                }}
              >
                {q.title}
              </span>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "12px",
                lineHeight: 1.48,
                color: palette.muted,
              }}
            >
              {(q.points || []).slice(0, 3).map((pt, pIdx) => (
                <li key={`${q.code}-${pIdx}`}>{pt}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderFunnelDonut(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    bodyFont,
    monoFont,
    radius,
    cardStyle,
  } = ctx;
  const chartMode = slideData?.chartMode === "donut" ? "donut" : "funnel";
  const stages: DeckSlideFunnelStage[] =
    slideData?.funnelStages && slideData.funnelStages.length > 0
      ? slideData.funnelStages.slice(0, 6)
      : chartMode === "donut"
      ? [
          { label: "标杆大客户订阅", value: 46, unit: "%", note: "高续约率与年度增购核心盘" },
          { label: "标准化行业套件", value: 28, unit: "%", note: "毛利率 80%+ 增速主力引擎" },
          { label: "渠道伙伴联合交付", value: 16, unit: "%", note: "区域市场规模化放量通道" },
          { label: "增值插件与 API", value: 10, unit: "%", note: "高粘性生态扩展收入来源" },
        ]
      : [
          { label: "线索触达与建联", value: 10000, unit: "人", note: "精准内容矩阵 + 行业峰会获客" },
          { label: "深度体验与 POC", value: 4200, unit: "人", note: "转化率 42.0% · 7 天极速试跑" },
          { label: "商务签约与部署", value: 1680, unit: "人", note: "转化率 40.0% · 标准化交付" },
          { label: "年度续费与增购", value: 1290, unit: "人", note: "净留存 NDR 达 128%" },
        ];

  const colors = [
    palette.chartColors[0] || palette.accent,
    palette.chartColors[1] || palette.text,
    palette.chartColors[2] || palette.muted,
    palette.chartColors[3] || palette.border,
  ];
  const maxVal = Math.max(1, ...stages.map((s) => Math.max(0, s.value)));
  const totalSum = Math.max(
    1,
    stages.reduce((acc, s) => acc + Math.max(0, s.value), 0)
  );

  const renderDonutGraphic = () => {
    const cx = 150;
    const cy = 140;
    const r = 86;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const top = stages[0];
    const topPct = Math.round(((top?.value || 0) / totalSum) * 100);

    return (
      <svg viewBox="0 0 300 280" style={{ width: "100%", height: "100%" }}>
        {stages.map((st, idx) => {
          const frac = Math.max(0.01, Math.max(0, st.value) / totalSum);
          const dash = frac * circ;
          const gap = Math.max(0, circ - dash);
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={`dn-${idx}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="32"
              strokeDasharray={`${dash.toFixed(1)} ${gap.toFixed(1)}`}
              strokeDashoffset={(-currentOffset).toFixed(1)}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill={palette.text}
          fontSize="30"
          fontWeight="800"
          fontFamily={headingFont}
        >
          {topPct}%
        </text>
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          fill={palette.muted}
          fontSize="11.5"
          fontFamily={bodyFont}
        >
          {(top?.label || "核心占比").slice(0, 10)}
        </text>
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, 
        chartMode === "donut" ? "结构占比分析" : "漏斗转化分析",
        chartMode === "donut" ? "06 / DONUT SHARE" : "06 / CONVERSION FUNNEL"
      )}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: "24px",
          lineHeight: 1.24,
          color: palette.text,
          margin: "0 0 14px 0",
        }}
      >
        {slideData?.title ||
          (chartMode === "donut"
            ? "高毛利核心板块贡献结构持续优化，占比突破 74%"
            : "全链路转化漏斗效率跃升，高意向客户留存倍增")}
      </h3>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1.25fr 1fr",
          gap: "18px",
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          {chartMode === "donut"
            ? renderDonutGraphic()
            : stages.map((st, idx) => {
                const pct = Math.max(36, Math.round((st.value / maxVal) * 100));
                const barBg = colors[idx % colors.length];
                return (
                  <div
                    key={`fn-${idx}`}
                    style={{
                      width: `${pct}%`,
                      background: barBg,
                      color: "#FFFFFF",
                      borderRadius: `${Math.min(10, radius)}px`,
                      padding: "11px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={{ fontFamily: monoFont, fontWeight: 700 }}>
                      {st.value.toLocaleString()}
                      {st.unit || ""}
                    </span>
                  </div>
                );
              })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            justifyContent: "center",
          }}
        >
          {stages.slice(0, 4).map((st, idx) => (
            <div
              key={`fn-meta-${idx}`}
              style={{
                ...cardStyle,
                padding: "11px 14px",
                borderLeft: `4px solid ${colors[idx % colors.length]}`,
                borderColor: idx === 0 ? palette.accent : palette.border,
                borderLeftColor: colors[idx % colors.length],
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: headingFont,
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: palette.text,
                  }}
                >
                  {st.label}
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: "14px",
                    fontWeight: 700,
                    color: idx === 0 ? palette.accent : palette.text,
                  }}
                >
                  {st.value.toLocaleString()}
                  {st.unit || ""}
                </span>
              </div>
              {st.note && (
                <div
                  style={{
                    fontSize: "11.5px",
                    color: palette.muted,
                    marginTop: "3px",
                  }}
                >
                  {st.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {renderFooter(ctx)}
    </div>
  );
}



export function renderTeamGrid(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    slideData,
    headingFont,
    monoFont,
    cardStyle,
  } = ctx;
  const members: DeckSlideTeamMember[] =
    slideData?.teamMembers && slideData.teamMembers.length > 0
      ? slideData.teamMembers.slice(0, 4)
      : [
          {
            name: "陈致远",
            role: "首席架构师 · 项目总负责",
            bio: "14 年企业级分布式系统与 AI 工程经验，主导过 3 个亿级核心平台演进。",
            badge: "ARCH",
          },
          {
            name: "林思语",
            role: "产品设计总监",
            bio: "前头部 SaaS 设计系统负责人，深耕高转化可视化工作台与品牌表达。",
            badge: "DESIGN",
          },
          {
            name: "周明轩",
            role: "算法与数据负责人",
            bio: "计算机博士，顶会多篇一作，专注检索增强与低延迟推理加速。",
            badge: "AI LAB",
          },
          {
            name: "沈嘉宁",
            role: "商业化交付总监",
            bio: "深耕金融与先进制造大客户 10 年，标杆客户年度净留存率 132%。",
            badge: "GROWTH",
          },
        ];

  const colors = [
    palette.chartColors[0] || palette.accent,
    palette.chartColors[1] || palette.text,
    palette.chartColors[2] || palette.muted,
    palette.chartColors[3] || palette.border,
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {renderTopChrome(ctx, "核心团队班底", "10 / CORE TEAM")}
      <h3
        style={{
          fontFamily: headingFont,
          fontWeight: typography.titleWeight,
          letterSpacing: typography.titleTracking,
          fontSize: "24px",
          lineHeight: 1.24,
          color: palette.text,
          margin: "0 0 6px 0",
        }}
      >
        {slideData?.title || "核心交付与研发领导团队保障战略落地确定性"}
      </h3>
      {slideData?.subtitle && (
        <p
          style={{
            margin: "0 0 14px 0",
            fontSize: "12.5px",
            color: palette.muted,
          }}
        >
          {slideData.subtitle}
        </p>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${members.length}, 1fr)`,
          gap: "14px",
          marginTop: slideData?.subtitle ? "0" : "10px",
        }}
      >
        {members.map((m, idx) => (
          <div
            key={`tm-${idx}`}
            style={{
              ...cardStyle,
              padding: "18px 16px",
              borderColor: idx === 0 ? palette.accent : palette.border,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "999px",
                background: colors[idx % colors.length],
                color: "#FFFFFF",
                fontFamily: headingFont,
                fontSize: "20px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              {(m.name || "T").slice(0, 1)}
            </div>
            {m.badge && (
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: "9.5px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: palette.accent,
                  background: palette.accentSoft,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  marginBottom: "6px",
                }}
              >
                {m.badge}
              </span>
            )}
            <div
              style={{
                fontFamily: headingFont,
                fontSize: "17px",
                fontWeight: 700,
                color: palette.text,
                marginBottom: "4px",
              }}
            >
              {m.name}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 600,
                color: palette.accent,
                marginBottom: "10px",
              }}
            >
              {m.role}
            </div>
            <div
              style={{
                width: "32px",
                height: "1px",
                background: palette.border,
                marginBottom: "10px",
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: "11.5px",
                lineHeight: 1.55,
                color: palette.muted,
                textAlign: "left",
              }}
            >
              {m.bio}
            </p>
          </div>
        ))}
      </div>
      {renderFooter(ctx)}
    </div>
  );
}
