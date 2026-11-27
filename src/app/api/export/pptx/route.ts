import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { getCurrentUser } from "@/lib/auth";
import { getSavedDeckById } from "@/lib/db";
import { isValidImageDataUrl } from "@/lib/deckValidation";
import {
  addArchetypeMotif,
  addStyledCard,
  drawNativeArtworkPreset,
  renderArchetypeCover,
  type PptxThemeTokens,
} from "@/lib/pptxArchetypes";
import { PPTX_CONTENT_TYPE, readSavedPptx, savedPptxCacheKey, storeSavedPptx } from "@/lib/pptxStorage";
import { pickDefaultArtworkForArchetype } from "@/lib/slideArtworks";
import { limitToolRequest } from "@/lib/toolRateLimit";
import type {
  DataDisplayMode,
  DeckSlideItem,
  DecorativeMotif,
  LayoutArchetype,
  VisualSpec,
} from "@/types/prompt";
import { safeNumber, safeString } from "../../prompts/_validation";

const XML_ILLEGAL_CTRL_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g;

const RGB_RE =
  /^rgba?\(\s*(\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(\d+(?:\.\d+)?|\.\d+)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?|\.\d+%?))?\s*\)$/i;

const DEFAULT_BARS = [
  { label: "Q1", v1: 42, v2: 58 },
  { label: "Q2", v1: 52, v2: 76 },
  { label: "Q3", v1: 61, v2: 94 },
  { label: "Q4", v1: 72, v2: 116 },
];

const DEFAULT_AGENDA_STEPS = [
  { code: "01", title: "背景洞察与破题", desc: "对齐核心业务背景与关键痛点" },
  { code: "02", title: "核心方案与架构", desc: "拆解系统化能力底座与关键壁垒" },
  { code: "03", title: "数据验证与对比", desc: "以量化指标对比验证投入产出比" },
  { code: "04", title: "落地路线与行动", desc: "明确里程碑排期与近期行动清单" },
];

const DEFAULT_PROCESS_STEPS = [
  { code: "STEP 01", title: "标准接入", desc: "建立统一输入规范与高可靠采集管道" },
  { code: "STEP 02", title: "核心引擎", desc: "通过低延迟算法与规则护栏联动执行" },
  { code: "STEP 03", title: "业务闭环", desc: "实时回收指标反馈驱动系统持续演进" },
];

const DEFAULT_TIMELINE_STEPS = [
  { code: "PHASE 1", title: "试点验证", desc: "选定高价值核心场景完成标杆上线" },
  { code: "PHASE 2", title: "标准扩面", desc: "沉淀可复用方法论覆盖核心业务线" },
  { code: "PHASE 3", title: "规模推广", desc: "全面打通上下游协同释放规模红利" },
  { code: "PHASE 4", title: "长效迭代", desc: "建立季度复盘与持续优化飞轮机制" },
];

const DEFAULT_FUNNEL_STAGES = [
  { label: "潜客触达建联", value: 10000, unit: "人", note: "全渠道精准获客" },
  { label: "深度体验 POC", value: 4200, unit: "人", note: "转化率 42.0%" },
  { label: "正式签约部署", value: 1680, unit: "人", note: "转化率 40.0%" },
  { label: "年度续费增购", value: 1290, unit: "人", note: "NDR 达 128%" },
];

const DEFAULT_TEAM_MEMBERS = [
  { name: "陈致远", role: "首席架构师", bio: "14 年企业级系统与 AI 工程经验", badge: "ARCH" },
  { name: "林思语", role: "产品设计总监", bio: "资深企业级可视化设计系统负责人", badge: "DESIGN" },
  { name: "周明轩", role: "算法研发负责人", bio: "专注大模型检索增强与推理加速", badge: "AI" },
  { name: "沈嘉宁", role: "商业化交付总监", bio: "10 年大客户交付与成功经验", badge: "GROWTH" },
];

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexToRgb(hex6: string): [number, number, number] {
  const clean = hex6.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return [255, 255, 255];
}

function rgbToHex6(r: number, g: number, b: number): string {
  return [clampByte(r), clampByte(g), clampByte(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function compositeOverBg(
  r: number,
  g: number,
  b: number,
  alpha: number,
  bgHex: string
): string {
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  if (a >= 1) return rgbToHex6(r, g, b);
  const [bgR, bgG, bgB] = parseHexToRgb(bgHex);
  return rgbToHex6(
    r * a + bgR * (1 - a),
    g * a + bgG * (1 - a),
    b * a + bgB * (1 - a)
  );
}

function toHex6(
  input: string | undefined,
  fallback = "171615",
  bgHex = "FFFFFF"
): string {
  if (typeof input !== "string" || !input.trim()) return fallback;
  const trimmed = input.trim();

  if (trimmed.startsWith("#")) {
    const clean = trimmed.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
    if (/^[0-9a-fA-F]{3}$/.test(clean)) {
      return clean
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase();
    }
    if (/^[0-9a-fA-F]{8}$/.test(clean)) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = parseInt(clean.slice(6, 8), 16) / 255;
      return compositeOverBg(r, g, b, a, bgHex);
    }
    if (/^[0-9a-fA-F]{4}$/.test(clean)) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      const a = parseInt(clean[3] + clean[3], 16) / 255;
      return compositeOverBg(r, g, b, a, bgHex);
    }
    return fallback;
  }

  const rgbMatch = trimmed.match(RGB_RE);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    const alphaRaw = rgbMatch[4];
    if (alphaRaw !== undefined) {
      const alpha = alphaRaw.endsWith("%")
        ? parseFloat(alphaRaw.slice(0, -1)) / 100
        : parseFloat(alphaRaw);
      return compositeOverBg(r, g, b, alpha, bgHex);
    }
    return rgbToHex6(r, g, b);
  }

  return fallback;
}

function safeText(val: unknown, fallback = ""): string {
  const cleaned = safeString(val).replace(XML_ILLEGAL_CTRL_RE, "");
  return cleaned.length > 0
    ? cleaned
    : fallback.replace(XML_ILLEGAL_CTRL_RE, "");
}

