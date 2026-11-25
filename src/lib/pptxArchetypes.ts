import type PptxGenJS from "pptxgenjs";
import type { DecorativeMotif, LayoutArchetype } from "@/types/prompt";

export interface PptxThemeTokens {
  cBg: string;
  cSurface: string;
  cText: string;
  cMuted: string;
  cAccent: string;
  cAccentSoft: string;
  cAccentText: string;
  cBorder: string;
  cChart1: string;
  cChart2: string;
  cChart3: string;
  cChart4: string;
  fontHeading: string;
  fontBody: string;
  cornerRadius: number;
  archetype: LayoutArchetype;
  motif: DecorativeMotif;
  isBrutalist: boolean;
  isBauhaus: boolean;
  isChinese: boolean;
  isSwiss: boolean;
  isKeynote: boolean;
  isBento: boolean;
  isBlueprint: boolean;
  isEditorial: boolean;
  isTerminal: boolean;
  isAcademic: boolean;
  isChalkboard: boolean;
  isScientific: boolean;
  isCivic: boolean;
  isPmo: boolean;
  isPolaroid: boolean;
  isRounded: boolean;
}

export interface CardBox {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Draws an archetype-aware card (brutalist hard offset shadow, Bento rounded corners,
 * scientific transparent evidence block, chalk dashed frame, or crisp editorial rectangle).
 */
export function addStyledCard(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  tokens: PptxThemeTokens,
  box: CardBox
): void {
  const fill = box.fill ?? (tokens.isScientific ? tokens.cBg : tokens.cSurface);
  const borderColor = box.borderColor ?? tokens.cBorder;
  const borderWidth =
    box.borderWidth ?? (tokens.isBrutalist ? 2 : tokens.isBauhaus || tokens.isChalkboard ? 1.5 : 1);
  const lineDash = tokens.isChalkboard ? ("dash" as const) : undefined;

  if (tokens.isBrutalist) {
    slide.addShape(pptx.ShapeType.rect, {
      x: box.x + 0.055,
      y: box.y + 0.055,
      w: box.w,
      h: box.h,
      fill: { color: tokens.cBorder },
      line: { color: tokens.cBorder, width: 0 },
    });
  }

  if (tokens.isRounded) {
    const r = Math.min(0.18, Math.max(0.06, tokens.cornerRadius / 120));
    slide.addShape(pptx.ShapeType.roundRect, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      rectRadius: r,
      fill: { color: fill },
      line: { color: borderColor, width: borderWidth, dashType: lineDash },
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fill: { color: fill },
      line: { color: borderColor, width: borderWidth, dashType: lineDash },
    });
  }
}

/**
 * Renders the 11 decorative motifs natively in PowerPoint vector shapes.
 */
