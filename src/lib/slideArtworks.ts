import type { LayoutArchetype, VisualPalette } from "@/types/prompt";

export interface SlideArtworkPreset {
  id: string;
  label: string;
  category: string;
  description: string;
}

export const SLIDE_ARTWORK_PRESETS: SlideArtworkPreset[] = [
  {
    id: "swiss-geometry",
    label: "瑞士秩序几何",
    category: "极简平面",
    description: "非对称网格圆弧与精准比例尺",
  },
  {
    id: "neural-orbit",
    label: "智能星轨网络",
    category: "AI 科技",
    description: "多层同心轨道与连接节点拓扑",
  },
  {
    id: "song-mountains",
    label: "宋韵远山层峦",
    category: "东方美学",
    description: "水墨远山曲线与朱砂落日印记",
  },
  {
    id: "bauhaus-composition",
    label: "包豪斯原色构成",
    category: "先锋构成",
    description: "圆方三角的经典包豪斯构成张力",
  },
  {
    id: "data-topography",
    label: "增长地形等高线",
    category: "数据洞察",
    description: "平滑趋势波峰与量化采样锚点",
  },
  {
    id: "bento-devices",
    label: "现代模块硬件阵",
    category: "产品发布",
    description: "浮雕圆角界面卡片与核心焦点屏",
  },
  {
    id: "biotech-helix",
    label: "生命分子双螺旋",
    category: "医疗生物",
    description: "精密分子链与临床对照标尺",
  },
  {
    id: "financial-pulse",
    label: "量化终端波动阵",
    category: "金融投研",
    description: "高频K线柱阵与基准趋势走廊",
  },
  {
    id: "architecture-iso",
    label: "云原生等轴架构",
    category: "工程技术",
    description: "三层立体等轴测系统模块堆叠",
  },
  {
    id: "editorial-arch",
    label: "静奢画廊拱廊",
    category: "品牌美学",
    description: "建筑透视拱门与极细发丝黄金线",
  },
  {
    id: "industrial-radar",
    label: "机能坐标雷达",
    category: "硬科技制造",
    description: "工程准星刻度环与象限扫描扇区",
  },
  {
    id: "editorial-botanical",
    label: "人文纸本叶脉",
    category: "暖调人文",
    description: "有机柔和曲线与自然平衡意象",
  },
];

export function pickDefaultArtworkForArchetype(
  archetype?: LayoutArchetype
): string {
  switch (archetype) {
    case "swiss-grid":
      return "swiss-geometry";
    case "keynote-center":
      return "neural-orbit";
    case "neo-chinese":
      return "song-mountains";
    case "retro-bauhaus":
    case "brutalist-poster":
      return "bauhaus-composition";
    case "consulting-mbb":
    case "executive-emerald":
      return "data-topography";
    case "soft-bento":
      return "bento-devices";
    case "clinical-clean":
      return "biotech-helix";
    case "financial-terminal":
      return "financial-pulse";
    case "tech-blueprint":
      return "industrial-radar";
    case "editorial-asymmetric":
    case "luxury-minimal":
      return "editorial-arch";
    case "warm-humanist":
      return "editorial-botanical";
    case "chalkboard-class":
      return "swiss-geometry";
    case "scientific-figure":
      return "biotech-helix";
    case "civic-redgold":
      return "song-mountains";
    case "pmo-rag-grid":
      return "data-topography";
    case "polaroid-zine":
      return "editorial-botanical";
    default:
      return "architecture-iso";
  }
}

