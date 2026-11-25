import {
  pickDefaultArtworkForArchetype,
  renderArtworkSvgString,
} from "@/lib/slideArtworks";
import type {
  DeckSlideItem,
  DecorativeMotif,
  LayoutArchetype,
  VisualPalette,
  VisualSpec,
} from "@/types/prompt";

const DEFAULT_BARS = [
  { label: "Q1", v1: 42, v2: 58 },
  { label: "Q2", v1: 52, v2: 76 },
  { label: "Q3", v1: 61, v2: 94 },
  { label: "Q4", v1: 72, v2: 116 },
];

const DEFAULT_FUNNEL = [
  { label: "潜客触达建联", value: 10000, unit: "人", note: "精准内容矩阵获客" },
  { label: "深度体验 POC", value: 4200, unit: "人", note: "转化率 42.0%" },
  { label: "商务签约部署", value: 1680, unit: "人", note: "转化率 40.0%" },
  { label: "年度续费增购", value: 1290, unit: "人", note: "NDR 达 128%" },
];

const SAFE_CSS_VAL_RE = /^[#a-zA-Z0-9(),.%\/+\-\s]+$/;
const UNSAFE_CSS_FN_RE = /\b(?:url|expression)\s*\(/i;
const SAFE_DATA_IMG_RE =
  /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i;

function safeTextVal(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function safeNumVal(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim() !== "") return Number(val);
  return Number.NaN;
}

function esc(val: unknown): string {
  return safeTextVal(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escCssVal(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.length > 64 ||
    !SAFE_CSS_VAL_RE.test(trimmed) ||
    UNSAFE_CSS_FN_RE.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}

function sanitizeBarNum(val: unknown): number {
  const n = safeNumVal(val);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function buildDonutSvg(
  stages: { label: string; value: number; unit: string }[],
  colors: string[],
  textColor: string,
  mutedColor: string
): string {
  const total = Math.max(
    1,
    stages.reduce((acc, st) => acc + Math.max(0, st.value), 0)
  );
  const cx = 130;
  const cy = 130;
  const r = 82;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const rings = stages
    .map((st, idx) => {
      const frac = Math.max(0.01, st.value / total);
      const dash = frac * circumference;
      const gap = Math.max(0, circumference - dash);
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${esc(
        colors[idx % colors.length]
      )}" stroke-width="30" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(
        1
      )}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
      return seg;
    })
    .join("");

  const topStage = stages[0];
  const topPct = Math.round(((topStage?.value || 0) / total) * 100);

  return `<svg viewBox="0 0 260 260" style="width:100%;height:100%;max-height:240px;">
    ${rings}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="${esc(
    textColor
  )}" font-size="26" font-weight="800">${topPct}%</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="${esc(
    mutedColor
  )}" font-size="11">${esc((topStage?.label || "核心占比").slice(0, 8))}</text>
  </svg>`;
}

/**
 * Renders all 11 DecorativeMotifs into offline standalone HTML slides so exported
 * decks and print-to-PDF pages match the live SlideCanvas aesthetic 1:1.
 */
function buildMotifOverlayHtml(
  motif: DecorativeMotif,
  palette: VisualPalette,
  isCover: boolean
): string {
  if (motif === "none") return "";

  if (motif === "hairline-rule") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:${esc(palette.accent)};opacity:0.85;"></div></div>`;
  }

  if (motif === "ribbon-accent") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${esc(palette.accent)} 0%,${esc(palette.chartColors[1])} 55%,${esc(palette.chartColors[2])} 100%);"></div></div>`;
  }

  if (motif === "swiss-cross") {
    return `<div class="motif-layer" aria-hidden="true"><svg viewBox="0 0 24 24" style="position:absolute;top:22px;right:30px;width:16px;height:16px;"><rect x="0" y="8" width="24" height="8" fill="${esc(palette.accent)}"/><rect x="8" y="0" width="8" height="24" fill="${esc(palette.accent)}"/></svg></div>`;
  }

  if (motif === "bento-dots") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;top:22px;right:28px;display:flex;gap:6px;">${palette.chartColors
      .slice(0, 3)
      .map(
        (hex, idx) =>
          `<span style="width:8px;height:8px;border-radius:999px;background:${esc(
            hex
          )};opacity:${idx === 0 ? 1 : 0.45};display:inline-block;"></span>`
      )
      .join("")}</div></div>`;
  }

  if (motif === "editorial-drop") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;inset:16px 22px;border:1px solid ${esc(palette.border)};opacity:0.65;"></div></div>`;
  }

  if (motif === "hard-offset") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;top:0;left:0;right:0;height:6px;background:${esc(palette.border)};"></div><div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${esc(palette.border)};"></div></div>`;
  }

  if (motif === "spotlight-orb") {
    return `<div class="motif-layer" aria-hidden="true"><div style="position:absolute;top:-160px;right:-100px;width:440px;height:440px;border-radius:50%;background:radial-gradient(circle,${esc(palette.accent)}2B 0%,transparent 68%);"></div><div style="position:absolute;bottom:-180px;left:-100px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,${esc(palette.chartColors[1])}1F 0%,transparent 70%);"></div></div>`;
  }

  if (motif === "corner-brackets") {
    const c = esc(palette.accent);
    return `<div class="motif-layer" aria-hidden="true"><svg viewBox="0 0 960 540" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;"><path d="M24 44 L24 24 L44 24" fill="none" stroke="${c}" stroke-width="2"/><path d="M916 24 L936 24 L936 44" fill="none" stroke="${c}" stroke-width="2"/><path d="M24 496 L24 516 L44 516" fill="none" stroke="${c}" stroke-width="2"/><path d="M916 516 L936 516 L936 496" fill="none" stroke="${c}" stroke-width="2"/></svg></div>`;
  }

  if (motif === "ink-wash") {
    return `<div class="motif-layer" aria-hidden="true"><svg viewBox="0 0 960 540" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;"><path d="M0 455 Q 240 380 480 432 T 960 398 L 960 540 L 0 540 Z" fill="${esc(palette.chartColors[1])}" opacity="0.09"/><path d="M0 485 Q 320 430 620 470 T 960 445 L 960 540 L 0 540 Z" fill="${esc(palette.text)}" opacity="0.05"/><rect x="24" y="24" width="912" height="492" fill="none" stroke="${esc(palette.border)}" stroke-width="1"/></svg></div>`;
  }

  if (motif === "bauhaus-geo") {
    return `<div class="motif-layer" aria-hidden="true"><svg viewBox="0 0 960 540" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">${
      isCover
        ? `<rect x="690" y="0" width="270" height="270" fill="${esc(palette.chartColors[1])}"/><circle cx="690" cy="365" r="95" fill="${esc(palette.chartColors[0])}"/><rect x="785" y="270" width="175" height="270" fill="${esc(palette.chartColors[2])}"/><line x1="0" y1="468" x2="960" y2="468" stroke="${esc(palette.border)}" stroke-width="2"/>`
        : `<rect x="0" y="0" width="14" height="180" fill="${esc(palette.chartColors[0])}"/><rect x="0" y="180" width="14" height="180" fill="${esc(palette.chartColors[1])}"/><rect x="0" y="360" width="14" height="180" fill="${esc(palette.chartColors[2])}"/>`
    }</svg></div>`;
  }

  return "";
}