export function addArchetypeMotif(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  tokens: PptxThemeTokens,
  isCover: boolean
): void {
  const { motif } = tokens;
  if (motif === "none") return;

  if (motif === "hairline-rule") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.05,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    return;
  }

  if (motif === "ribbon-accent") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 5.5,
      h: 0.075,
      fill: { color: tokens.cChart1 },
      line: { color: tokens.cChart1, width: 0 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 5.5,
      y: 0,
      w: 2.7,
      h: 0.075,
      fill: { color: tokens.cChart2 },
      line: { color: tokens.cChart2, width: 0 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.2,
      y: 0,
      w: 1.8,
      h: 0.075,
      fill: { color: tokens.cChart3 },
      line: { color: tokens.cChart3, width: 0 },
    });
    return;
  }

  if (motif === "swiss-cross") {
    // Crisp Swiss cross mark in top-right
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.42,
      y: 0.27,
      w: 0.16,
      h: 0.045,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.477,
      y: 0.212,
      w: 0.045,
      h: 0.16,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    return;
  }

  if (motif === "bento-dots") {
    const colors = [tokens.cChart1, tokens.cChart2, tokens.cChart3];
    colors.forEach((col, i) => {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 9.05 + i * 0.16,
        y: 0.24,
        w: 0.09,
        h: 0.09,
        fill: { color: col, transparency: i === 0 ? 0 : 45 },
        line: { color: col, width: 0 },
      });
    });
    return;
  }

  if (motif === "bauhaus-geo") {
    if (isCover) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 7.2,
        y: 0,
        w: 2.8,
        h: 2.8,
        fill: { color: tokens.cChart2 },
        line: { color: tokens.cChart2, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 8.15,
        y: 2.8,
        w: 1.85,
        h: 2.825,
        fill: { color: tokens.cChart3 },
        line: { color: tokens.cChart3, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 6.22,
        y: 2.82,
        w: 1.95,
        h: 1.95,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0,
        y: 4.86,
        w: 10,
        h: 0,
        line: { color: tokens.cBorder, width: 1.5 },
      });
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.14,
        h: 1.875,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 1.875,
        w: 0.14,
        h: 1.875,
        fill: { color: tokens.cChart2 },
        line: { color: tokens.cChart2, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 3.75,
        w: 0.14,
        h: 1.875,
        fill: { color: tokens.cChart3 },
        line: { color: tokens.cChart3, width: 0 },
      });
    }
    return;
  }

  if (motif === "ink-wash") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.24,
      y: 0.22,
      w: 9.52,
      h: 5.18,
      fill: { color: tokens.cBg, transparency: 100 },
      line: { color: tokens.cBorder, width: 0.75 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 6.4,
      y: 4.1,
      w: 4.2,
      h: 2.0,
      fill: { color: tokens.cChart2, transparency: 88 },
      line: { color: tokens.cChart2, width: 0 },
    });
    return;
  }

  if (motif === "editorial-drop") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.24,
      y: 0.2,
      w: 9.52,
      h: 5.22,
      fill: { color: tokens.cBg, transparency: 100 },
      line: { color: tokens.cBorder, width: 0.75 },
    });
    return;
  }

  if (motif === "corner-brackets") {
    const len = 0.22;
    const stroke = { color: tokens.cAccent, width: 1.5 };
    // Top-left
    slide.addShape(pptx.ShapeType.line, { x: 0.24, y: 0.22, w: len, h: 0, line: stroke });
    slide.addShape(pptx.ShapeType.line, { x: 0.24, y: 0.22, w: 0, h: len, line: stroke });
    // Top-right
    slide.addShape(pptx.ShapeType.line, { x: 9.76 - len, y: 0.22, w: len, h: 0, line: stroke });
    slide.addShape(pptx.ShapeType.line, { x: 9.76, y: 0.22, w: 0, h: len, line: stroke });
    // Bottom-left
    slide.addShape(pptx.ShapeType.line, { x: 0.24, y: 5.4, w: len, h: 0, line: stroke });
    slide.addShape(pptx.ShapeType.line, { x: 0.24, y: 5.4 - len, w: 0, h: len, line: stroke });
    // Bottom-right
    slide.addShape(pptx.ShapeType.line, { x: 9.76 - len, y: 5.4, w: len, h: 0, line: stroke });
    slide.addShape(pptx.ShapeType.line, { x: 9.76, y: 5.4 - len, w: 0, h: len, line: stroke });
    return;
  }

  if (motif === "spotlight-orb") {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 7.0,
      y: -1.4,
      w: 4.4,
      h: 4.4,
      fill: { color: tokens.cAccent, transparency: 85 },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -1.2,
      y: 3.4,
      w: 3.6,
      h: 3.6,
      fill: { color: tokens.cChart2, transparency: 88 },
      line: { color: tokens.cChart2, width: 0 },
    });
    return;
  }

  if (motif === "hard-offset") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: tokens.cBorder },
      line: { color: tokens.cBorder, width: 0 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 5.545,
      w: 10,
      h: 0.08,
      fill: { color: tokens.cBorder },
      line: { color: tokens.cBorder, width: 0 },
    });
    return;
  }

  if (motif === "chalk-frame") {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.14,
      y: 0.12,
      w: 9.72,
      h: 5.32,
      rectRadius: 0.06,
      fill: { color: tokens.cBg, transparency: 100 },
      line: { color: tokens.cBorder, width: 1.4, dashType: "dash" },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.35,
      y: 5.54,
      w: 9.3,
      h: 0.085,
      fill: { color: "8B5E3C" },
      line: { color: "8B5E3C", width: 0 },
    });
    return;
  }

  if (motif === "citation-axis") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.04,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    [1.25, 2.5, 3.75, 5.0, 6.25, 7.5, 8.75].forEach((tx) => {
      slide.addShape(pptx.ShapeType.line, {
        x: tx,
        y: 0.04,
        w: 0,
        h: 0.1,
        line: { color: tokens.cBorder, width: 0.9 },
      });
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.24,
      y: 0.35,
      w: 0,
      h: 4.9,
      line: { color: tokens.cBorder, width: 0.75 },
    });
    return;
  }

  if (motif === "redgold-ribbon") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.075,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.095,
      w: 10,
      h: 0.025,
      fill: { color: tokens.cChart2 },
      line: { color: tokens.cChart2, width: 0 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.45,
      y: 5.48,
      w: 9.1,
      h: 0,
      line: { color: tokens.cChart2, width: 1 },
    });
    return;
  }

  if (motif === "status-dots") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.055,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    ["16A34A", "D97706", "DC2626"].forEach((col, i) => {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 9.15 + i * 0.17,
        y: 0.18,
        w: 0.1,
        h: 0.1,
        fill: { color: col },
        line: { color: col, width: 0 },
      });
    });
    return;
  }

  if (motif === "film-sprocket") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.72,
      y: 0,
      w: 0.28,
      h: 5.625,
      fill: { color: tokens.cBorder, transparency: 72 },
      line: { color: tokens.cBorder, width: 0 },
    });
    for (let i = 0; i < 10; i++) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 9.79,
        y: 0.22 + i * 0.52,
        w: 0.14,
        h: 0.24,
        rectRadius: 0.04,
        fill: { color: tokens.cBg },
        line: { color: tokens.cBorder, width: 0.75 },
      });
    }
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.18,
      y: 0.18,
      w: 9.44,
      h: 5.26,
      fill: { color: tokens.cBg, transparency: 100 },
      line: { color: tokens.cBorder, width: 0.75 },
    });
  }
}

export interface CoverData {
  sectionTag: string;
  title: string;
  subtitle: string;
  audience: string;
  styleName: string;
  total: number;
}

/**
 * Renders distinct high-craft native cover layouts matching all 20 LayoutArchetypes.
 */