function escAttr(v: string): string {
  return v.replace(/[<>"'&]/g, "");
}

/**
 * Generates a self-contained, palette-adaptive 400x360 SVG string.
 * Safe for inline rendering in HTML exports, SlideCanvas data-URI/inner markup,
 * and zero-network offline usage.
 */
export function renderArtworkSvgString(
  presetId: string,
  palette: VisualPalette
): string {
  const bg = escAttr(palette.surface);
  const canvas = escAttr(palette.bg);
  const text = escAttr(palette.text);
  const muted = escAttr(palette.muted);
  const accent = escAttr(palette.accent);
  const border = escAttr(palette.border);
  const c1 = escAttr(palette.chartColors[0] || accent);
  const c2 = escAttr(palette.chartColors[1] || text);
  const c3 = escAttr(palette.chartColors[2] || muted);
  const c4 = escAttr(palette.chartColors[3] || border);

  let body = "";

  switch (presetId) {
    case "neural-orbit":
      body = `
        <circle cx="200" cy="180" r="132" fill="none" stroke="${border}" stroke-width="1.2" stroke-dasharray="4 5"/>
        <circle cx="200" cy="180" r="92" fill="none" stroke="${c2}" stroke-width="1.5" opacity="0.5"/>
        <circle cx="200" cy="180" r="52" fill="${c1}" opacity="0.14"/>
        <circle cx="200" cy="180" r="22" fill="${c1}"/>
        <line x1="200" y1="180" x2="310" y2="110" stroke="${c1}" stroke-width="1.8" opacity="0.7"/>
        <line x1="200" y1="180" x2="94" y2="122" stroke="${c2}" stroke-width="1.8" opacity="0.7"/>
        <line x1="200" y1="180" x2="274" y2="274" stroke="${c3}" stroke-width="1.8" opacity="0.7"/>
        <line x1="200" y1="180" x2="108" y2="262" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
        <circle cx="310" cy="110" r="12" fill="${bg}" stroke="${c1}" stroke-width="3"/>
        <circle cx="94" cy="122" r="10" fill="${c2}"/>
        <circle cx="274" cy="274" r="11" fill="${bg}" stroke="${c2}" stroke-width="3"/>
        <circle cx="108" cy="262" r="8" fill="${c3}"/>
        <circle cx="200" cy="48" r="7" fill="${c1}"/>
      `;
      break;

    case "song-mountains":
      body = `
        <rect x="20" y="20" width="360" height="320" fill="none" stroke="${border}" stroke-width="1"/>
        <circle cx="292" cy="96" r="34" fill="${c1}" opacity="0.88"/>
        <path d="M20 262 Q 112 162 204 226 T 380 184 L 380 340 L 20 340 Z" fill="${c2}" opacity="0.24"/>
        <path d="M20 296 Q 140 218 248 268 T 380 232 L 380 340 L 20 340 Z" fill="${c2}" opacity="0.48"/>
        <path d="M20 322 Q 170 268 290 302 T 380 286 L 380 340 L 20 340 Z" fill="${text}" opacity="0.22"/>
        <rect x="52" y="56" width="28" height="28" fill="none" stroke="${c1}" stroke-width="2"/>
        <rect x="59" y="63" width="14" height="14" fill="${c1}"/>
      `;
      break;

    case "bauhaus-composition":
      body = `
        <rect x="44" y="42" width="148" height="148" fill="${c2}"/>
        <circle cx="268" cy="116" r="74" fill="${c1}"/>
        <polygon points="44,316 192,190 192,316" fill="${c3}"/>
        <rect x="208" y="206" width="146" height="110" fill="${canvas}" stroke="${text}" stroke-width="3"/>
        <circle cx="281" cy="261" r="28" fill="${text}"/>
        <line x1="24" y1="190" x2="376" y2="190" stroke="${text}" stroke-width="2.5"/>
      `;
      break;

    case "data-topography":
      body = `
        <path d="M30 290 L30 210 Q110 155 180 190 T370 95 L370 290 Z" fill="${c1}" opacity="0.16"/>
        <path d="M30 290 L30 245 Q120 205 210 225 T370 155 L370 290 Z" fill="${c2}" opacity="0.18"/>
        <path d="M30 210 Q110 155 180 190 T370 95" fill="none" stroke="${c1}" stroke-width="3.2"/>
        <path d="M30 245 Q120 205 210 225 T370 155" fill="none" stroke="${c2}" stroke-width="2.2" stroke-dasharray="6 4"/>
        <circle cx="110" cy="176" r="6" fill="${bg}" stroke="${c1}" stroke-width="3"/>
        <circle cx="242" cy="158" r="6" fill="${bg}" stroke="${c1}" stroke-width="3"/>
        <circle cx="370" cy="95" r="8" fill="${c1}"/>
        <line x1="30" y1="290" x2="370" y2="290" stroke="${border}" stroke-width="1.5"/>
        <line x1="30" y1="70" x2="30" y2="290" stroke="${border}" stroke-width="1.5"/>
      `;
      break;

    case "bento-devices":
      body = `
        <rect x="34" y="34" width="204" height="186" rx="18" fill="${canvas}" stroke="${border}" stroke-width="1.5"/>
        <rect x="52" y="54" width="72" height="12" rx="6" fill="${c1}" opacity="0.25"/>
        <rect x="52" y="80" width="144" height="18" rx="6" fill="${text}" opacity="0.82"/>
        <rect x="52" y="110" width="110" height="10" rx="5" fill="${muted}" opacity="0.45"/>
        <rect x="52" y="142" width="168" height="58" rx="12" fill="${c1}" opacity="0.14"/>
        <rect x="252" y="34" width="114" height="114" rx="18" fill="${c1}"/>
        <circle cx="309" cy="91" r="24" fill="${bg}" opacity="0.22"/>
        <rect x="252" y="162" width="114" height="164" rx="18" fill="${canvas}" stroke="${border}" stroke-width="1.5"/>
        <rect x="270" y="218" width="22" height="84" rx="5" fill="${c3}" opacity="0.6"/>
        <rect x="300" y="192" width="22" height="110" rx="5" fill="${c2}"/>
        <rect x="330" y="236" width="18" height="66" rx="5" fill="${c1}"/>
        <rect x="34" y="234" width="204" height="92" rx="18" fill="${canvas}" stroke="${border}" stroke-width="1.5"/>
        <circle cx="76" cy="280" r="22" fill="${c2}" opacity="0.2"/>
        <rect x="114" y="266" width="96" height="12" rx="6" fill="${text}" opacity="0.72"/>
        <rect x="114" y="286" width="64" height="9" rx="4" fill="${muted}" opacity="0.45"/>
      `;
      break;

    case "biotech-helix":
      body = `
        <path d="M90 50 C 260 110, 140 250, 310 310" fill="none" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>
        <path d="M310 50 C 140 110, 260 250, 90 310" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>
        <line x1="126" y1="84" x2="274" y2="84" stroke="${border}" stroke-width="2.2"/>
        <line x1="158" y1="132" x2="242" y2="132" stroke="${border}" stroke-width="2.2"/>
        <line x1="158" y1="228" x2="242" y2="228" stroke="${border}" stroke-width="2.2"/>
        <line x1="126" y1="276" x2="274" y2="276" stroke="${border}" stroke-width="2.2"/>
        <circle cx="126" cy="84" r="8" fill="${c1}"/>
        <circle cx="274" cy="84" r="8" fill="${c2}"/>
        <circle cx="200" cy="180" r="14" fill="${bg}" stroke="${c1}" stroke-width="3.5"/>
        <circle cx="126" cy="276" r="8" fill="${c2}"/>
        <circle cx="274" cy="276" r="8" fill="${c1}"/>
      `;
      break;

    case "financial-pulse":
      body = `
        <line x1="36" y1="90" x2="364" y2="90" stroke="${border}" stroke-dasharray="3 4"/>
        <line x1="36" y1="180" x2="364" y2="180" stroke="${border}" stroke-dasharray="3 4"/>
        <line x1="36" y1="270" x2="364" y2="270" stroke="${border}" stroke-dasharray="3 4"/>
        ${[
          { x: 64, t: 170, h: 72, c: c3 },
          { x: 108, t: 140, h: 90, c: c2 },
          { x: 152, t: 156, h: 64, c: c3 },
          { x: 196, t: 112, h: 102, c: c1 },
          { x: 240, t: 94, h: 118, c: c2 },
          { x: 284, t: 74, h: 122, c: c1 },
          { x: 328, t: 54, h: 138, c: c1 },
        ]
          .map(
            (k) => `
          <line x1="${k.x + 11}" y1="${k.t - 18}" x2="${k.x + 11}" y2="${k.t + k.h + 18}" stroke="${k.c}" stroke-width="2"/>
          <rect x="${k.x}" y="${k.t}" width="22" height="${k.h}" rx="2" fill="${k.c}"/>
        `
          )
          .join("")}
        <polyline points="75,188 119,154 163,166 207,122 251,106 295,84 339,62" fill="none" stroke="${text}" stroke-width="2.4"/>
      `;
      break;

    case "architecture-iso":
      body = `
        <polygon points="200,56 326,112 200,168 74,112" fill="${c1}" opacity="0.88"/>
        <polygon points="200,126 326,182 200,238 74,182" fill="${c2}" opacity="0.72"/>
        <polygon points="200,196 326,252 200,308 74,252" fill="${c3}" opacity="0.58"/>
        <polygon points="200,56 326,112 200,168 74,112" fill="none" stroke="${bg}" stroke-width="2"/>
        <polygon points="200,126 326,182 200,238 74,182" fill="none" stroke="${bg}" stroke-width="2"/>
        <polygon points="200,196 326,252 200,308 74,252" fill="none" stroke="${bg}" stroke-width="2"/>
      `;
      break;

    case "editorial-arch":
      body = `
        <path d="M96 314 L96 156 A 104 104 0 0 1 304 156 L304 314 Z" fill="${canvas}" stroke="${border}" stroke-width="1.5"/>
        <path d="M138 314 L138 176 A 62 62 0 0 1 262 176 L262 314 Z" fill="${c1}" opacity="0.16" stroke="${c1}" stroke-width="1.5"/>
        <circle cx="200" cy="148" r="24" fill="${c1}"/>
        <line x1="40" y1="314" x2="360" y2="314" stroke="${text}" stroke-width="1.5"/>
        <line x1="200" y1="30" x2="200" y2="314" stroke="${border}" stroke-width="1" stroke-dasharray="3 4"/>
      `;
      break;

    case "industrial-radar":
      body = `
        <circle cx="200" cy="180" r="126" fill="none" stroke="${border}" stroke-width="1.5"/>
        <circle cx="200" cy="180" r="84" fill="none" stroke="${border}" stroke-width="1.2"/>
        <circle cx="200" cy="180" r="42" fill="none" stroke="${c1}" stroke-width="1.5"/>
        <line x1="56" y1="180" x2="344" y2="180" stroke="${border}" stroke-width="1.2"/>
        <line x1="200" y1="36" x2="200" y2="324" stroke="${border}" stroke-width="1.2"/>
        <path d="M200 180 L200 54 A 126 126 0 0 1 312 122 Z" fill="${c1}" opacity="0.28"/>
        <circle cx="258" cy="126" r="7" fill="${c1}"/>
        <circle cx="150" cy="218" r="6" fill="${c2}"/>
        <path d="M40 60 L40 40 L60 40 M340 40 L360 40 L360 60 M40 300 L40 320 L60 320 M340 320 L360 320 L360 300" fill="none" stroke="${c1}" stroke-width="2"/>
      `;
      break;

    case "editorial-botanical":
      body = `
        <circle cx="220" cy="166" r="110" fill="${c1}" opacity="0.14"/>
        <circle cx="152" cy="214" r="78" fill="${c2}" opacity="0.16"/>
        <path d="M120 310 Q 170 210 264 78" fill="none" stroke="${text}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M164 236 Q 112 198 118 148 Q 168 158 178 214" fill="${c2}" opacity="0.72"/>
        <path d="M204 176 Q 262 172 288 124 Q 238 112 210 162" fill="${c1}" opacity="0.82"/>
        <path d="M234 128 Q 204 94 220 56 Q 256 76 244 116" fill="${c3}" opacity="0.65"/>
      `;
      break;

    case "swiss-geometry":
    default:
      body = `
        <line x1="136" y1="24" x2="136" y2="336" stroke="${border}" stroke-width="1.2"/>
        <line x1="264" y1="24" x2="264" y2="336" stroke="${border}" stroke-width="1.2"/>
        <line x1="24" y1="120" x2="376" y2="120" stroke="${border}" stroke-width="1.2"/>
        <line x1="24" y1="240" x2="376" y2="240" stroke="${border}" stroke-width="1.2"/>
        <circle cx="200" cy="180" r="88" fill="${c1}"/>
        <rect x="52" y="180" width="148" height="128" fill="${text}" opacity="0.92"/>
        <circle cx="264" cy="120" r="34" fill="${bg}" stroke="${text}" stroke-width="3"/>
        <rect x="292" y="240" width="56" height="68" fill="${c3}" opacity="0.5"/>
        <rect x="64" y="64" width="44" height="10" fill="${c1}"/>
        <rect x="64" y="84" width="28" height="10" fill="${c4}"/>
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" width="400" height="360" role="img" aria-label="Style adaptive presentation artwork">
    <rect width="400" height="360" fill="${bg}"/>
    ${body}
  </svg>`;
}