function sanitizeBarNum(val: unknown): number {
  const n = safeNumber(val);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function sanitizeSteps(
  rawSteps: unknown,
  maxItems: number,
  fallback: { code: string; title: string; desc: string }[]
): { code: string; title: string; desc: string }[] {
  if (!Array.isArray(rawSteps)) return fallback.slice(0, maxItems);
  const cleaned = rawSteps
    .filter(isPlainObject)
    .slice(0, maxItems)
    .map((st, idx) => ({
      code: safeText(st.code, String(idx + 1).padStart(2, "0")),
      title: safeText(st.title, `要点 ${idx + 1}`),
      desc: safeText(st.desc, ""),
    }));
  return cleaned.length > 0 ? cleaned : fallback.slice(0, maxItems);
}

function sanitizeKpis(
  rawKpis: unknown,
  maxItems: number
): { label: string; value: string; note: string }[] {
  if (!Array.isArray(rawKpis)) return [];
  return rawKpis
    .filter(isPlainObject)
    .slice(0, maxItems)
    .map((k, idx) => ({
      label: safeText(k.label, `指标 ${idx + 1}`),
      value: safeText(k.value, "—"),
      note: safeText(k.note, ""),
    }));
}

function sanitizePoints(rawPoints: unknown, fallback: string[]): string[] {
  if (!Array.isArray(rawPoints)) return fallback;
  const cleaned = rawPoints
    .map((p) => safeText(p).trim())
    .filter(Boolean)
    .slice(0, 6);
  return cleaned.length > 0 ? cleaned : fallback;
}

function pickContrastText(hex6: string): string {
  const [r, g, b] = parseHexToRgb(hex6);
  return 0.299 * r + 0.587 * g + 0.114 * b > 180 ? "171615" : "FFFFFF";
}

function pptxDownload(bytes: Uint8Array<ArrayBuffer>, title: string) {
  const filename =
    title.replace(/[^\w\u4e00-\u9fa5\-]+/g, "-").slice(0, 40).replace(/^-|-$/g, "") ||
    "pptgod-deck";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": PPTX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="pptgod-deck.pptx"; filename*=UTF-8''${encodeURIComponent(filename)}.pptx`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const limited = await limitToolRequest(request, "export-pptx", 30);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isPlainObject(parsed)) {
      return NextResponse.json(
        { error: "请求体不是合法的 JSON 格式" },
        { status: 400 }
      );
    }
    body = parsed;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON 格式" },
      { status: 400 }
    );
  }

  try {
    let cacheKey: string | undefined;
    if (body.deckId !== undefined) {
      const deckId = safeString(body.deckId).trim();
      if (!deckId || deckId.length > 200) {
        return NextResponse.json({ error: "无效的演示文稿编号" }, { status: 400 });
      }
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

      const deck = await getSavedDeckById(deckId);
      if (!deck || deck.authorId !== user.id) {
        return NextResponse.json({ error: "未找到该演示文稿" }, { status: 404 });
      }
      body = {
        title: deck.title,
        subtitle: deck.subtitle,
        audience: deck.audience,
        styleName: deck.promptTitle,
        visualSpec: deck.visualSpec,
        slides: deck.slides,
      };
      cacheKey = savedPptxCacheKey(user.id, deckId, body);
      const cached = await readSavedPptx(cacheKey);
      if (cached) return pptxDownload(cached, deck.title);
    }

    const title = safeText(body.title).trim() || "PPTGod Presentation";
    const subtitle = safeText(body.subtitle).trim();
    const audience = safeText(body.audience).trim() || "核心团队";
    const styleName =
      safeText(body.styleName).trim() || "PPTGod Design System";
    const rawSpec = body.visualSpec;
    const rawSlides = body.slides;

    if (
      !isPlainObject(rawSpec) ||
      !isPlainObject(rawSpec.palette) ||
      !Array.isArray(rawSlides)
    ) {
      return NextResponse.json(
        { error: "缺少幻灯片内容或视觉参数" },
        { status: 400 }
      );
    }

    const slides = rawSlides
      .filter(isPlainObject)
      .slice(0, 50) as unknown as DeckSlideItem[];
    if (slides.length === 0) {
      return NextResponse.json(
        { error: "缺少幻灯片内容或视觉参数" },
        { status: 400 }
      );
    }

    const spec = rawSpec as unknown as VisualSpec;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 inches
    pptx.author = "PPTGod Visual Studio v3";
    pptx.company = "PPTGod";
    pptx.subject = styleName;
    pptx.title = title;

    const cBg = toHex6(spec.palette.bg, "F5F2EB", "FFFFFF");
    const cSurface = toHex6(spec.palette.surface, "FFFFFF", cBg);
    const cText = toHex6(spec.palette.text, "121212", cBg);
    const cMuted = toHex6(spec.palette.muted, "666666", cBg);
    const cAccent = toHex6(spec.palette.accent, "C84B31", cBg);
    const cAccentSoft = toHex6(spec.palette.accentSoft, cSurface, cBg);
    const cBorder = toHex6(spec.palette.border, "D6D3CD", cBg);
    const chartColors = Array.isArray(spec.palette.chartColors)
      ? spec.palette.chartColors
      : [];
    const cChart1 = toHex6(chartColors[0], cAccent, cSurface);
    const cChart2 = toHex6(chartColors[1], cText, cSurface);
    const cChart3 = toHex6(chartColors[2], cMuted, cSurface);
    const cChart4 = toHex6(chartColors[3], cBorder, cSurface);
    const cAccentText = pickContrastText(cAccent);

    const typoMood = isPlainObject(spec.typography)
      ? spec.typography.mood
      : undefined;
    const fontHeading =
      typoMood === "editorial" ||
      typoMood === "academic" ||
      typoMood === "chinese"
        ? "Songti SC"
        : "Microsoft YaHei";
    const fontBody = "Microsoft YaHei";

    const layoutObj = isPlainObject(spec.layout) ? spec.layout : undefined;
    const archetype =
      (typeof layoutObj?.archetype === "string"
        ? (layoutObj.archetype as LayoutArchetype)
        : "swiss-grid") || "swiss-grid";
    const motif =
      (typeof layoutObj?.decorativeMotif === "string"
        ? (layoutObj.decorativeMotif as DecorativeMotif)
        : "hairline-rule") || "hairline-rule";
    const cornerRadius = Number.isFinite(safeNumber(layoutObj?.cornerRadius))
      ? Math.max(0, Math.min(32, safeNumber(layoutObj?.cornerRadius)))
      : 0;

    const tokens: PptxThemeTokens = {
      cBg,
      cSurface,
      cText,
      cMuted,
      cAccent,
      cAccentSoft,
      cAccentText,
      cBorder,
      cChart1,
      cChart2,
      cChart3,
      cChart4,
      fontHeading,
      fontBody,
      cornerRadius,
      archetype,
      motif,
      isBrutalist: archetype === "brutalist-poster" || motif === "hard-offset",
      isBauhaus: archetype === "retro-bauhaus",
      isChinese: archetype === "neo-chinese",
      isSwiss: archetype === "swiss-grid",
      isKeynote: archetype === "keynote-center",
      isBento: archetype === "soft-bento",
      isBlueprint: archetype === "tech-blueprint",
      isEditorial:
        archetype === "editorial-asymmetric" || archetype === "luxury-minimal",
      isTerminal: archetype === "financial-terminal",
      isAcademic: archetype === "academic-paper",
      isChalkboard: archetype === "chalkboard-class",
      isScientific: archetype === "scientific-figure",
      isCivic: archetype === "civic-redgold",
      isPmo: archetype === "pmo-rag-grid",
      isPolaroid: archetype === "polaroid-zine",
      isRounded: cornerRadius >= 8,
    };

    type PptxSkeleton = "consulting" | "academic" | "keynote" | "classroom";
    const resolveSkeleton = (arch: LayoutArchetype): PptxSkeleton => {
      switch (arch) {
        case "consulting-mbb":
        case "swiss-grid":
        case "executive-emerald":
        case "financial-terminal":
        case "pmo-rag-grid":
          return "consulting";
        case "academic-paper":
        case "scientific-figure":
        case "clinical-clean":
          return "academic";
        case "keynote-center":
        case "soft-bento":
        case "luxury-minimal":
        case "editorial-asymmetric":
        case "tech-blueprint":
        case "brutalist-poster":
          return "keynote";
        default:
          return "classroom";
      }
    };
    const skeleton: PptxSkeleton = resolveSkeleton(archetype);

    const total = slides.length;

    // Register a real PowerPoint Slide Master
    pptx.defineSlideMaster({
      title: "PPTGOD_MASTER",
      background: { color: cBg },
      margin: [0.35, 0.55, 0.35, 0.55],
    });

    const addHeaderAndFooter = (
      slide: PptxGenJS.Slide,
      sectionTag: string | undefined,
      idx: number,
      sourceNote?: string
    ) => {
      const leftPad = tokens.isBauhaus ? 0.65 : 0.6;
      const barW = 9.4 - leftPad;
      const resolvedTag =
        safeText(sectionTag).trim() ||
        `${String(idx + 1).padStart(2, "0")} / SECTION`;

      if (skeleton === "consulting") {
        // Consulting MBB: crisp top kicker + right deck title + sharp category hairline
        slide.addShape(pptx.ShapeType.rect, {
          x: leftPad,
          y: 0.36,
          w: 0.18,
          h: 0.06,
          fill: { color: cAccent },
          line: { color: cAccent, width: 0 },
        });
        slide.addText(resolvedTag.toUpperCase(), {
          x: leftPad + 0.24,
          y: 0.28,
          w: 4.5,
          h: 0.24,
          fontSize: 8.5,
          bold: true,
          color: cAccent,
          fontFace: "Consolas",
        });
        slide.addText(title, {
          x: 5.4,
          y: 0.28,
          w: 4.0,
          h: 0.24,
          fontSize: 8.5,
          align: "right",
          color: cMuted,
          fontFace: fontBody,
        });
      } else if (skeleton === "academic") {
        // Academic Journal: understated serif running head + double/crisp top rule
        const cAcademicRule = cText === "FFFFFF" ? "E2E8F0" : cText;
        slide.addText(`${title}  ·  ${resolvedTag}`, {
          x: leftPad,
          y: 0.32,
          w: 6.8,
          h: 0.24,
          fontSize: 8.5,
          italic: true,
          color: cMuted,
          fontFace: fontHeading,
        });
        slide.addShape(pptx.ShapeType.line, {
          x: leftPad,
          y: 0.62,
          w: barW,
          h: 0,
          line: { color: cAcademicRule, width: 1.0 },
        });
      } else if (skeleton === "keynote") {
        // Keynote / Bento: floating soft pill eyebrow, zero top divider clutter
        slide.addShape(pptx.ShapeType.roundRect, {
          x: leftPad,
          y: 0.32,
          w: Math.min(2.2, Math.max(1.15, resolvedTag.length * 0.12 + 0.35)),
          h: 0.26,
          rectRadius: 0.12,
          fill: { color: cAccentSoft },
          line: { color: cBorder, width: 0.5 },
        });
        slide.addText(resolvedTag, {
          x: leftPad + 0.1,
          y: 0.32,
          w: Math.min(2.0, Math.max(0.95, resolvedTag.length * 0.12 + 0.15)),
          h: 0.26,
          fontSize: 8.5,
          bold: true,
          color: cAccent,
          valign: "middle",
          fontFace: "Consolas",
        });
      } else {
        // Classroom / Civic: solid colored module badge + clear top rule
        slide.addShape(pptx.ShapeType.roundRect, {
          x: leftPad,
          y: 0.32,
          w: 1.55,
          h: 0.27,
          rectRadius: 0.06,
          fill: { color: cAccent },
          line: { color: cAccent, width: 0 },
        });
        slide.addText(resolvedTag.slice(0, 14), {
          x: leftPad,
          y: 0.32,
          w: 1.55,
          h: 0.27,
          fontSize: 8.5,
          bold: true,
          align: "center",
          valign: "middle",
          color: cAccentText,
          fontFace: fontBody,
        });
        slide.addText(title, {
          x: 5.2,
          y: 0.34,
          w: 4.2,
          h: 0.24,
          fontSize: 9,
          align: "right",
          color: cMuted,
          fontFace: fontBody,
        });
        slide.addShape(pptx.ShapeType.line, {
          x: leftPad,
          y: 0.66,
          w: barW,
          h: 0,
          line: { color: cBorder, width: 0.75 },
        });
      }

      // Footer
      if (skeleton !== "keynote") {
        const cFootRule =
          skeleton === "academic"
            ? cText === "FFFFFF"
              ? "E2E8F0"
              : cText
            : cBorder;
        slide.addShape(pptx.ShapeType.line, {
          x: leftPad,
          y: 5.12,
          w: barW,
          h: 0,
          line: { color: cFootRule, width: 0.5 },
        });
      }
      const customBrandFooter =
        typeof layoutObj?.brandFooter === "string"
          ? layoutObj.brandFooter.replace(/[<>]/g, "").trim().slice(0, 60)
          : "";
      const footerBase = customBrandFooter || `${styleName} · ${audience}`;
      const cleanSource = safeText(sourceNote).trim().slice(0, 48);
      slide.addText(
        cleanSource ? `${footerBase}  |  来源：${cleanSource}` : footerBase,
        {
          x: leftPad,
          y: 5.18,
          w: 6.9,
          h: 0.25,
          fontSize: 8.5,
          color: cMuted,
          fontFace: fontBody,
        }
      );
      slide.addText(
        `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
        {
          x: 7.8,
          y: 5.18,
          w: 1.6,
          h: 0.25,
          fontSize: 8.5,
          bold: true,
          align: "right",
          color: cText,
          fontFace: "Consolas",
        }
      );
    };

    const addSlideHeading = (slide: PptxGenJS.Slide, headingText: string) => {
      if (skeleton === "consulting") {
        slide.addText(headingText, {
          x: 0.6,
          y: 0.62,
          w: 8.8,
          h: 0.64,
          fontSize: 19.5,
          bold: true,
          color: cText,
          fontFace: fontHeading,
          valign: "middle",
        });
        slide.addShape(pptx.ShapeType.line, {
          x: 0.6,
          y: 1.32,
          w: 8.8,
          h: 0,
          line: { color: cAccent, width: 1.25 },
        });
      } else if (skeleton === "academic") {
        slide.addText(headingText, {
          x: 0.6,
          y: 0.72,
          w: 8.8,
          h: 0.62,
          fontSize: 19,
          bold: true,
          color: cText,
          fontFace: fontHeading,
          valign: "middle",
        });
      } else if (skeleton === "keynote") {
        slide.addText(headingText, {
          x: 0.6,
          y: 0.68,
          w: 8.8,
          h: 0.68,
          fontSize: 22,
          bold: true,
          color: cText,
          fontFace: fontHeading,
          valign: "middle",
        });
      } else {
        slide.addText(headingText, {
          x: 0.6,
          y: 0.78,
          w: 8.8,
          h: 0.56,
          fontSize: 20,
          bold: true,
          color: cText,
          fontFace: fontHeading,
          valign: "middle",
        });
      }
    };

    const SOURCE_STATUS_ZH: Record<string, string> = {
      "source-material": "来自源材料",
      "derived-calc": "数据推算",
      placeholder: "模拟假设",
      "needs-verify": "待核验",
    };

    slides.forEach((item, idx) => {
      const slide = pptx.addSlide({ masterName: "PPTGOD_MASTER" });
      slide.background = { color: cBg };

      const noteLines: string[] = [];
      const baseNotes = safeText(item.speakerNotes).trim();
      if (baseNotes) noteLines.push(baseNotes);
      const aq = safeText(item.audienceQuestion).trim();
      if (aq) noteLines.push(`【听众问题】${aq}`);
      const stKey = typeof item.sourceStatus === "string" ? item.sourceStatus : "";
      const srcNote = safeText(item.sourceNote).trim();
      if (stKey && SOURCE_STATUS_ZH[stKey]) {
        noteLines.push(
          `【来源状态】${SOURCE_STATUS_ZH[stKey]}${srcNote ? ` — ${srcNote}` : ""}`
        );
      } else if (srcNote) {
        noteLines.push(`【来源说明】${srcNote}`);
      }
      if (noteLines.length > 0) {
        slide.addNotes(noteLines.join("\n"));
      }

      const isCover = item.slideType === "cover";
      addArchetypeMotif(pptx, slide, tokens, isCover);

      if (isCover) {
        renderArchetypeCover(pptx, slide, tokens, {
          sectionTag: safeText(item.sectionTag).trim() || "PRESENTATION",
          title: safeText(item.title).trim() || title,
          subtitle: safeText(item.subtitle).trim() || subtitle,
          audience,
          styleName,
          total,
        });
        return;
      }

      addHeaderAndFooter(
        slide,
        item.sectionTag,
        idx,
        typeof item.sourceNote === "string" ? item.sourceNote : undefined
      );

      addSlideHeading(slide, safeText(item.title).trim() || title);

      /* -------- 1. AGENDA (Skeleton-Aware) -------- */
      if (item.slideType === "agenda") {
        const steps = sanitizeSteps(item.steps, 4, DEFAULT_AGENDA_STEPS);
        if (skeleton === "consulting") {
          // Executive horizontal strip list with left accent bar
          const rowH = Math.min(0.72, 3.2 / Math.max(1, steps.length));
          steps.forEach((st, sIdx) => {
            const y = 1.56 + sIdx * (rowH + 0.12);
            addStyledCard(pptx, slide, tokens, {
              x: 0.6,
              y,
              w: 8.8,
              h: rowH,
              borderColor: sIdx === 0 ? cAccent : cBorder,
            });
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.6,
              y,
              w: 0.08,
              h: rowH,
              fill: { color: sIdx === 0 ? cAccent : cChart3 },
              line: { color: sIdx === 0 ? cAccent : cChart3, width: 0 },
            });
            slide.addText(st.code || String(sIdx + 1).padStart(2, "0"), {
              x: 0.82,
              y,
              w: 0.65,
              h: rowH,
              fontSize: 15,
              bold: true,
              valign: "middle",
              color: sIdx === 0 ? cAccent : cText,
              fontFace: "Consolas",
            });
            slide.addText(st.title, {
              x: 1.52,
              y,
              w: 2.8,
              h: rowH,
              fontSize: 13,
              bold: true,
              valign: "middle",
              color: cText,
              fontFace: fontHeading,
            });
            slide.addText(st.desc, {
              x: 4.45,
              y,
              w: 4.75,
              h: rowH,
              fontSize: 10.5,
              valign: "middle",
              color: cMuted,
              fontFace: fontBody,
            });
          });
        } else if (skeleton === "academic") {
          // Minimalist borderless academic outline with hairline separators
          steps.forEach((st, sIdx) => {
            const col = sIdx % 2;
            const row = Math.floor(sIdx / 2);
            const x = 0.6 + col * 4.55;
            const y = 1.66 + row * 1.56;
            slide.addText(`§ ${st.code || String(sIdx + 1).padStart(2, "0")}`, {
              x,
              y,
              w: 4.1,
              h: 0.28,
              fontSize: 10,
              bold: true,
              color: cAccent,
              fontFace: "Consolas",
            });
            slide.addText(st.title, {
              x,
              y: y + 0.3,
              w: 4.1,
              h: 0.38,
              fontSize: 14,
              bold: true,
              color: cText,
              fontFace: fontHeading,
            });
            slide.addShape(pptx.ShapeType.line, {
              x,
              y: y + 0.72,
              w: 4.1,
              h: 0,
              line: { color: cBorder, width: 0.75 },
            });
            slide.addText(st.desc, {
              x,
              y: y + 0.8,
              w: 4.1,
              h: 0.6,
              fontSize: 10.5,
              color: cMuted,
              fontFace: fontBody,
              valign: "top",
            });
          });
        } else {
          steps.forEach((st, sIdx) => {
            const col = sIdx % 2;
            const row = Math.floor(sIdx / 2);
            const x = 0.6 + col * 4.5;
            const y = 1.62 + row * 1.62;
            addStyledCard(pptx, slide, tokens, {
              x,
              y,
              w: 4.3,
              h: 1.42,
              borderColor: sIdx === 0 ? cAccent : cBorder,
            });
            slide.addText(st.code || String(sIdx + 1).padStart(2, "0"), {
              x: x + 0.2,
              y: y + 0.18,
              w: 0.7,
              h: 0.45,
              fontSize: 18,
              bold: true,
              color: sIdx === 0 ? cAccent : cText,
              fontFace: "Consolas",
            });
            slide.addText(st.title, {
              x: x + 0.95,
              y: y + 0.18,
              w: 3.15,
              h: 0.38,
              fontSize: 13.5,
              bold: true,
              color: cText,
              fontFace: fontHeading,
            });
            slide.addText(st.desc, {
              x: x + 0.95,
              y: y + 0.6,
              w: 3.15,
              h: 0.68,
              fontSize: 10.5,
              color: cMuted,
              fontFace: fontBody,
              valign: "top",
            });
          });
        }
        return;
      }

      /* -------- 2. PROCESS / CLOSING (Skeleton-Aware) -------- */
      if (item.slideType === "process" || item.slideType === "closing") {
        const steps = sanitizeSteps(item.steps, 3, DEFAULT_PROCESS_STEPS);
        steps.forEach((st, sIdx) => {
          const x = 0.6 + sIdx * 3.0;
          const y = 1.64;
          addStyledCard(pptx, slide, tokens, {
            x,
            y,
            w: 2.8,
            h: 3.14,
            borderColor: sIdx === 0 ? cAccent : cBorder,
          });
          if (skeleton === "consulting") {
            slide.addShape(pptx.ShapeType.rect, {
              x,
              y,
              w: 2.8,
              h: 0.08,
              fill: { color: sIdx === 0 ? cAccent : cChart3 },
              line: { color: sIdx === 0 ? cAccent : cChart3, width: 0 },
            });
          } else if (skeleton === "classroom") {
            slide.addShape(pptx.ShapeType.ellipse, {
              x: x + 0.2,
              y: y + 0.2,
              w: 0.42,
              h: 0.42,
              fill: { color: cAccent },
              line: { color: cAccent, width: 0 },
            });
          }
          slide.addText(st.code || String(sIdx + 1).padStart(2, "0"), {
            x: skeleton === "classroom" ? x + 0.2 : x + 0.22,
            y: skeleton === "classroom" ? y + 0.2 : y + 0.24,
            w: skeleton === "classroom" ? 0.42 : 2.36,
            h: skeleton === "classroom" ? 0.42 : 0.32,
            fontSize: 11,
            bold: true,
            align: skeleton === "classroom" ? "center" : "left",
            valign: "middle",
            color: skeleton === "classroom" ? cAccentText : cAccent,
            fontFace: "Consolas",
          });
          slide.addText(st.title, {
            x: x + 0.22,
            y: y + 0.72,
            w: 2.36,
            h: 0.55,
            fontSize: 14.5,
            bold: true,
            color: cText,
            fontFace: fontHeading,
          });
          slide.addText(st.desc, {
            x: x + 0.22,
            y: y + 1.34,
            w: 2.36,
            h: 1.5,
            fontSize: 11,
            color: cMuted,
            fontFace: fontBody,
            valign: "top",
          });
        });
        return;
      }

      /* -------- 3. IMAGE-SPLIT (Real Embedded Image OR Clean Dashed Placeholder OR Vector Preset) -------- */
      if (item.slideType === "image-split") {
        const slot: Record<string, unknown> = isPlainObject(item.imageSlot)
          ? item.imageSlot
          : {};
        const imgOnRight = slot.layout === "right";
        const imgX = imgOnRight ? 5.2 : 0.6;
        const textX = imgOnRight ? 0.6 : 5.0;
        const imgBox = { x: imgX, y: 1.52, w: 4.15, h: 3.1 };

        const dataUrl =
          slot.kind === "data-url" && isValidImageDataUrl(slot.dataUrl)
            ? String(slot.dataUrl).trim()
            : "";
        const isPlaceholderSlot = !dataUrl && slot.kind === "placeholder";

        if (dataUrl) {
          addStyledCard(pptx, slide, tokens, {
            ...imgBox,
            fill: cSurface,
            borderColor: cBorder,
          });
          slide.addImage({
            data: dataUrl,
            x: imgBox.x + 0.08,
            y: imgBox.y + 0.08,
            w: imgBox.w - 0.16,
            h: imgBox.h - 0.16,
            sizing: {
              type: "contain",
              w: imgBox.w - 0.16,
              h: imgBox.h - 0.16,
            },
          });
        } else if (isPlaceholderSlot) {
          // Clean, restrained dashed placeholder frame for direct screenshot/figure pasting in PowerPoint
          slide.addShape(
            tokens.isRounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
            {
              x: imgBox.x,
              y: imgBox.y,
              w: imgBox.w,
              h: imgBox.h,
              rectRadius: tokens.isRounded ? 0.08 : 0,
              fill: { color: cSurface },
              line: { color: cAccent, width: 1.25, dashType: "dash" },
            }
          );
          slide.addShape(pptx.ShapeType.roundRect, {
            x: imgBox.x + imgBox.w / 2 - 0.72,
            y: imgBox.y + 0.78,
            w: 1.44,
            h: 0.3,
            rectRadius: 0.12,
            fill: { color: cAccentSoft },
            line: { color: cBorder, width: 0.5 },
          });
          slide.addText("配图占位框", {
            x: imgBox.x + imgBox.w / 2 - 0.72,
            y: imgBox.y + 0.78,
            w: 1.44,
            h: 0.3,
            fontSize: 9.5,
            bold: true,
            align: "center",
            valign: "middle",
            color: cAccent,
            fontFace: fontBody,
          });
          const hintText =
            safeText(slot.promptHint).trim() ||
            "在此直接粘贴论文架构图、实验截图或核心业务配图";
          slide.addText(hintText.slice(0, 96), {
            x: imgBox.x + 0.32,
            y: imgBox.y + 1.22,
            w: imgBox.w - 0.64,
            h: 1.35,
            fontSize: 10.5,
            color: cMuted,
            align: "center",
            valign: "top",
            fontFace: fontBody,
          });
        } else {
          const presetId =
            safeText(slot.presetId).trim() ||
            pickDefaultArtworkForArchetype(archetype);
          drawNativeArtworkPreset(pptx, slide, tokens, presetId, imgBox);
        }

        const caption =
          safeText(slot.caption).trim() ||
          (isPlaceholderSlot ? "提示：在 PowerPoint 中可直接将截图粘贴至此虚线框位置" : "");
        if (caption) {
          slide.addText(caption, {
            x: imgBox.x,
            y: imgBox.y + imgBox.h + 0.08,
            w: imgBox.w,
            h: 0.26,
            fontSize: 9,
            color: cMuted,
            align: "center",
            fontFace: fontBody,
          });
        }

        const sub = safeText(item.subtitle).trim();
        let curY = 1.52;
        if (sub) {
          slide.addText(sub, {
            x: textX,
            y: curY,
            w: 4.4,
            h: 0.68,
            fontSize: 11.5,
            color: cMuted,
            fontFace: fontBody,
            valign: "top",
          });
          curY += 0.78;
        }

        const bullets = sanitizePoints(item.bullets, [
          "直观展示核心产品架构与体验焦点，大幅降低受众理解成本",
          "视觉主图与结构化要点 5:5 黄金平衡，兼具美感与说服力",
          "支持本地图片高清内嵌与风格自适应原生矢量插画切换",
        ]).slice(0, 4);

        const cardH = Math.min(0.86, (4.88 - curY) / Math.max(1, bullets.length) - 0.12);
        bullets.forEach((pt, bIdx) => {
          const by = curY + bIdx * (cardH + 0.12);
          addStyledCard(pptx, slide, tokens, {
            x: textX,
            y: by,
            w: 4.4,
            h: Math.max(0.58, cardH),
            borderColor: bIdx === 0 ? cAccent : cBorder,
          });
          slide.addText(String(bIdx + 1).padStart(2, "0"), {
            x: textX + 0.14,
            y: by + 0.12,
            w: 0.36,
            h: 0.32,
            fontSize: 11,
            bold: true,
            color: cAccent,
            fontFace: "Consolas",
          });
          slide.addText(pt, {
            x: textX + 0.56,
            y: by + 0.1,
            w: 3.7,
            h: Math.max(0.42, cardH - 0.16),
            fontSize: 10.5,
            color: cText,
            fontFace: fontBody,
            valign: "middle",
          });
        });
        return;
      }

      /* -------- 4. SWOT MATRIX (NEW v3: 2x2 Quadrant Cards) -------- */
      if (item.slideType === "swot") {
        const swotObj: Record<string, unknown> = isPlainObject(item.swot)
          ? item.swot
          : {};
        const quadrants = [
          {
            code: "S",
            label: "STRENGTHS · 核心优势",
            points: sanitizePoints(swotObj.strengths, ["核心架构与效率领先"]),
            color: cChart1,
          },
          {
            code: "W",
            label: "WEAKNESSES · 短板待补",
            points: sanitizePoints(swotObj.weaknesses, ["区域渠道覆盖爬坡中"]),
            color: cChart3,
          },
          {
            code: "O",
            label: "OPPORTUNITIES · 外部机遇",
            points: sanitizePoints(swotObj.opportunities, ["行业数字化预算向高 ROI 集中"]),
            color: cChart2,
          },
          {
            code: "T",
            label: "THREATS · 外部挑战",
            points: sanitizePoints(swotObj.threats, ["通用大厂同质化价格竞争"]),
            color: cMuted,
          },
        ];

        quadrants.forEach((q, qIdx) => {
          const col = qIdx % 2;
          const row = Math.floor(qIdx / 2);
          const x = 0.6 + col * 4.52;
          const y = 1.5 + row * 1.72;
          addStyledCard(pptx, slide, tokens, {
            x,
            y,
            w: 4.28,
            h: 1.56,
            borderColor: qIdx === 0 ? cAccent : cBorder,
          });
          // Monogram badge
          slide.addShape(
            tokens.isRounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
            {
              x: x + 0.18,
              y: y + 0.18,
              w: 0.36,
              h: 0.36,
              rectRadius: tokens.isRounded ? 0.08 : 0,
              fill: { color: q.color },
              line: { color: q.color, width: 0 },
            }
          );
          slide.addText(q.code, {
            x: x + 0.18,
            y: y + 0.18,
            w: 0.36,
            h: 0.36,
            fontSize: 13,
            bold: true,
            align: "center",
            valign: "middle",
            color: pickContrastText(q.color),
            fontFace: "Consolas",
          });
          slide.addText(q.label, {
            x: x + 0.64,
            y: y + 0.2,
            w: 3.45,
            h: 0.32,
            fontSize: 11,
            bold: true,
            color: qIdx === 0 ? cAccent : cText,
            fontFace: fontHeading,
          });
          slide.addText(
            q.points
              .slice(0, 3)
              .map((pt) => `•  ${pt}`)
              .join("\n"),
            {
              x: x + 0.22,
              y: y + 0.62,
              w: 3.88,
              h: 0.84,
              fontSize: 10,
              color: cMuted,
              fontFace: fontBody,
              valign: "top",
            }
          );
        });
        return;
      }

      /* -------- 5. FUNNEL / DONUT (NEW v3: Native Doughnut Chart + Stepped Funnel) -------- */
      if (item.slideType === "funnel-donut") {
        const rawStages = Array.isArray(item.funnelStages)
          ? item.funnelStages.filter(isPlainObject).slice(0, 6).map((st, sIdx) => ({
              label: safeText(st.label, `阶段 ${sIdx + 1}`),
              value: Math.max(1, sanitizeBarNum(st.value) || 10),
              unit: safeText(st.unit, ""),
              note: safeText(st.note, ""),
            }))
          : [];
        const stages = rawStages.length > 0 ? rawStages : DEFAULT_FUNNEL_STAGES;
        const chartMode = item.chartMode === "donut" ? "donut" : "funnel";
        const palette4 = [cChart1, cChart2, cChart3, cChart4];

        // Left visual container
        addStyledCard(pptx, slide, tokens, {
          x: 0.6,
          y: 1.52,
          w: 4.95,
          h: 3.38,
          borderColor: cBorder,
        });

        if (chartMode === "donut") {
          slide.addChart(
            pptx.ChartType.doughnut,
            [
              {
                name: "占比分布",
                labels: stages.map((st) => st.label),
                values: stages.map((st) => st.value),
              },
            ],
            {
              x: 0.85,
              y: 1.66,
              w: 4.45,
              h: 3.1,
              holeSize: 55,
              chartColors: stages.map((_, i) => palette4[i % palette4.length]),
              showLegend: true,
              legendPos: "b",
              legendColor: cMuted,
              legendFontSize: 8.5,
              showPercent: true,
              dataLabelColor: cText,
              dataLabelFontSize: 9,
            }
          );
        } else {
          const maxVal = Math.max(1, ...stages.map((st) => st.value));
          const stepCount = stages.length;
          const barH = Math.min(0.58, 2.75 / stepCount - 0.1);
          stages.forEach((st, sIdx) => {
            const ratio = Math.max(0.32, st.value / maxVal);
            const bw = 4.2 * ratio;
            const bx = 0.6 + (4.95 - bw) / 2;
            const by = 1.76 + sIdx * (barH + 0.14);
            const col = palette4[sIdx % palette4.length];
            slide.addShape(
              tokens.isRounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
              {
                x: bx,
                y: by,
                w: bw,
                h: barH,
                rectRadius: tokens.isRounded ? 0.08 : 0,
                fill: { color: col },
                line: { color: col, width: 0 },
              }
            );
            slide.addText(
              `${st.label}  ·  ${st.value.toLocaleString()}${st.unit}`,
              {
                x: bx + 0.08,
                y: by,
                w: bw - 0.16,
                h: barH,
                fontSize: 10.5,
                bold: true,
                align: "center",
                valign: "middle",
                color: pickContrastText(col),
                fontFace: fontBody,
              }
            );
          });
        }

        // Right breakdown cards
        const rightCount = Math.min(4, stages.length);
        const cardH = Math.min(0.76, (3.38 - (rightCount - 1) * 0.1) / rightCount);
        stages.slice(0, rightCount).forEach((st, sIdx) => {
          const ry = 1.52 + sIdx * (cardH + 0.1);
          const col = palette4[sIdx % palette4.length];
          addStyledCard(pptx, slide, tokens, {
            x: 5.75,
            y: ry,
            w: 3.65,
            h: cardH,
            borderColor: sIdx === 0 ? cAccent : cBorder,
          });
          slide.addShape(pptx.ShapeType.rect, {
            x: 5.75,
            y: ry,
            w: 0.08,
            h: cardH,
            fill: { color: col },
            line: { color: col, width: 0 },
          });
          slide.addText(st.label, {
            x: 5.95,
            y: ry + 0.08,
            w: 2.15,
            h: 0.28,
            fontSize: 11,
            bold: true,
            color: cText,
            fontFace: fontHeading,
          });
          slide.addText(`${st.value.toLocaleString()}${st.unit}`, {
            x: 8.1,
            y: ry + 0.08,
            w: 1.18,
            h: 0.28,
            fontSize: 12,
            bold: true,
            align: "right",
            color: sIdx === 0 ? cAccent : cText,
            fontFace: "Consolas",
          });
          if (st.note) {
            slide.addText(st.note, {
              x: 5.95,
              y: ry + 0.38,
              w: 3.3,
              h: 0.3,
              fontSize: 9,
              color: cMuted,
              fontFace: fontBody,
            });
          }
        });
        return;
      }

      /* -------- 6. TEAM GRID (NEW v3: 3-4 Member Cards) -------- */
      if (item.slideType === "team-grid") {
        const rawMembers = Array.isArray(item.teamMembers)
          ? item.teamMembers.filter(isPlainObject).slice(0, 4).map((m, mIdx) => ({
              name: safeText(m.name, `成员 ${mIdx + 1}`),
              role: safeText(m.role, "核心负责人"),
              bio: safeText(m.bio, ""),
              badge: safeText(m.badge, ""),
            }))
          : [];
        const members = rawMembers.length > 0 ? rawMembers : DEFAULT_TEAM_MEMBERS;
        const count = members.length;
        const gap = 0.2;
        const cardW = (8.8 - gap * (count - 1)) / count;
        const palette4 = [cChart1, cChart2, cChart3, cChart4];

        members.forEach((m, mIdx) => {
          const x = 0.6 + mIdx * (cardW + gap);
          const y = 1.62;
          const col = palette4[mIdx % palette4.length];
          addStyledCard(pptx, slide, tokens, {
            x,
            y,
            w: cardW,
            h: 3.22,
            borderColor: mIdx === 0 ? cAccent : cBorder,
          });
          // Circular avatar monogram
          slide.addShape(pptx.ShapeType.ellipse, {
            x: x + cardW / 2 - 0.34,
            y: y + 0.24,
            w: 0.68,
            h: 0.68,
            fill: { color: col },
            line: { color: cSurface, width: 1.5 },
          });
          slide.addText(m.name.slice(0, 1) || "T", {
            x: x + cardW / 2 - 0.34,
            y: y + 0.24,
            w: 0.68,
            h: 0.68,
            fontSize: 18,
            bold: true,
            align: "center",
            valign: "middle",
            color: pickContrastText(col),
            fontFace: fontHeading,
          });
          slide.addText(m.name, {
            x: x + 0.14,
            y: y + 1.05,
            w: cardW - 0.28,
            h: 0.34,
            fontSize: 14,
            bold: true,
            align: "center",
            color: cText,
            fontFace: fontHeading,
          });
          slide.addText(m.role, {
            x: x + 0.12,
            y: y + 1.4,
            w: cardW - 0.24,
            h: 0.38,
            fontSize: 9.5,
            bold: true,
            align: "center",
            color: cAccent,
            fontFace: fontBody,
          });
          slide.addShape(pptx.ShapeType.line, {
            x: x + 0.24,
            y: y + 1.84,
            w: cardW - 0.48,
            h: 0,
            line: { color: cBorder, width: 0.6 },
          });
          slide.addText(m.bio, {
            x: x + 0.16,
            y: y + 1.96,
            w: cardW - 0.32,
            h: 1.12,
            fontSize: 9.5,
            color: cMuted,
            align: "left",
            valign: "top",
            fontFace: fontBody,
          });
        });
        return;
      }

      /* -------- 7. TIMELINE -------- */
      if (item.slideType === "timeline") {
        const steps = sanitizeSteps(item.steps, 4, DEFAULT_TIMELINE_STEPS);
        slide.addShape(pptx.ShapeType.line, {
          x: 0.8,
          y: 2.15,
          w: 8.4,
          h: 0,
          line: { color: cAccent, width: 1.75 },
        });
        steps.forEach((st, sIdx) => {
          const x = 0.6 + sIdx * 2.25;
          slide.addShape(pptx.ShapeType.ellipse, {
            x: x + 0.9,
            y: 2.04,
            w: 0.22,
            h: 0.22,
            fill: { color: cAccent },
            line: { color: cSurface, width: 1.5 },
          });
          addStyledCard(pptx, slide, tokens, {
            x,
            y: 2.45,
            w: 2.08,
            h: 2.35,
            borderColor: sIdx === 0 ? cAccent : cBorder,
          });
          slide.addText(st.code || `PHASE ${sIdx + 1}`, {
            x: x + 0.14,
            y: 2.6,
            w: 1.8,
            h: 0.28,
            fontSize: 9.5,
            bold: true,
            color: cAccent,
            fontFace: "Consolas",
          });
          slide.addText(st.title, {
            x: x + 0.14,
            y: 2.94,
            w: 1.8,
            h: 0.45,
            fontSize: 12.5,
            bold: true,
            color: cText,
            fontFace: fontHeading,
          });
          slide.addText(st.desc, {
            x: x + 0.14,
            y: 3.45,
            w: 1.8,
            h: 1.2,
            fontSize: 10,
            color: cMuted,
            fontFace: fontBody,
            valign: "top",
          });
        });
        return;
      }

      /* -------- 8. QUOTE (Skeleton-Aware) -------- */
      if (item.slideType === "quote") {
        const quoteStr = `“${safeText(item.quoteText).trim() || safeText(item.title).trim() || title}”`;
        const authorStr = `— ${safeText(item.quoteAuthor).trim() || audience}`;

        if (skeleton === "keynote") {
          slide.addText("“", {
            x: 0.6,
            y: 1.4,
            w: 1.2,
            h: 0.9,
            fontSize: 54,
            bold: true,
            color: cAccent,
            fontFace: fontHeading,
          });
          slide.addText(quoteStr.replace(/^[“"]|[”"]$/g, ""), {
            x: 0.85,
            y: 1.88,
            w: 8.3,
            h: 1.4,
            fontSize: 21,
            bold: true,
            color: cText,
            fontFace: fontHeading,
            valign: "middle",
          });
          slide.addText(authorStr, {
            x: 0.85,
            y: 3.32,
            w: 8.3,
            h: 0.34,
            fontSize: 11,
            color: cMuted,
            fontFace: fontBody,
          });
        } else {
          addStyledCard(pptx, slide, tokens, {
            x: 0.6,
            y: 1.55,
            w: 8.8,
            h: 2.15,
            borderColor: cAccent,
            borderWidth: 1.5,
          });
          slide.addText(quoteStr, {
            x: 0.95,
            y: 1.78,
            w: 8.1,
            h: 1.25,
            fontSize: 18,
            bold: true,
            color: cText,
            fontFace: fontHeading,
            valign: "middle",
          });
          slide.addText(authorStr, {
            x: 0.95,
            y: 3.12,
            w: 8.1,
            h: 0.36,
            fontSize: 10.5,
            color: cMuted,
            fontFace: fontBody,
          });
        }

        const kpis = sanitizeKpis(item.kpis, 3);
        kpis.forEach((k, kIdx) => {
          const x = 0.6 + kIdx * 3.0;
          addStyledCard(pptx, slide, tokens, {
            x,
            y: 3.9,
            w: 2.8,
            h: 0.98,
            borderColor: cBorder,
          });
          slide.addText(k.value, {
            x: x + 0.18,
            y: 3.98,
            w: 1.25,
            h: 0.78,
            fontSize: 18,
            bold: true,
            color: cAccent,
            valign: "middle",
          });
          slide.addText(k.label, {
            x: x + 1.42,
            y: 3.98,
            w: 1.25,
            h: 0.78,
            fontSize: 9.5,
            color: cMuted,
            valign: "middle",
          });
        });
        return;
      }

      /* -------- 9. COMPARISON (Native Editable PowerPoint Table) -------- */
      if (item.slideType === "comparison") {
        const leftHeading = safeText(item.leftTitle).trim() || "传统方案";
        const rightHeading = safeText(item.rightTitle).trim() || "升级方案（推荐）";
        const leftPoints = sanitizePoints(item.leftPoints, [
          "流程分散依赖人工经验，协作对齐成本较高",
        ]);
        const rightPoints = sanitizePoints(item.rightPoints, [
          "标准化端到端闭环交付，指标透明可控",
        ]);
        const rowCount = Math.max(leftPoints.length, rightPoints.length, 1);
        const cRuleInk = cText === "FFFFFF" ? "E2E8F0" : cText;
        const noBdr: PptxGenJS.BorderProps = { type: "none" };
        const isAcadCmp = skeleton === "academic";

        const headBorders: [
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
        ] | undefined = isAcadCmp
          ? [
              { type: "solid", pt: 1.5, color: cRuleInk },
              noBdr,
              { type: "solid", pt: 0.85, color: cRuleInk },
              noBdr,
            ]
          : undefined;

        const tableRows: PptxGenJS.TableRow[] = [
          [
            {
              text: "#",
              options: {
                bold: true,
                color: cMuted,
                fill: { color: isAcadCmp ? cBg : cSurface },
                align: "center",
                fontFace: "Consolas",
                fontSize: 10,
                ...(headBorders ? { border: headBorders } : {}),
              },
            },
            {
              text: leftHeading,
              options: {
                bold: true,
                color: cText,
                fill: { color: isAcadCmp ? cBg : cSurface },
                fontFace: fontHeading,
                fontSize: 12,
                ...(headBorders ? { border: headBorders } : {}),
              },
            },
            {
              text: rightHeading,
              options: {
                bold: true,
                color: isAcadCmp ? cAccent : cAccentText,
                fill: { color: isAcadCmp ? cBg : cAccent },
                fontFace: fontHeading,
                fontSize: 12,
                ...(headBorders ? { border: headBorders } : {}),
              },
            },
          ],
        ];

        for (let r = 0; r < rowCount; r += 1) {
          const isAlt = r % 2 === 1;
          const isLast = r === rowCount - 1;
          const rowFill = isAcadCmp ? cBg : isAlt ? cBg : cSurface;
          const rowBorders: [
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
          ] | undefined = isAcadCmp
            ? [
                noBdr,
                noBdr,
                isLast ? { type: "solid", pt: 1.5, color: cRuleInk } : noBdr,
                noBdr,
              ]
            : undefined;

          tableRows.push([
            {
              text: String(r + 1).padStart(2, "0"),
              options: {
                bold: true,
                color: cAccent,
                fill: { color: rowFill },
                align: "center",
                valign: "middle",
                fontFace: "Consolas",
                fontSize: 10,
                ...(rowBorders ? { border: rowBorders } : {}),
              },
            },
            {
              text: leftPoints[r] || "—",
              options: {
                color: cMuted,
                fill: { color: rowFill },
                valign: "middle",
                fontFace: fontBody,
                fontSize: 10.5,
                ...(rowBorders ? { border: rowBorders } : {}),
              },
            },
            {
              text: rightPoints[r] ? `✓  ${rightPoints[r]}` : "—",
              options: {
                color: cText,
                bold: r === 0,
                fill: { color: isAcadCmp ? cBg : isAlt ? cAccentSoft : cSurface },
                valign: "middle",
                fontFace: fontBody,
                fontSize: 10.5,
                ...(rowBorders ? { border: rowBorders } : {}),
              },
            },
          ]);
        }

        slide.addTable(tableRows, {
          x: 0.6,
          y: 1.56,
          w: 8.8,
          colW: [0.65, 4.0, 4.15],
          rowH: Math.min(0.86, 3.3 / (rowCount + 1)),
          ...(isAcadCmp ? {} : { border: { pt: 0.75, color: cBorder } }),
          margin: [0.08, 0.12, 0.08, 0.12],
        });
        return;
      }

      /* -------- 10. DATA: Hero KPIs / Academic 3-Line Table / 4 Native Chart Variants -------- */
      const displayMode: DataDisplayMode =
        item.dataDisplay === "bar" ||
        item.dataDisplay === "line" ||
        item.dataDisplay === "doughnut" ||
        item.dataDisplay === "kpi-only" ||
        item.dataDisplay === "data-matrix"
          ? item.dataDisplay
          : "col";

      const rawBars = Array.isArray(item.bars)
        ? item.bars.filter(isPlainObject).map((b, bIdx) => ({
            label: safeText(b.label).trim() || `项 ${bIdx + 1}`,
            v1: sanitizeBarNum(b.v1),
            v2: sanitizeBarNum(b.v2),
          }))
        : [];
      const bars = rawBars.length > 0 ? rawBars : DEFAULT_BARS;
      const isSingleSeries = Boolean(item.singleSeries) && rawBars.length > 0;
      const kpis = sanitizeKpis(item.kpis, 3);
      const palette4 = [cChart1, cChart2, cChart3, cChart4];

      const hasMultiSeries =
        Array.isArray(item.chartCategories) &&
        item.chartCategories.length > 0 &&
        Array.isArray(item.chartSeries) &&
        item.chartSeries.length > 0;

      const resolvedCategories: string[] = hasMultiSeries
        ? item.chartCategories!.slice(0, 16).map((c, cIdx) => safeText(c, `项 ${cIdx + 1}`))
        : bars.map((b) => b.label);

      const resolvedSeries: { name: string; labels: string[]; values: number[]; unit: string }[] =
        hasMultiSeries
          ? item.chartSeries!
              .filter(isPlainObject)
              .slice(0, 4)
              .map((ser, sIdx) => ({
                name: safeText(ser.name, `序列 ${sIdx + 1}`),
                labels: resolvedCategories,
                values: resolvedCategories.map((_, idx) =>
                  Array.isArray(ser.values) ? sanitizeBarNum(ser.values[idx]) : 0
                ),
                unit: safeText(ser.unit, ""),
              }))
          : isSingleSeries
            ? [
                {
                  name: "核心指标",
                  labels: bars.map((b) => b.label),
                  values: bars.map((b) => b.v2),
                  unit: "",
                },
              ]
            : [
                {
                  name: "基准方案",
                  labels: bars.map((b) => b.label),
                  values: bars.map((b) => b.v1),
                  unit: "",
                },
                {
                  name: "升级方案",
                  labels: bars.map((b) => b.label),
                  values: bars.map((b) => b.v2),
                  unit: "",
                },
              ];

      /* 10A. Pure Hero KPI Showcase (`big-number` / `kpi-only`) — ZERO forced chart */
      if (displayMode === "kpi-only") {
        const heroKpis =
          kpis.length > 0
            ? kpis
            : [
                { label: "核心关键指标", value: "+151%", note: "基于源资料自动提取的实证焦点" },
              ];
        const kCount = heroKpis.length;
        const extraBullets = sanitizePoints(item.bullets, []).slice(0, 3);
        const gap = 0.22;
        const cardW = (8.8 - gap * (kCount - 1)) / kCount;
        const cardH = extraBullets.length > 0 ? 2.25 : 3.15;
        const valFontSize = kCount === 1 ? 48 : kCount === 2 ? 38 : 30;

        heroKpis.forEach((kpi, kIdx) => {
          const x = 0.6 + kIdx * (cardW + gap);
          const y = 1.54;
          addStyledCard(pptx, slide, tokens, {
            x,
            y,
            w: cardW,
            h: cardH,
            fill: kIdx === 0 ? cAccentSoft : cSurface,
            borderColor: kIdx === 0 ? cAccent : cBorder,
            borderWidth: kIdx === 0 ? 1.5 : 1,
          });
          slide.addText(kpi.label, {
            x: x + 0.24,
            y: y + 0.2,
            w: cardW - 0.48,
            h: 0.3,
            fontSize: 10.5,
            bold: true,
            color: kIdx === 0 ? cAccent : cMuted,
            fontFace: fontBody,
          });
          slide.addText(kpi.value, {
            x: x + 0.24,
            y: y + 0.56,
            w: cardW - 0.48,
            h: cardH - 1.25,
            fontSize: valFontSize,
            bold: true,
            valign: "middle",
            color: kIdx === 0 ? cAccent : cText,
            fontFace: fontHeading,
          });
          slide.addShape(pptx.ShapeType.line, {
            x: x + 0.24,
            y: y + cardH - 0.62,
            w: cardW - 0.48,
            h: 0,
            line: { color: cBorder, width: 0.6 },
          });
          slide.addText(kpi.note || "源资料核心量化事实", {
            x: x + 0.24,
            y: y + cardH - 0.54,
            w: cardW - 0.48,
            h: 0.44,
            fontSize: 9.5,
            color: cMuted,
            valign: "top",
            fontFace: fontBody,
          });
        });

        if (extraBullets.length > 0) {
          const bCount = extraBullets.length;
          const bGap = 0.18;
          const bW = (8.8 - bGap * (bCount - 1)) / bCount;
          extraBullets.forEach((pt, bIdx) => {
            const bx = 0.6 + bIdx * (bW + bGap);
            const by = 3.96;
            addStyledCard(pptx, slide, tokens, {
              x: bx,
              y: by,
              w: bW,
              h: 0.9,
              borderColor: cBorder,
            });
            slide.addText(pt, {
              x: bx + 0.16,
              y: by + 0.08,
              w: bW - 0.32,
              h: 0.74,
              fontSize: 9.5,
              color: cText,
              valign: "middle",
              fontFace: fontBody,
            });
          });
        }
        return;
      }

      /* 10B. Native Editable Data Table (`table` / `data-matrix` — Academic 3-Line or Executive Scorecard) */
      if (displayMode === "data-matrix") {
        const rawTd = isPlainObject(item.tableData) ? item.tableData : null;
        const tdHeaders =
          rawTd && Array.isArray(rawTd.headers) && rawTd.headers.length > 0
            ? rawTd.headers.slice(0, 10).map((h, i) => safeText(h, `列 ${i + 1}`))
            : ["指标维度", ...resolvedSeries.map((s) => s.name)];
        const tdRowsRaw: string[][] =
          rawTd && Array.isArray(rawTd.rows) && rawTd.rows.length > 0
            ? rawTd.rows
                .filter(Array.isArray)
                .slice(0, 16)
                .map((r) => tdHeaders.map((_, cIdx) => safeText(r[cIdx], "—")))
            : resolvedCategories.slice(0, 12).map((cat, rIdx) => [
                cat,
                ...resolvedSeries.map((s) => `${s.values[rIdx] ?? 0}${s.unit}`),
              ]);
        const tdRows = tdRowsRaw.length > 0 ? tdRowsRaw : [["样本 1", "—"]];
        const hlCoords = new Set<string>(
          rawTd && Array.isArray(rawTd.highlightCoords)
            ? rawTd.highlightCoords
                .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2)
                .map(([r, c]) => `${r}:${c}`)
            : []
        );

        const colCount = Math.max(1, tdHeaders.length);
        const firstColW = colCount <= 2 ? 3.8 : colCount <= 4 ? 2.6 : 2.0;
        const restColW = colCount > 1 ? (8.8 - firstColW) / (colCount - 1) : 8.8;
        const colW = tdHeaders.map((_, cIdx) => (cIdx === 0 ? firstColW : restColW));

        const totalTableRows = tdRows.length + 1;
        const fontSize = totalTableRows <= 7 ? 10 : totalTableRows <= 11 ? 9 : 8;
        const rowH = Math.min(0.42, 3.35 / totalTableRows);
        const isAcadTbl = skeleton === "academic";
        const cRuleInk = cText === "FFFFFF" ? "E2E8F0" : cText;
        const noBdr: PptxGenJS.BorderProps = { type: "none" };

        const headBorders: [
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
          PptxGenJS.BorderProps,
        ] = isAcadTbl
          ? [
              { type: "solid", pt: 1.5, color: cRuleInk },
              noBdr,
              { type: "solid", pt: 0.85, color: cRuleInk },
              noBdr,
            ]
          : [
              { type: "solid", pt: 1.0, color: cBorder },
              noBdr,
              { type: "solid", pt: 1.25, color: cAccent },
              noBdr,
            ];

        const matrixRows: PptxGenJS.TableRow[] = [
          tdHeaders.map((h, cIdx) => ({
            text: h,
            options: {
              bold: true,
              color: cText,
              fill: { color: isAcadTbl ? cBg : cAccentSoft },
              align: cIdx === 0 ? ("left" as const) : ("right" as const),
              valign: "middle" as const,
              fontFace: cIdx === 0 ? fontHeading : "Consolas",
              fontSize,
              border: headBorders,
            },
          })),
        ];

        tdRows.forEach((row, rIdx) => {
          const isLast = rIdx === tdRows.length - 1;
          const isAlt = rIdx % 2 === 1;
          const rowBorders: [
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
            PptxGenJS.BorderProps,
          ] = isAcadTbl
            ? [
                noBdr,
                noBdr,
                isLast ? { type: "solid", pt: 1.5, color: cRuleInk } : noBdr,
                noBdr,
              ]
            : [
                noBdr,
                noBdr,
                { type: "solid", pt: 0.5, color: cBorder },
                noBdr,
              ];

          matrixRows.push(
            tdHeaders.map((_, cIdx) => {
              const isOptimal = hlCoords.has(`${rIdx}:${cIdx}`);
              const baseFill = isAcadTbl ? cBg : isAlt ? cBg : cSurface;
              return {
                text: row[cIdx] || "—",
                options: {
                  bold: isOptimal || cIdx === 0,
                  color: isOptimal ? cAccent : cText,
                  fill: { color: isOptimal && !isAcadTbl ? cAccentSoft : baseFill },
                  align: cIdx === 0 ? ("left" as const) : ("right" as const),
                  valign: "middle" as const,
                  fontFace: cIdx === 0 ? fontBody : "Consolas",
                  fontSize,
                  border: rowBorders,
                },
              };
            })
          );
        });

        slide.addTable(matrixRows, {
          x: 0.6,
          y: 1.54,
          w: 8.8,
          colW,
          rowH,
          margin: [0.05, 0.1, 0.05, 0.1],
        });
        return;
      }

      /* 10C. Native Editable Charts (`col` | `bar` | `line` | `doughnut`) + 3 KPI Callouts */
      addStyledCard(pptx, slide, tokens, {
        x: 0.6,
        y: 1.55,
        w: 5.3,
        h: 3.35,
        borderColor: cBorder,
      });

      const chartPayload = resolvedSeries.map((s) => ({
        name: s.name,
        labels: s.labels,
        values: s.values,
      }));
      const sCount = chartPayload.length;
      const resolvedChartColors =
        !hasMultiSeries && sCount === 2
          ? [cChart3, cChart1]
          : chartPayload.map((_, sIdx) => palette4[sIdx % palette4.length]);

      if (displayMode === "doughnut") {
        const dnSeries = chartPayload[0] || {
          name: "占比分布",
          labels: ["核心项"],
          values: [100],
        };
        slide.addChart(
          pptx.ChartType.doughnut,
          [
            {
              name: dnSeries.name,
              labels: dnSeries.labels,
              values: dnSeries.values.map((v) => (v > 0 ? v : 1)),
            },
          ],
          {
            x: 0.78,
            y: 1.66,
            w: 4.94,
            h: 3.1,
            holeSize: 55,
            chartColors: dnSeries.labels.map((_, i) => palette4[i % palette4.length]),
            showLegend: true,
            legendPos: "b",
            legendColor: cMuted,
            legendFontSize: 8.5,
            showPercent: true,
            dataLabelColor: cText,
            dataLabelFontSize: 9,
          }
        );
      } else if (displayMode === "line") {
        slide.addChart(pptx.ChartType.line, chartPayload, {
          x: 0.75,
          y: 1.7,
          w: 5.0,
          h: 3.05,
          lineSize: 2.5,
          lineDataSymbol: "circle",
          lineDataSymbolSize: 6,
          chartColors: resolvedChartColors,
          showLegend: sCount > 1,
          legendPos: "t",
          legendColor: cMuted,
          legendFontSize: 9,
          catAxisLabelColor: cMuted,
          catAxisLabelFontSize: 9,
          valAxisLabelColor: cMuted,
          valAxisLabelFontSize: 8.5,
          showValue: sCount <= 2,
          dataLabelColor: cText,
          dataLabelFontSize: 8.5,
        });
      } else {
        slide.addChart(pptx.ChartType.bar, chartPayload, {
          x: 0.75,
          y: 1.7,
          w: 5.0,
          h: 3.05,
          barDir: displayMode === "bar" ? "bar" : "col",
          chartColors: resolvedChartColors,
          showLegend: sCount > 1,
          legendPos: "t",
          legendColor: cMuted,
          legendFontSize: 9,
          catAxisLabelColor: cMuted,
          catAxisLabelFontSize: 9,
          valAxisLabelColor: cMuted,
          valAxisLabelFontSize: 8.5,
          showValue: sCount <= 2,
          dataLabelColor: cText,
          dataLabelFontSize: 8.5,
        });
      }

      kpis.forEach((kpi, kIdx) => {
        const y = 1.55 + kIdx * 1.15;
        addStyledCard(pptx, slide, tokens, {
          x: 6.1,
          y,
          w: 3.3,
          h: 1.02,
          borderColor: kIdx === 0 ? cAccent : cBorder,
        });
        slide.addText(kpi.label, {
          x: 6.28,
          y: y + 0.08,
          w: 2.95,
          h: 0.22,
          fontSize: 9,
          color: cMuted,
          fontFace: fontBody,
        });
        slide.addText(kpi.value, {
          x: 6.28,
          y: y + 0.3,
          w: 2.95,
          h: 0.42,
          fontSize: 20,
          bold: true,
          color: kIdx === 0 ? cAccent : cText,
          fontFace: fontHeading,
        });
        slide.addText(kpi.note, {
          x: 6.28,
          y: y + 0.72,
          w: 2.95,
          h: 0.22,
          fontSize: 8.5,
          color: cMuted,
          fontFace: fontBody,
        });
      });
    });

    const buffer = (await pptx.write({
      outputType: "nodebuffer",
    })) as Buffer;

    if (cacheKey) await storeSavedPptx(cacheKey, buffer);
    return pptxDownload(new Uint8Array(buffer), title);
  } catch (err) {
    console.error("PPTX Export Error:", err);
    return NextResponse.json(
      { error: "生成 PPTX 文件失败，请稍后重试" },
      { status: 500 }
    );
  }
}