export function renderArchetypeCover(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  tokens: PptxThemeTokens,
  data: CoverData
): void {
  const { sectionTag, title, subtitle, audience, styleName, total } = data;

  if (tokens.isChalkboard) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 0.55,
      w: 2.35,
      h: 0.34,
      rectRadius: 0.05,
      fill: { color: tokens.cAccentSoft },
      line: { color: tokens.cAccent, width: 1, dashType: "dash" },
    });
    slide.addText(`${sectionTag} · 板书微课`, {
      x: 0.55,
      y: 0.55,
      w: 2.35,
      h: 0.34,
      fontSize: 10,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccent,
      fontFace: tokens.fontBody,
    });
    slide.addText(title, {
      x: 0.55,
      y: 1.25,
      w: 5.65,
      h: 1.75,
      fontSize: 30,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 3.12,
      w: 5.4,
      h: 0,
      line: { color: tokens.cAccent, width: 2, dashType: "dash" },
    });
    slide.addText(subtitle, {
      x: 0.55,
      y: 3.3,
      w: 5.6,
      h: 0.9,
      fontSize: 13.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addText(`授课对象：${audience}   ·   共 ${total} 页`, {
      x: 0.55,
      y: 4.78,
      w: 5.6,
      h: 0.32,
      fontSize: 10,
      color: tokens.cMuted,
      fontFace: "Consolas",
    });

    addStyledCard(pptx, slide, tokens, { x: 6.45, y: 0.55, w: 3.05, h: 4.55 });
    slide.addText("CHALKBOARD LESSON PLAN", {
      x: 6.65,
      y: 0.75,
      w: 2.65,
      h: 0.28,
      fontSize: 9.5,
      bold: true,
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    ["01 情境导入 · 驱动设问", "02 原理拆解 · 阶梯板书", "03 互动演练 · 随堂验证", "04 归纳巩固 · 知识闭环"].forEach(
      (item, idx) => {
        slide.addText(item, {
          x: 6.65,
          y: 1.25 + idx * 0.78,
          w: 2.65,
          h: 0.58,
          fontSize: 12,
          bold: true,
          color: tokens.cText,
          fontFace: tokens.fontBody,
        });
      }
    );
    return;
  }

  if (tokens.isScientific) {
    slide.addText(`${sectionTag.toUpperCase()} · SCIENTIFIC EVIDENCE DECK`, {
      x: 0.55,
      y: 0.45,
      w: 5.5,
      h: 0.28,
      fontSize: 9.5,
      bold: true,
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText(`OKABE-ITO CVD-SAFE · ${total} SLIDES`, {
      x: 6.3,
      y: 0.45,
      w: 3.15,
      h: 0.28,
      fontSize: 9,
      align: "right",
      color: tokens.cMuted,
      fontFace: "Consolas",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 0.82,
      w: 8.9,
      h: 0,
      line: { color: tokens.cBorder, width: 0.9 },
    });
    slide.addText(title, {
      x: 0.55,
      y: 1.28,
      w: 8.7,
      h: 1.65,
      fontSize: 32,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.55,
      y: 3.15,
      w: 0.06,
      h: 0.75,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText(subtitle, {
      x: 0.78,
      y: 3.15,
      w: 8.2,
      h: 0.75,
      fontSize: 14,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
      valign: "middle",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 4.5,
      w: 8.9,
      h: 0,
      line: { color: tokens.cBorder, width: 0.9 },
    });
    slide.addText(`AUDIENCE / PANEL: ${audience}`, {
      x: 0.55,
      y: 4.65,
      w: 5.8,
      h: 0.35,
      fontSize: 10.5,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontBody,
    });
    [tokens.cChart1, tokens.cChart2, tokens.cChart3, tokens.cChart4].forEach((c, i) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: 7.85 + i * 0.38,
        y: 4.72,
        w: 0.24,
        h: 0.2,
        fill: { color: c },
        line: { color: c, width: 0 },
      });
    });
    return;
  }

  if (tokens.isCivic) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 3.25,
      y: 0.75,
      w: 3.5,
      h: 0.36,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText(`★  ${sectionTag} · 专项工作汇报  ★`, {
      x: 3.25,
      y: 0.75,
      w: 3.5,
      h: 0.36,
      fontSize: 10.5,
      bold: true,
      align: "center",
      valign: "middle",
      color: "FFFFFF",
      fontFace: tokens.fontBody,
    });
    slide.addText(title, {
      x: 0.9,
      y: 1.5,
      w: 8.2,
      h: 1.55,
      fontSize: 33,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cText,
      fontFace: tokens.fontHeading,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 4.2,
      y: 3.16,
      w: 1.6,
      h: 0.05,
      fill: { color: tokens.cChart2 },
      line: { color: tokens.cChart2, width: 0 },
    });
    slide.addText(subtitle, {
      x: 1.2,
      y: 3.38,
      w: 7.6,
      h: 0.75,
      fontSize: 14,
      align: "center",
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.75,
      y: 4.65,
      w: 8.5,
      h: 0,
      line: { color: tokens.cBorder, width: 0.9 },
    });
    slide.addText(`汇报对象：${audience}    |    ${styleName}    |    共 ${total} 页`, {
      x: 0.8,
      y: 4.78,
      w: 8.4,
      h: 0.32,
      fontSize: 10.5,
      align: "center",
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    return;
  }

  if (tokens.isPmo) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 0.52,
      w: 2.1,
      h: 0.32,
      rectRadius: 0.04,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText(`PMO · ${sectionTag}`, {
      x: 0.55,
      y: 0.52,
      w: 2.1,
      h: 0.32,
      fontSize: 9.5,
      bold: true,
      align: "center",
      valign: "middle",
      color: "FFFFFF",
      fontFace: "Consolas",
    });
    slide.addText("● OVERALL: ON TRACK", {
      x: 2.8,
      y: 0.52,
      w: 2.4,
      h: 0.32,
      fontSize: 9.5,
      bold: true,
      valign: "middle",
      color: "16A34A",
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.55,
      y: 1.25,
      w: 5.5,
      h: 1.75,
      fontSize: 29,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 0.55,
      y: 3.15,
      w: 5.5,
      h: 0.95,
      fontSize: 13,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addText(`评审方：${audience}   ·   ${total} SLIDES`, {
      x: 0.55,
      y: 4.78,
      w: 5.5,
      h: 0.3,
      fontSize: 10,
      color: tokens.cMuted,
      fontFace: "Consolas",
    });

    addStyledCard(pptx, slide, tokens, { x: 6.3, y: 0.65, w: 3.2, h: 4.35 });
    slide.addText("PROJECT HEALTH MATRIX (RAG)", {
      x: 6.5,
      y: 0.84,
      w: 2.8,
      h: 0.28,
      fontSize: 9.5,
      bold: true,
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    [
      { label: "进度里程碑", status: "ON TRACK", col: "16A34A" },
      { label: "研发质量", status: "99.2% PASS", col: "16A34A" },
      { label: "跨部门依赖", status: "WATCH", col: "D97706" },
      { label: "预算控制", status: "-4.2% SAVE", col: "2563EB" },
    ].forEach((r, idx) => {
      const ry = 1.32 + idx * 0.85;
      slide.addShape(pptx.ShapeType.rect, {
        x: 6.5,
        y: ry,
        w: 0.08,
        h: 0.64,
        fill: { color: r.col },
        line: { color: r.col, width: 0 },
      });
      slide.addText(r.label, {
        x: 6.7,
        y: ry + 0.04,
        w: 1.5,
        h: 0.56,
        fontSize: 11.5,
        bold: true,
        valign: "middle",
        color: tokens.cText,
        fontFace: tokens.fontBody,
      });
      slide.addText(r.status, {
        x: 8.15,
        y: ry + 0.04,
        w: 1.15,
        h: 0.56,
        fontSize: 9.5,
        bold: true,
        align: "right",
        valign: "middle",
        color: r.col,
        fontFace: "Consolas",
      });
    });
    return;
  }

  if (tokens.isPolaroid) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 0.72,
      w: 2.35,
      h: 0.34,
      rectRadius: 0.17,
      fill: { color: tokens.cAccentSoft },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText(`35MM · ${sectionTag} · 2026`, {
      x: 0.55,
      y: 0.72,
      w: 2.35,
      h: 0.34,
      fontSize: 9.5,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.55,
      y: 1.38,
      w: 5.2,
      h: 1.75,
      fontSize: 31,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 0.55,
      y: 3.28,
      w: 5.1,
      h: 0.9,
      fontSize: 13.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addText(`STORY FOR · ${audience} · ${total} FRAMES`, {
      x: 0.55,
      y: 4.72,
      w: 5.1,
      h: 0.32,
      fontSize: 10,
      color: tokens.cMuted,
      fontFace: "Consolas",
    });

    // Polaroid frame on right
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.05,
      y: 0.65,
      w: 3.25,
      h: 4.3,
      fill: { color: "FFFFFF" },
      line: { color: tokens.cBorder, width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.27,
      y: 0.88,
      w: 2.81,
      h: 3.05,
      fill: { color: tokens.cAccentSoft },
      line: { color: tokens.cBorder, width: 0.75 },
    });
    slide.addText(`FRAME 01 / ${String(total).padStart(2, "0")}`, {
      x: 6.35,
      y: 1.75,
      w: 2.65,
      h: 0.36,
      fontSize: 11,
      bold: true,
      align: "center",
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText("ISO 400 · WARM FILM · 2026", {
      x: 6.27,
      y: 4.25,
      w: 2.81,
      h: 0.35,
      fontSize: 9.5,
      align: "center",
      color: tokens.cMuted,
      fontFace: "Consolas",
    });
    return;
  }

  if (tokens.isKeynote) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 3.5,
      y: 0.95,
      w: 3.0,
      h: 0.34,
      rectRadius: 0.17,
      fill: { color: tokens.cAccentSoft },
      line: { color: tokens.cAccent, width: 0.75 },
    });
    slide.addText(`${sectionTag} · KEYNOTE 2026`, {
      x: 3.5,
      y: 0.95,
      w: 3.0,
      h: 0.34,
      fontSize: 9.5,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.9,
      y: 1.55,
      w: 8.2,
      h: 1.55,
      fontSize: 34,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cText,
      fontFace: tokens.fontHeading,
    });
    slide.addText(subtitle, {
      x: 1.4,
      y: 3.22,
      w: 7.2,
      h: 0.75,
      fontSize: 14,
      align: "center",
      valign: "top",
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 2.2,
      y: 4.45,
      w: 5.6,
      h: 0,
      line: { color: tokens.cBorder, width: 0.75 },
    });
    slide.addText(
      `AUDIENCE · ${audience}    |    ${total} SLIDES    |    16:9 STAGE`,
      {
        x: 1.2,
        y: 4.6,
        w: 7.6,
        h: 0.32,
        fontSize: 9.5,
        align: "center",
        color: tokens.cMuted,
        fontFace: "Consolas",
      }
    );
    return;
  }

  if (tokens.isBento) {
    // Left Hero Bento Card
    addStyledCard(pptx, slide, tokens, {
      x: 0.55,
      y: 0.55,
      w: 5.45,
      h: 4.52,
      fill: tokens.cSurface,
      borderColor: tokens.cBorder,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.88,
      y: 0.88,
      w: 2.1,
      h: 0.32,
      rectRadius: 0.15,
      fill: { color: tokens.cAccentSoft },
      line: { color: tokens.cAccentSoft, width: 0 },
    });
    slide.addText(`${sectionTag} · 2026`, {
      x: 0.88,
      y: 0.88,
      w: 2.1,
      h: 0.32,
      fontSize: 9,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.88,
      y: 1.55,
      w: 4.8,
      h: 1.55,
      fontSize: 28,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 0.88,
      y: 3.18,
      w: 4.8,
      h: 0.9,
      fontSize: 12.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
      valign: "top",
    });
    slide.addText(`${audience} · ${total} SLIDES`, {
      x: 0.88,
      y: 4.56,
      w: 4.8,
      h: 0.28,
      fontSize: 9.5,
      color: tokens.cMuted,
      fontFace: "Consolas",
    });

    // Right Top Accent Metric Tile
    addStyledCard(pptx, slide, tokens, {
      x: 6.22,
      y: 0.55,
      w: 3.23,
      h: 2.16,
      fill: tokens.cAccent,
      borderColor: tokens.cAccent,
    });
    slide.addText("KEY UPGRADE", {
      x: 6.48,
      y: 0.78,
      w: 2.7,
      h: 0.24,
      fontSize: 9,
      bold: true,
      color: tokens.cAccentText,
      fontFace: "Consolas",
    });
    slide.addText("3.2×", {
      x: 6.48,
      y: 1.12,
      w: 2.7,
      h: 0.85,
      fontSize: 38,
      bold: true,
      color: tokens.cAccentText,
      fontFace: tokens.fontHeading,
    });
    slide.addText("全链路流转效率跃升", {
      x: 6.48,
      y: 2.18,
      w: 2.7,
      h: 0.3,
      fontSize: 11,
      color: tokens.cAccentText,
      fontFace: tokens.fontBody,
    });

    // Right Bottom Modular System Tile
    addStyledCard(pptx, slide, tokens, {
      x: 6.22,
      y: 2.91,
      w: 3.23,
      h: 2.16,
      fill: tokens.cSurface,
      borderColor: tokens.cBorder,
    });
    slide.addText("MODULAR DESIGN SYSTEM", {
      x: 6.48,
      y: 3.14,
      w: 2.7,
      h: 0.24,
      fontSize: 8.5,
      color: tokens.cMuted,
      fontFace: "Consolas",
    });
    slide.addText(styleName, {
      x: 6.48,
      y: 3.54,
      w: 2.7,
      h: 0.72,
      fontSize: 16,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
    });
    [tokens.cChart1, tokens.cChart2, tokens.cChart3, tokens.cChart4].forEach(
      (col, idx) => {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 6.48 + idx * 0.42,
          y: 4.52,
          w: 0.32,
          h: 0.12,
          rectRadius: 0.06,
          fill: { color: col },
          line: { color: col, width: 0 },
        });
      }
    );
    return;
  }

  if (tokens.isSwiss) {
    // Swiss International Grid Cover with giant 01 watermark + vertical rule
    slide.addText("01", {
      x: 6.9,
      y: 0.55,
      w: 2.6,
      h: 2.6,
      fontSize: 118,
      bold: true,
      align: "right",
      color: tokens.cBorder,
      fontFace: "Consolas",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 6.75,
      y: 0.65,
      w: 0,
      h: 3.7,
      line: { color: tokens.cBorder, width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.65,
      y: 0.72,
      w: 1.75,
      h: 0.32,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText(sectionTag, {
      x: 0.65,
      y: 0.72,
      w: 1.75,
      h: 0.32,
      fontSize: 9.5,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccentText,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.65,
      y: 1.4,
      w: 5.85,
      h: 1.85,
      fontSize: 32,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 0.65,
      y: 3.35,
      w: 5.85,
      h: 0.85,
      fontSize: 13.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
      valign: "top",
    });
    slide.addText(`${total} SLIDES\nSWISS GRID\n16:9 SYSTEM`, {
      x: 7.05,
      y: 3.2,
      w: 2.35,
      h: 1.0,
      fontSize: 10,
      bold: true,
      align: "right",
      color: tokens.cMuted,
      fontFace: "Consolas",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.65,
      y: 4.58,
      w: 8.75,
      h: 0,
      line: { color: tokens.cBorder, width: 1.25 },
    });
    slide.addText(`面向受众：${audience}    |    视觉体系：${styleName}`, {
      x: 0.65,
      y: 4.72,
      w: 8.75,
      h: 0.35,
      fontSize: 10,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    return;
  }

  if (tokens.isChinese) {
    // Neo-Chinese Editorial Cover with vertical rule + vermilion seal
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.72,
      y: 0.78,
      w: 0.06,
      h: 3.2,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    // Vermilion seal stamp
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.45,
      y: 0.82,
      w: 0.62,
      h: 0.62,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cAccent, width: 0 },
    });
    slide.addText("印", {
      x: 8.45,
      y: 0.82,
      w: 0.62,
      h: 0.62,
      fontSize: 18,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccentText,
      fontFace: tokens.fontHeading,
    });
    slide.addText(sectionTag, {
      x: 1.05,
      y: 0.84,
      w: 4.5,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: tokens.cAccent,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 1.05,
      y: 1.45,
      w: 7.0,
      h: 1.65,
      fontSize: 32,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 1.05,
      y: 3.2,
      w: 7.0,
      h: 0.8,
      fontSize: 13.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.72,
      y: 4.52,
      w: 8.56,
      h: 0,
      line: { color: tokens.cBorder, width: 0.75 },
    });
    slide.addText(`${styleName}  ·  ${audience}  ·  共 ${total} 页`, {
      x: 0.72,
      y: 4.68,
      w: 8.56,
      h: 0.32,
      fontSize: 10,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    return;
  }

  if (tokens.isBrutalist) {
    addStyledCard(pptx, slide, tokens, {
      x: 0.65,
      y: 0.68,
      w: 8.65,
      h: 4.18,
      fill: tokens.cSurface,
      borderColor: tokens.cBorder,
      borderWidth: 2.25,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.98,
      y: 1.0,
      w: 2.1,
      h: 0.36,
      fill: { color: tokens.cAccent },
      line: { color: tokens.cBorder, width: 1.5 },
    });
    slide.addText(sectionTag, {
      x: 0.98,
      y: 1.0,
      w: 2.1,
      h: 0.36,
      fontSize: 10,
      bold: true,
      align: "center",
      valign: "middle",
      color: tokens.cAccentText,
      fontFace: "Consolas",
    });
    slide.addText(title, {
      x: 0.98,
      y: 1.62,
      w: 7.9,
      h: 1.55,
      fontSize: 32,
      bold: true,
      color: tokens.cText,
      fontFace: tokens.fontHeading,
      valign: "middle",
    });
    slide.addText(subtitle, {
      x: 0.98,
      y: 3.24,
      w: 7.6,
      h: 0.75,
      fontSize: 13.5,
      color: tokens.cMuted,
      fontFace: tokens.fontBody,
    });
    slide.addText(`AUDIENCE: ${audience}  //  ${styleName}  //  ${total}P`, {
      x: 0.98,
      y: 4.3,
      w: 7.8,
      h: 0.32,
      fontSize: 9.5,
      bold: true,
      color: tokens.cText,
      fontFace: "Consolas",
    });
    return;
  }

  // Default Refined Executive / Bauhaus / Consulting / Blueprint / Editorial / Academic Cover
  const contentW = tokens.isBauhaus ? 5.65 : 8.4;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7,
    y: 0.68,
    w: 1.85,
    h: 0.32,
    fill: { color: tokens.cAccent },
    line: { color: tokens.cAccent, width: 0 },
  });
  slide.addText(sectionTag || "PRESENTATION", {
    x: 0.7,
    y: 0.68,
    w: 1.85,
    h: 0.32,
    fontSize: 9.5,
    bold: true,
    align: "center",
    valign: "middle",
    color: tokens.cAccentText,
    fontFace: tokens.fontBody,
  });

  slide.addText(title, {
    x: 0.7,
    y: 1.52,
    w: contentW,
    h: 1.58,
    fontSize: tokens.isBauhaus ? 30 : 32,
    bold: true,
    color: tokens.cText,
    fontFace: tokens.fontHeading,
    valign: "middle",
  });

  slide.addText(subtitle, {
    x: 0.7,
    y: 3.18,
    w: Math.min(contentW, 7.8),
    h: 0.82,
    fontSize: 14,
    color: tokens.cMuted,
    fontFace: tokens.fontBody,
    valign: "top",
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.7,
    y: 4.56,
    w: 8.6,
    h: 0,
    line: { color: tokens.cBorder, width: 1 },
  });
  slide.addText(`面向受众：${audience}    |    视觉体系：${styleName}`, {
    x: 0.7,
    y: 4.7,
    w: 6.8,
    h: 0.35,
    fontSize: 10,
    color: tokens.cMuted,
    fontFace: tokens.fontBody,
  });

  // Palette swatches on right side of cover footer
  [tokens.cChart1, tokens.cChart2, tokens.cChart3, tokens.cChart4].forEach(
    (col, i) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: 8.2 + i * 0.28,
        y: 4.78,
        w: 0.2,
        h: 0.18,
        fill: { color: col },
        line: { color: tokens.cBorder, width: 0.5 },
      });
    }
  );
}

/**
 * Draws native editable PowerPoint vector artwork inside an image-split visual slot
 * when the slide uses one of the 12 built-in style-adaptive SVG artwork presets.
 */
export function drawNativeArtworkPreset(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  tokens: PptxThemeTokens,
  presetId: string,
  box: { x: number; y: number; w: number; h: number }
): void {
  const { x, y, w, h } = box;

  // Base canvas frame
  addStyledCard(pptx, slide, tokens, {
    x,
    y,
    w,
    h,
    fill: tokens.cSurface,
    borderColor: tokens.cBorder,
  });

  switch (presetId) {
    case "neural-orbit": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 1.1,
        y: cy - 1.1,
        w: 2.2,
        h: 2.2,
        fill: { color: tokens.cSurface, transparency: 100 },
        line: { color: tokens.cBorder, width: 1, dashType: "dash" },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.72,
        y: cy - 0.72,
        w: 1.44,
        h: 1.44,
        fill: { color: tokens.cChart1, transparency: 85 },
        line: { color: tokens.cChart2, width: 1.2 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.28,
        y: cy - 0.28,
        w: 0.56,
        h: 0.56,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      [
        { dx: 0.95, dy: -0.6, r: 0.24, c: tokens.cChart1 },
        { dx: -0.95, dy: -0.45, r: 0.2, c: tokens.cChart2 },
        { dx: 0.75, dy: 0.75, r: 0.22, c: tokens.cChart3 },
        { dx: -0.78, dy: 0.68, r: 0.18, c: tokens.cChart1 },
      ].forEach((n) => {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: cx + n.dx - n.r / 2,
          y: cy + n.dy - n.r / 2,
          w: n.r,
          h: n.r,
          fill: { color: n.c },
          line: { color: tokens.cSurface, width: 1.5 },
        });
      });
      break;
    }

    case "bauhaus-composition": {
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.35,
        y: y + 0.3,
        w: 1.45,
        h: 1.35,
        fill: { color: tokens.cChart2 },
        line: { color: tokens.cChart2, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 1.95,
        y: y + 0.3,
        w: 1.35,
        h: 1.35,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rtTriangle, {
        x: x + 0.35,
        y: y + 1.72,
        w: 1.45,
        h: 1.1,
        fill: { color: tokens.cChart3 },
        line: { color: tokens.cChart3, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 1.95,
        y: y + 1.78,
        w: 1.45,
        h: 1.02,
        fill: { color: tokens.cBg },
        line: { color: tokens.cText, width: 1.75 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 2.42,
        y: y + 2.04,
        w: 0.5,
        h: 0.5,
        fill: { color: tokens.cText },
        line: { color: tokens.cText, width: 0 },
      });
      break;
    }

    case "bento-devices": {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.3,
        y: y + 0.3,
        w: 2.05,
        h: 1.48,
        rectRadius: 0.12,
        fill: { color: tokens.cBg },
        line: { color: tokens.cBorder, width: 1 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 2.5,
        y: y + 0.3,
        w: 1.22,
        h: 1.1,
        rectRadius: 0.12,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 2.5,
        y: y + 1.54,
        w: 1.22,
        h: 1.28,
        rectRadius: 0.12,
        fill: { color: tokens.cBg },
        line: { color: tokens.cBorder, width: 1 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.3,
        y: y + 1.92,
        w: 2.05,
        h: 0.9,
        rectRadius: 0.12,
        fill: { color: tokens.cBg },
        line: { color: tokens.cBorder, width: 1 },
      });
      // Mini bars inside bottom right bento tile
      [
        { dx: 2.7, hBar: 0.55, c: tokens.cChart3 },
        { dx: 3.0, hBar: 0.85, c: tokens.cChart2 },
        { dx: 3.3, hBar: 0.68, c: tokens.cChart1 },
      ].forEach((b) => {
        slide.addShape(pptx.ShapeType.rect, {
          x: x + b.dx,
          y: y + 2.66 - b.hBar,
          w: 0.2,
          h: b.hBar,
          fill: { color: b.c },
          line: { color: b.c, width: 0 },
        });
      });
      break;
    }

    case "song-mountains": {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 2.55,
        y: y + 0.45,
        w: 0.68,
        h: 0.68,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.45,
        y: y + 0.45,
        w: 0.36,
        h: 0.36,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.triangle, {
        x: x + 0.35,
        y: y + 1.35,
        w: 2.1,
        h: 1.45,
        fill: { color: tokens.cChart2, transparency: 55 },
        line: { color: tokens.cChart2, width: 0 },
      });
      slide.addShape(pptx.ShapeType.triangle, {
        x: x + 1.65,
        y: y + 1.15,
        w: 2.1,
        h: 1.65,
        fill: { color: tokens.cChart2, transparency: 30 },
        line: { color: tokens.cChart2, width: 0 },
      });
      break;
    }

    case "financial-pulse": {
      const bars = [0.65, 0.95, 0.78, 1.25, 1.48, 1.72, 1.95];
      bars.forEach((bh, i) => {
        const bx = x + 0.42 + i * 0.46;
        slide.addShape(pptx.ShapeType.line, {
          x: bx + 0.14,
          y: y + h - 0.56 - bh,
          w: 0,
          h: bh + 0.24,
          line: { color: i >= 4 ? tokens.cChart1 : tokens.cChart2, width: 1.25 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: bx,
          y: y + h - 0.42 - bh,
          w: 0.28,
          h: bh,
          fill: {
            color:
              i >= 4
                ? tokens.cChart1
                : i % 2 === 0
                ? tokens.cChart3
                : tokens.cChart2,
          },
          line: { color: tokens.cSurface, width: 0 },
        });
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.32,
        y: y + h - 0.42,
        w: w - 0.64,
        h: 0,
        line: { color: tokens.cBorder, width: 1 },
      });
      break;
    }

    case "data-topography": {
      // Rising terrain steps + sampling anchor dots
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.35,
        y: y + h - 0.42,
        w: w - 0.7,
        h: 0,
        line: { color: tokens.cBorder, width: 1.2 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.35,
        y: y + 0.45,
        w: 0,
        h: h - 0.87,
        line: { color: tokens.cBorder, width: 1.2 },
      });
      const pts = [
        { dx: 0.6, dy: 2.15 },
        { dx: 1.35, dy: 1.65 },
        { dx: 2.1, dy: 1.82 },
        { dx: 2.85, dy: 1.18 },
        { dx: 3.55, dy: 0.72 },
      ];
      pts.forEach((pt, idx) => {
        slide.addShape(pptx.ShapeType.rect, {
          x: x + pt.dx - 0.22,
          y: y + pt.dy,
          w: 0.44,
          h: h - 0.42 - pt.dy,
          fill: { color: idx >= 3 ? tokens.cChart1 : tokens.cChart2, transparency: 72 },
          line: { color: tokens.cSurface, width: 0 },
        });
        slide.addShape(pptx.ShapeType.ellipse, {
          x: x + pt.dx - 0.1,
          y: y + pt.dy - 0.1,
          w: 0.2,
          h: 0.2,
          fill: { color: idx === pts.length - 1 ? tokens.cChart1 : tokens.cSurface },
          line: { color: tokens.cChart1, width: 2 },
        });
      });
      break;
    }

    case "biotech-helix": {
      const rungs = [0.48, 0.96, 1.44, 1.92, 2.4];
      rungs.forEach((ry, idx) => {
        const spread = idx === 2 ? 0.28 : idx % 2 === 0 ? 1.1 : 0.72;
        const cx = x + w / 2;
        slide.addShape(pptx.ShapeType.line, {
          x: cx - spread,
          y: y + ry + 0.12,
          w: spread * 2,
          h: 0,
          line: { color: tokens.cBorder, width: 1.5 },
        });
        slide.addShape(pptx.ShapeType.ellipse, {
          x: cx - spread - 0.12,
          y: y + ry,
          w: 0.24,
          h: 0.24,
          fill: { color: idx % 2 === 0 ? tokens.cChart1 : tokens.cChart2 },
          line: { color: tokens.cSurface, width: 1 },
        });
        slide.addShape(pptx.ShapeType.ellipse, {
          x: cx + spread - 0.12,
          y: y + ry,
          w: 0.24,
          h: 0.24,
          fill: { color: idx % 2 === 0 ? tokens.cChart2 : tokens.cChart1 },
          line: { color: tokens.cSurface, width: 1 },
        });
      });
      break;
    }

    case "editorial-arch": {
      // Architectural arch silhouette with golden hairline center axis
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.88,
        y: y + 0.42,
        w: w - 1.76,
        h: h - 0.76,
        rectRadius: 0.5,
        fill: { color: tokens.cBg },
        line: { color: tokens.cBorder, width: 1.2 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 1.32,
        y: y + 0.78,
        w: w - 2.64,
        h: h - 1.12,
        rectRadius: 0.45,
        fill: { color: tokens.cChart1, transparency: 82 },
        line: { color: tokens.cChart1, width: 1.2 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + w / 2 - 0.26,
        y: y + 1.02,
        w: 0.52,
        h: 0.52,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.38,
        y: y + h - 0.34,
        w: w - 0.76,
        h: 0,
        line: { color: tokens.cText, width: 1.25 },
      });
      break;
    }

    case "industrial-radar": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      [1.12, 0.76, 0.38].forEach((r, idx) => {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: cx - r,
          y: cy - r,
          w: r * 2,
          h: r * 2,
          fill: { color: tokens.cSurface, transparency: 100 },
          line: { color: idx === 2 ? tokens.cChart1 : tokens.cBorder, width: 1.2 },
        });
      });
      slide.addShape(pptx.ShapeType.line, {
        x: cx - 1.24,
        y: cy,
        w: 2.48,
        h: 0,
        line: { color: tokens.cBorder, width: 1 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: cx,
        y: cy - 1.24,
        w: 0,
        h: 2.48,
        line: { color: tokens.cBorder, width: 1 },
      });
      slide.addShape(pptx.ShapeType.pie, {
        x: cx - 1.12,
        y: cy - 1.12,
        w: 2.24,
        h: 2.24,
        fill: { color: tokens.cChart1, transparency: 72 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx + 0.52,
        y: cy - 0.52,
        w: 0.2,
        h: 0.2,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cSurface, width: 1 },
      });
      break;
    }

    case "editorial-botanical": {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 1.15,
        y: y + 0.42,
        w: 1.9,
        h: 1.9,
        fill: { color: tokens.cChart1, transparency: 84 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 0.65,
        y: y + 1.18,
        w: 1.45,
        h: 1.45,
        fill: { color: tokens.cChart2, transparency: 82 },
        line: { color: tokens.cChart2, width: 0 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + 1.1,
        y: y + 0.55,
        w: 1.65,
        h: 2.1,
        flipV: true,
        line: { color: tokens.cText, width: 2 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 1.92,
        y: y + 1.05,
        w: 0.92,
        h: 0.46,
        fill: { color: tokens.cChart1, transparency: 18 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 0.95,
        y: y + 1.56,
        w: 0.86,
        h: 0.44,
        fill: { color: tokens.cChart2, transparency: 24 },
        line: { color: tokens.cChart2, width: 0 },
      });
      break;
    }

    case "architecture-iso": {
      [
        { dy: 0.38, c: tokens.cChart1 },
        { dy: 1.02, c: tokens.cChart2 },
        { dy: 1.66, c: tokens.cChart3 },
      ].forEach((layer) => {
        slide.addShape(pptx.ShapeType.diamond, {
          x: x + 0.85,
          y: y + layer.dy,
          w: 2.3,
          h: 0.95,
          fill: { color: layer.c, transparency: 14 },
          line: { color: tokens.cSurface, width: 1.5 },
        });
      });
      break;
    }

    default: {
      // Swiss Geometry & clean geometric default
      slide.addShape(pptx.ShapeType.line, {
        x: x + w * 0.35,
        y: y + 0.2,
        w: 0,
        h: h - 0.4,
        line: { color: tokens.cBorder, width: 0.75 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + w * 0.68,
        y: y + 0.2,
        w: 0,
        h: h - 0.4,
        line: { color: tokens.cBorder, width: 0.75 },
      });
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.2,
        y: y + h * 0.5,
        w: w - 0.4,
        h: 0,
        line: { color: tokens.cBorder, width: 0.75 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + w * 0.5 - 0.72,
        y: y + h * 0.5 - 0.72,
        w: 1.44,
        h: 1.44,
        fill: { color: tokens.cChart1 },
        line: { color: tokens.cChart1, width: 0 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.45,
        y: y + h * 0.5,
        w: 1.35,
        h: 1.05,
        fill: { color: tokens.cText },
        line: { color: tokens.cText, width: 0 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + w * 0.68 - 0.3,
        y: y + h * 0.3 - 0.3,
        w: 0.6,
        h: 0.6,
        fill: { color: tokens.cSurface },
        line: { color: tokens.cText, width: 2 },
      });
      break;
    }
  }
}