export function exportStandaloneHtmlDeck(options: {
  title: string;
  subtitle: string;
  audience: string;
  styleName: string;
  spec: VisualSpec;
  slides: DeckSlideItem[];
}): string {
  const { title, subtitle, audience, styleName, spec } = options;
  const slides = Array.isArray(options.slides)
    ? options.slides.filter((s) => Boolean(s && typeof s === "object"))
    : [];
  const palette = spec?.palette;
  const typography = spec?.typography;
  const layout = spec?.layout;
  const total = slides.length;

  const cssBg = escCssVal(palette?.bg, "#F5F2EB");
  const cssSurface = escCssVal(palette?.surface, "#FFFFFF");
  const cssText = escCssVal(palette?.text, "#171615");
  const cssMuted = escCssVal(palette?.muted, "#666666");
  const cssAccent = escCssVal(palette?.accent, "#C84B31");
  const cssAccentSoft = escCssVal(palette?.accentSoft, "rgba(200, 75, 49, 0.12)");
  const cssBorder = escCssVal(palette?.border, "#D6D3CD");
  const rawRadius = safeNumVal(layout?.cornerRadius);
  const safeRadius = Math.max(
    0,
    Math.min(48, Math.round(Number.isFinite(rawRadius) ? rawRadius : 0))
  );
  const rawTitleWeight = safeNumVal(typography?.titleWeight);
  const safeTitleWeight = Math.max(
    100,
    Math.min(
      900,
      Math.round(Number.isFinite(rawTitleWeight) ? rawTitleWeight : 700)
    )
  );
  const cssTitleTracking = escCssVal(typography?.titleTracking, "-0.02em");
  const archetype: LayoutArchetype = layout?.archetype || "swiss-grid";
  const motif: DecorativeMotif = layout?.decorativeMotif || "hairline-rule";
  const isBrutalist =
    archetype === "brutalist-poster" || motif === "hard-offset";
  const isBento = archetype === "soft-bento";

  const rawChartColors = Array.isArray(palette?.chartColors)
    ? palette.chartColors
    : [];
  const safeChartColors: [string, string, string, string] = [
    escCssVal(rawChartColors[0], cssAccent),
    escCssVal(rawChartColors[1], cssText),
    escCssVal(rawChartColors[2], cssMuted),
    escCssVal(rawChartColors[3], cssBorder),
  ];

  const safePalette: VisualPalette = {
    bg: cssBg,
    surface: cssSurface,
    text: cssText,
    muted: cssMuted,
    accent: cssAccent,
    accentSoft: cssAccentSoft,
    border: cssBorder,
    chartColors: safeChartColors,
  };

  const isSerif =
    typography?.mood === "editorial" ||
    typography?.mood === "academic" ||
    typography?.mood === "chinese";

  const headingStack = isSerif
    ? `'Noto Serif SC', 'Songti SC', Georgia, 'Times New Roman', serif`
    : `'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif`;

  const renderCoverByArchetype = (s: DeckSlideItem) => {
    const coverTitle = esc(safeTextVal(s.title) || title);
    const coverSub = esc(safeTextVal(s.subtitle) || subtitle);
    const coverTag = esc(safeTextVal(s.sectionTag) || styleName);

    if (archetype === "keynote-center") {
      return `
        <div class="slide-cover cover-keynote">
          <span class="badge">${coverTag} · KEYNOTE</span>
          <h1>${coverTitle}</h1>
          <p class="subtitle">${coverSub}</p>
          <div class="keynote-meta">
            <span>AUDIENCE · ${esc(audience)}</span>
            <span>${total} SLIDES · 16:9 STAGE</span>
          </div>
        </div>
      `;
    }

    if (archetype === "soft-bento") {
      return `
        <div class="cover-bento">
          <div class="card cover-bento-main">
            <span class="badge">${coverTag} · 2026</span>
            <div>
              <h1>${coverTitle}</h1>
              <p class="subtitle" style="max-width:100%;">${coverSub}</p>
            </div>
            <span class="mono-meta">${esc(audience)} · ${total} SLIDES</span>
          </div>
          <div class="cover-bento-side">
            <div class="card cover-bento-accent">
              <small style="color:inherit;opacity:0.85;">KEY UPGRADE</small>
              <div class="bento-big">3.2×</div>
              <span>全链路流转效率跃升</span>
            </div>
            <div class="card cover-bento-sys">
              <small>MODULAR DESIGN SYSTEM</small>
              <strong>${esc(styleName)}</strong>
              <div class="swatches">
                ${safeChartColors
                  .map((c) => `<span style="background:${esc(c)}"></span>`)
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (archetype === "swiss-grid") {
      return `
        <div class="slide-cover">
          <div class="cover-top">
            <span class="badge">${coverTag}</span>
            <span class="swiss-big-idx">01</span>
          </div>
          <div class="cover-main" style="max-width:74%;">
            <h1>${coverTitle}</h1>
            <p class="subtitle" style="max-width:100%;">${coverSub}</p>
          </div>
          <div class="cover-foot">
            <div><small>AUDIENCE</small><strong>${esc(audience)}</strong></div>
            <div><small>SWISS GRID SYSTEM</small><strong>${esc(styleName)}</strong></div>
            <div class="swatches">
              ${safeChartColors
                .map((c) => `<span style="background:${esc(c)}"></span>`)
                .join("")}
            </div>
          </div>
        </div>
      `;
    }

    if (archetype === "neo-chinese") {
      return `
        <div class="slide-cover cover-chinese">
          <div class="cover-top">
            <span class="mono-tag accent">${coverTag}</span>
            <span class="cn-seal">印</span>
          </div>
          <div class="cover-main cn-rule-wrap">
            <h1>${coverTitle}</h1>
            <p class="subtitle">${coverSub}</p>
          </div>
          <div class="cover-foot">
            <div><small>AUDIENCE</small><strong>${esc(audience)}</strong></div>
            <div><small>DESIGN SYSTEM</small><strong>${esc(styleName)}</strong></div>
            <span class="mono-meta">${total} SLIDES</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="slide-cover">
        <div class="cover-top">
          <span class="badge">${coverTag}</span>
          <span class="mono-meta">${total} SLIDES · 16:9 DECK</span>
        </div>
        <div class="cover-main" ${archetype === "retro-bauhaus" ? 'style="max-width:64%;"' : ""}>
          <h1>${coverTitle}</h1>
          <p class="subtitle">${coverSub}</p>
        </div>
        <div class="cover-foot">
          <div><small>AUDIENCE</small><strong>${esc(audience)}</strong></div>
          <div><small>DESIGN SYSTEM</small><strong>${esc(styleName)}</strong></div>
          <div class="swatches">
            ${safeChartColors
              .map((c) => `<span style="background:${esc(c)}"></span>`)
              .join("")}
          </div>
        </div>
      </div>
    `;
  };

  const renderSlideInner = (s: DeckSlideItem, idx: number) => {
    const pageStr = `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    const isCover = s.slideType === "cover";
    const motifHtml = buildMotifOverlayHtml(motif, safePalette, isCover);

    if (isCover) {
      return `${motifHtml}<div class="slide-content">${renderCoverByArchetype(s)}</div>`;
    }

    const headerHtml = `
      <header class="slide-head">
        <div class="head-left">
          <span class="dot"></span>
          <span class="mono-tag">${esc(safeTextVal(s.sectionTag) || String(idx + 1).padStart(2, "0"))}</span>
        </div>
        <span class="mono-meta">${esc(title)}</span>
      </header>
    `;

    const footerHtml = `
      <footer class="slide-foot">
        <span>${esc(styleName)} · ${esc(audience)}</span>
        <strong>${pageStr}</strong>
      </footer>
    `;

    let bodyHtml = "";

    if (s.slideType === "agenda" || s.slideType === "timeline") {
      const steps = Array.isArray(s.steps)
        ? s.steps.filter((st) => Boolean(st && typeof st === "object"))
        : [];
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="${s.slideType === "timeline" ? "grid-4" : "grid-2"} body-fill">
          ${steps
            .map(
              (st, i) => `
            <div class="card">
              <div class="step-code ${i === 0 ? "accent" : ""}">${esc(st.code)}</div>
              <h3>${esc(st.title)}</h3>
              <p>${esc(st.desc)}</p>
            </div>
          `
            )
            .join("")}
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "process" || s.slideType === "closing") {
      const steps = Array.isArray(s.steps)
        ? s.steps.filter((st) => Boolean(st && typeof st === "object"))
        : [];
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        ${s.subtitle ? `<p class="lead-sub">${esc(s.subtitle)}</p>` : ""}
        <div class="grid-3 body-fill">
          ${steps
            .map(
              (st) => `
            <div class="card">
              <div class="step-code accent">${esc(st.code)}</div>
              <h3>${esc(st.title)}</h3>
              <p>${esc(st.desc)}</p>
            </div>
          `
            )
            .join("")}
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "image-split") {
      const slot =
        s.imageSlot && typeof s.imageSlot === "object" ? s.imageSlot : undefined;
      const isRight = slot?.layout === "right";
      const safeDataUrl =
        slot?.kind === "data-url" &&
        typeof slot.dataUrl === "string" &&
        SAFE_DATA_IMG_RE.test(slot.dataUrl.trim())
          ? slot.dataUrl.trim()
          : "";
      const presetId =
        safeTextVal(slot?.presetId).trim() ||
        pickDefaultArtworkForArchetype(layout?.archetype);
      const visualMarkup = safeDataUrl
        ? `<img src="${esc(safeDataUrl)}" alt="${esc(safeTextVal(slot?.caption) || s.title)}" class="split-img" />`
        : `<div class="split-svg-box">${renderArtworkSvgString(presetId, safePalette)}</div>`;
      const bullets =
        Array.isArray(s.bullets) && s.bullets.length > 0
          ? s.bullets
          : [
              "直观展示核心产品界面或业务架构，大幅降低受众理解成本",
              "5:5 视觉黄金分栏兼顾高审美张力与清晰叙事逻辑",
            ];
      const visualCol = `
        <div class="card split-visual-card">
          ${visualMarkup}
          ${slot?.caption ? `<div class="split-caption">${esc(slot.caption)}</div>` : ""}
        </div>
      `;
      const copyCol = `
        <div class="split-copy-col">
          ${s.subtitle ? `<p class="split-lead">${esc(s.subtitle)}</p>` : ""}
          ${bullets
            .slice(0, 4)
            .map(
              (b, i) => `
            <div class="card compact split-point ${i === 0 ? "highlight-card" : ""}">
              <span class="step-code accent">${String(i + 1).padStart(2, "0")}</span>
              <p>${esc(b)}</p>
            </div>
          `
            )
            .join("")}
        </div>
      `;
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="grid-2 body-fill">
          ${isRight ? `${copyCol}${visualCol}` : `${visualCol}${copyCol}`}
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "swot") {
      const swot = s.swot && typeof s.swot === "object" ? s.swot : undefined;
      const quadrants = [
        { code: "S", label: "STRENGTHS · 核心优势", list: swot?.strengths || ["核心架构与效率壁垒领先"], color: safeChartColors[0] },
        { code: "W", label: "WEAKNESSES · 短板待补", list: swot?.weaknesses || ["部分区域交付仍在爬坡"], color: safeChartColors[2] },
        { code: "O", label: "OPPORTUNITIES · 外部机遇", list: swot?.opportunities || ["高 ROI 数字化升级窗口期"], color: safeChartColors[1] },
        { code: "T", label: "THREATS · 外部挑战", list: swot?.threats || ["竞品同质化价格竞争加剧"], color: cssMuted },
      ];
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="grid-2 body-fill">
          ${quadrants
            .map(
              (q, qIdx) => `
            <div class="card swot-card ${qIdx === 0 ? "highlight-card" : ""}">
              <div class="swot-head">
                <span class="swot-badge" style="background:${esc(q.color)}">${q.code}</span>
                <strong>${esc(q.label)}</strong>
              </div>
              <ul class="clean-list muted">
                ${q.list.slice(0, 3).map((pt) => `<li>${esc(pt)}</li>`).join("")}
              </ul>
            </div>
          `
            )
            .join("")}
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "funnel-donut") {
      const rawStages = Array.isArray(s.funnelStages)
        ? s.funnelStages
            .filter((st) => Boolean(st && typeof st === "object"))
            .slice(0, 6)
            .map((st, i) => ({
              label: safeTextVal(st.label) || `阶段 ${i + 1}`,
              value: Math.max(1, sanitizeBarNum(st.value) || 10),
              unit: safeTextVal(st.unit),
              note: safeTextVal(st.note),
            }))
        : [];
      const stages = rawStages.length > 0 ? rawStages : DEFAULT_FUNNEL;
      const isDonut = s.chartMode === "donut";
      const maxVal = Math.max(1, ...stages.map((st) => st.value));

      const leftChart = isDonut
        ? buildDonutSvg(stages, safeChartColors, cssText, cssMuted)
        : `<div class="funnel-stack">
            ${stages
              .map((st, i) => {
                const pct = Math.max(36, Math.round((st.value / maxVal) * 100));
                return `<div class="funnel-bar" style="width:${pct}%;background:${esc(
                  safeChartColors[i % safeChartColors.length]
                )}">
                  <span>${esc(st.label)}</span>
                  <strong>${esc(st.value.toLocaleString())}${esc(st.unit)}</strong>
                </div>`;
              })
              .join("")}
          </div>`;

      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="data-split body-fill">
          <div class="card chart-wrap">${leftChart}</div>
          <div class="kpi-col">
            ${stages
              .slice(0, 4)
              .map(
                (st, i) => `
              <div class="card compact ${i === 0 ? "highlight-card" : ""}">
                <div class="funnel-meta-row">
                  <strong>${esc(st.label)}</strong>
                  <span class="accent" style="font-weight:700">${esc(st.value.toLocaleString())}${esc(st.unit)}</span>
                </div>
                ${st.note ? `<p>${esc(st.note)}</p>` : ""}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "team-grid") {
      const members =
        Array.isArray(s.teamMembers) && s.teamMembers.length > 0
          ? s.teamMembers.slice(0, 4)
          : [
              { name: "陈致远", role: "首席架构师", bio: "14 年企业级系统与 AI 工程经验" },
              { name: "林思语", role: "产品设计总监", bio: "资深企业级设计系统负责人" },
              { name: "周明轩", role: "算法负责人", bio: "专注大模型检索增强与低延迟推理" },
              { name: "沈嘉宁", role: "商业化总监", bio: "10 年标杆大客户成功交付经验" },
            ];
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        ${s.subtitle ? `<p class="lead-sub">${esc(s.subtitle)}</p>` : ""}
        <div class="${members.length <= 3 ? "grid-3" : "grid-4"} body-fill">
          ${members
            .map(
              (m, i) => `
            <div class="card team-card ${i === 0 ? "highlight-card" : ""}">
              <div class="team-avatar" style="background:${esc(
                safeChartColors[i % safeChartColors.length]
              )}">${esc(safeTextVal(m.name).slice(0, 1) || "T")}</div>
              <h3>${esc(m.name)}</h3>
              <div class="step-code accent">${esc(m.role)}</div>
              <p>${esc(m.bio)}</p>
            </div>
          `
            )
            .join("")}
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "quote") {
      const kpis = Array.isArray(s.kpis)
        ? s.kpis.filter((k) => Boolean(k && typeof k === "object"))
        : [];
      bodyHtml = `
        ${headerHtml}
        <div class="quote-box body-fill">
          <div class="quote-mark">“</div>
          <blockquote>${esc(safeTextVal(s.quoteText) || safeTextVal(s.title))}</blockquote>
          <cite>— ${esc(safeTextVal(s.quoteAuthor) || audience)}</cite>
          ${
            kpis.length > 0
              ? `<div class="grid-3 quote-kpis">
                  ${kpis
                    .map(
                      (k) => `<div class="card compact">
                        <small>${esc(k.label)}</small>
                        <strong class="accent">${esc(k.value)}</strong>
                      </div>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
        ${footerHtml}
      `;
    } else if (s.slideType === "comparison") {
      const leftPoints = Array.isArray(s.leftPoints) ? s.leftPoints : [];
      const rightPoints = Array.isArray(s.rightPoints) ? s.rightPoints : [];
      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="grid-2 body-fill">
          <div class="card">
            <div class="step-code">OPTION A · BASELINE</div>
            <h3>${esc(safeTextVal(s.leftTitle) || "传统方案")}</h3>
            <ul class="clean-list muted">
              ${leftPoints.map((pt) => `<li>${esc(pt)}</li>`).join("")}
            </ul>
          </div>
          <div class="card highlight-card">
            <div class="step-code accent">OPTION B · RECOMMENDED</div>
            <h3>${esc(safeTextVal(s.rightTitle) || "升级方案")}</h3>
            <ul class="clean-list">
              ${rightPoints.map((pt) => `<li>✓ ${esc(pt)}</li>`).join("")}
            </ul>
          </div>
        </div>
        ${footerHtml}
      `;
    } else {
      // Data slide
      const rawBars = Array.isArray(s.bars)
        ? s.bars
            .filter((b) => Boolean(b && typeof b === "object"))
            .map((b, bIdx) => {
              const label = safeTextVal(b.label).trim();
              return {
                label: label || `项 ${bIdx + 1}`,
                v1: sanitizeBarNum(b.v1),
                v2: sanitizeBarNum(b.v2),
              };
            })
        : [];
      const bars = rawBars.length > 0 ? rawBars : DEFAULT_BARS;
      const rawMax = Math.max(0, ...bars.flatMap((b) => [b.v1, b.v2]));
      const maxV = rawMax > 0 ? rawMax * 1.1 : 1;

      const plotLeft = 30;
      const plotRight = 420;
      const plotWidth = plotRight - plotLeft;
      const baselineY = 185;
      const maxBarH = 152;
      const n = bars.length;
      const slotW = plotWidth / n;
      const groupW = Math.min(64, slotW * 0.72);
      const barGap = Math.max(1, Math.min(6, groupW * 0.12));
      const bw = Math.max(1, (groupW - barGap) / 2);
      const pairW = bw * 2 + barGap;
      const rx = Math.min(3, bw / 3);
      const fontSize = n <= 4 ? 11 : n <= 8 ? 9.5 : 8;

      const kpis = Array.isArray(s.kpis)
        ? s.kpis.filter((k) => Boolean(k && typeof k === "object"))
        : [];

      bodyHtml = `
        ${headerHtml}
        <h2>${esc(s.title)}</h2>
        <div class="data-split body-fill">
          <div class="card chart-wrap">
            <svg viewBox="0 0 440 220" style="width:100%;height:100%;">
              ${bars
                .map((b, i) => {
                  const cx = plotLeft + (i + 0.5) * slotW;
                  const x1 = cx - pairW / 2;
                  const x2 = x1 + bw + barGap;
                  const h1 = Math.round((b.v1 / maxV) * maxBarH);
                  const h2 = Math.round((b.v2 / maxV) * maxBarH);
                  return `
                    <rect x="${x1.toFixed(1)}" y="${(baselineY - h1).toFixed(1)}" width="${bw.toFixed(1)}" height="${h1}" rx="${rx.toFixed(1)}" fill="${esc(safeChartColors[2])}" opacity="0.7"/>
                    <rect x="${x2.toFixed(1)}" y="${(baselineY - h2).toFixed(1)}" width="${bw.toFixed(1)}" height="${h2}" rx="${rx.toFixed(1)}" fill="${esc(safeChartColors[0])}"/>
                    <text x="${(x2 + bw / 2).toFixed(1)}" y="${(baselineY - h2 - 6).toFixed(1)}" text-anchor="middle" fill="${esc(cssText)}" font-size="${fontSize}" font-weight="700">${esc(b.v2)}</text>
                    <text x="${cx.toFixed(1)}" y="206" text-anchor="middle" fill="${esc(cssMuted)}" font-size="${fontSize}">${esc(b.label)}</text>
                  `;
                })
                .join("")}
              <line x1="30" y1="185" x2="420" y2="185" stroke="${esc(cssBorder)}" stroke-width="1"/>
            </svg>
          </div>
          <div class="kpi-col">
            ${kpis
              .map(
                (k, i) => `
              <div class="card ${i === 0 ? "highlight-card" : ""}">
                <small>${esc(k.label)}</small>
                <div class="kpi-val ${i === 0 ? "accent" : ""}">${esc(k.value)}</div>
                <p>${esc(k.note)}</p>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        ${footerHtml}
      `;
    }

    return `${motifHtml}<div class="slide-content">${bodyHtml}</div>`;
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} — PPTGod Interactive Deck</title>
<style>
  @page { size: 13.333in 7.5in; margin: 0; }
  :root {
    --bg: ${cssBg};
    --surface: ${cssSurface};
    --text: ${cssText};
    --muted: ${cssMuted};
    --accent: ${cssAccent};
    --accent-soft: ${cssAccentSoft};
    --border: ${cssBorder};
    --radius: ${safeRadius}px;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: #0d0d0f;
    color: var(--text);
    font-family: 'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
    overflow: hidden;
  }
  .deck-viewport {
    width: 100vw; height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px 24px 58px;
  }
  .slide {
    display: none;
    width: min(94vw, calc((100vh - 90px) * 16 / 9));
    aspect-ratio: 16 / 9;
    background: var(--bg);
    color: var(--text);
    padding: 4.5% 5.5%;
    border-radius: 6px;
    box-shadow: 0 28px 80px rgba(0,0,0,0.55);
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .slide.active { display: flex; }
  .motif-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .slide-content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; min-height: 0; }
  h1, h2, h3, blockquote {
    font-family: ${headingStack};
    font-weight: ${safeTitleWeight};
    letter-spacing: ${cssTitleTracking};
    margin: 0;
  }
  h1 { font-size: clamp(28px, 3.6vw, 50px); line-height: 1.15; margin-bottom: 16px; }
  h2 { font-size: clamp(20px, 2.2vw, 30px); line-height: 1.24; margin-bottom: 16px; }
  h3 { font-size: clamp(15px, 1.4vw, 20px); margin-bottom: 8px; }
  p { margin: 0; font-size: clamp(12px, 1.05vw, 15px); line-height: 1.55; color: var(--muted); }
  .lead-sub { margin-top: -8px; margin-bottom: 14px; }
  .accent { color: var(--accent) !important; }
  .slide-head, .slide-foot, .cover-top, .cover-foot {
    display: flex; align-items: center; justify-content: space-between;
  }
  .slide-head { padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px solid var(--border); font-size: 12px; }
  .head-left { display: flex; align-items: center; gap: 8px; }
  .dot { width: 8px; height: 8px; background: var(--accent); border-radius: ${safeRadius > 6 ? "999px" : "2px"}; display: inline-block; }
  .mono-tag, .mono-meta, .step-code, small {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px; letter-spacing: 0.08em; color: var(--muted);
  }
  .step-code { font-weight: 700; margin-bottom: 6px; }
  .slide-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; }
  .slide-cover { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .cover-keynote { align-items: center; justify-content: center; text-align: center; gap: 16px; }
  .keynote-meta { display: flex; gap: 24px; border-top: 1px solid var(--border); padding-top: 16px; margin-top: 12px; font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--muted); }
  .cover-bento { flex: 1; display: grid; grid-template-columns: 1.45fr 1fr; gap: 16px; }
  .cover-bento-main { justify-content: space-between; padding: 28px 32px; }
  .cover-bento-side { display: grid; grid-template-rows: 1fr 1fr; gap: 14px; }
  .cover-bento-accent { background: var(--accent) !important; border-color: var(--accent) !important; color: #FFFFFF !important; justify-content: space-between; padding: 22px 24px; }
  .bento-big { font-size: clamp(32px, 3.8vw, 48px); font-weight: 800; line-height: 1; }
  .cover-bento-sys { justify-content: space-between; padding: 22px 24px; }
  .swiss-big-idx { font-family: ui-monospace, monospace; font-size: clamp(46px, 6vw, 88px); font-weight: 800; line-height: 0.9; color: var(--border); }
  .cn-seal { width: 34px; height: 34px; background: var(--accent); color: #fff; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-family: ${headingStack}; }
  .cn-rule-wrap { border-left: 4px solid var(--accent); padding-left: 22px; }
  .badge { padding: 5px 12px; border-radius: var(--radius); background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; width: fit-content; }
  .subtitle { font-size: clamp(14px, 1.4vw, 20px); max-width: 75%; }
  .cover-foot { padding-top: 16px; border-top: 1px solid var(--border); }
  .cover-foot small { display: block; margin-bottom: 4px; }
  .swatches { display: flex; gap: 6px; }
  .swatches span { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border); }
  .body-fill { flex: 1; min-height: 0; align-content: center; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .data-split { display: grid; grid-template-columns: 1.35fr 1fr; gap: 18px; }
  .kpi-col { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
  .card {
    background: var(--surface);
    border: ${isBrutalist ? "2px" : "1px"} solid var(--border);
    border-radius: var(--radius);
    box-shadow: ${isBrutalist ? "4px 4px 0px var(--border)" : isBento ? "0 6px 20px rgba(17,20,24,0.05)" : "none"};
    padding: 16px 18px;
    display: flex; flex-direction: column; justify-content: center;
  }
  .card.compact { padding: 10px 14px; }
  .highlight-card { border-color: var(--accent); border-width: 1.5px; }
  .kpi-val { font-size: clamp(22px, 2.4vw, 34px); font-weight: 800; line-height: 1.1; margin: 4px 0; color: var(--text); }
  .clean-list { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: clamp(12px, 1.02vw, 14.5px); line-height: 1.48; }
  .clean-list.muted { color: var(--muted); }
  .quote-box { display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 0 4%; }
  .quote-mark { font-size: 64px; line-height: 0.6; color: var(--accent); font-family: Georgia, serif; }
  blockquote { font-size: clamp(20px, 2.4vw, 34px); line-height: 1.35; }
  cite { font-style: normal; font-size: 13px; color: var(--muted); }
  .quote-kpis { margin-top: 12px; }
  .split-visual-card { padding: 12px; gap: 8px; justify-content: space-between; }
  .split-img { width: 100%; height: 100%; max-height: 300px; object-fit: cover; border-radius: calc(var(--radius) * 0.7); display: block; }
  .split-svg-box { width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: calc(var(--radius) * 0.7); }
  .split-svg-box svg { width: 100%; height: auto; max-height: 290px; display: block; }
  .split-caption { font-size: 11px; color: var(--muted); text-align: center; font-family: ui-monospace, monospace; }
  .split-copy-col { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
  .split-lead { font-size: clamp(12.5px, 1.1vw, 15px); margin-bottom: 4px; }
  .split-point { flex-direction: row; align-items: flex-start; gap: 12px; justify-content: flex-start; }
  .split-point .step-code { margin: 2px 0 0; }
  .swot-card { justify-content: flex-start; }
  .swot-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 13px; }
  .swot-badge { width: 26px; height: 26px; border-radius: 4px; color: #fff; font-weight: 800; font-family: ui-monospace, monospace; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .funnel-stack { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 100%; padding: 8px 0; }
  .funnel-bar { padding: 11px 16px; border-radius: var(--radius); color: #fff; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .funnel-meta-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 13px; }
  .team-card { align-items: center; text-align: center; justify-content: flex-start; gap: 6px; }
  .team-avatar { width: 48px; height: 48px; border-radius: 999px; color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .hud {
    position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 10px;
    background: rgba(24,24,28,0.9); color: #f3f4f6;
    padding: 7px 14px; border-radius: 999px; font-size: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    z-index: 30;
  }
  .hud button {
    background: rgba(255,255,255,0.1); color: #fff; border: none;
    padding: 4px 10px; border-radius: 999px; cursor: pointer; font-size: 12px;
  }
  .hud button:hover { background: rgba(255,255,255,0.22); }
  .notes-drawer {
    position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
    width: min(820px, 92vw); background: rgba(18,18,22,0.95); color: #e5e7eb;
    border: 1px solid rgba(255,255,255,0.18); border-radius: 10px;
    padding: 12px 18px; font-size: 13px; line-height: 1.6; display: none;
    z-index: 30;
  }
  .notes-drawer.open { display: block; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      width: 13.333in; height: auto;
      background: var(--bg); overflow: visible;
      margin: 0; padding: 0;
    }
    .deck-viewport { display: block; padding: 0; width: 13.333in; height: auto; }
    .hud, .notes-drawer { display: none !important; }
    .slide {
      display: flex !important;
      width: 13.333in; height: 7.5in;
      aspect-ratio: auto;
      margin: 0;
      break-after: page;
      page-break-after: always;
      box-shadow: none; border-radius: 0;
    }
    .slide:last-child { break-after: auto; page-break-after: auto; }
  }
</style>
</head>
<body>
  <div class="deck-viewport">
    ${slides
      .map(
        (s, idx) => `
      <section class="slide ${idx === 0 ? "active" : ""}" data-index="${idx}" data-notes="${esc(s.speakerNotes || "")}">
        ${renderSlideInner(s, idx)}
      </section>
    `
      )
      .join("")}
  </div>

  <div class="notes-drawer" id="notesDrawer"></div>

  <div class="hud">
    <button onclick="prev()">← 上一页</button>
    <span id="counter">${total > 0 ? 1 : 0} / ${total}</span>
    <button onclick="next()">下一页 →</button>
    <button onclick="toggleNotes()">讲稿备注 (N)</button>
    <button onclick="window.print()">打印 / 存为 16:9 矢量 PDF</button>
  </div>

  <script>
    let cur = 0;
    const slides = document.querySelectorAll('.slide');
    const counter = document.getElementById('counter');
    const drawer = document.getElementById('notesDrawer');
    function show(idx) {
      if (!slides.length) return;
      cur = (idx + slides.length) % slides.length;
      slides.forEach((el, i) => el.classList.toggle('active', i === cur));
      counter.textContent = (cur + 1) + ' / ' + slides.length;
      const notes = slides[cur].getAttribute('data-notes') || '本页暂无演讲者备注';
      drawer.textContent = '🎤 演讲逐字稿：' + notes;
    }
    function next() { show(cur + 1); }
    function prev() { show(cur - 1); }
    function toggleNotes() { drawer.classList.toggle('open'); }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'n' || e.key === 'N') toggleNotes();
    });
    show(0);
  </script>
</body>
</html>`;
}
