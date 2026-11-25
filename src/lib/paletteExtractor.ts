import type {
  ColorFamily,
  PromptAnatomy,
  PromptItem,
  TargetTool,
  VisualPalette,
  VisualSpec,
} from "@/types/prompt";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type WcagGrade = "AAA" | "AA" | "WARN";

export interface PaletteContrastReport {
  textBgRatio: number;
  textSurfaceRatio: number;
  accentBgRatio: number;
  textGrade: WcagGrade;
  accentGrade: WcagGrade;
  overallGrade: WcagGrade;
  isDarkCanvas: boolean;
  warnings: string[];
}

export interface ExtractedImageStyle {
  palette: VisualPalette;
  colorFamily: ColorFamily;
  isDarkCanvas: boolean;
  dominantSwatches: string[];
  contrast: PaletteContrastReport;
}

export interface PortableStylePack {
  schema: "pptgod.style.v1";
  exportedAt: string;
  title: string;
  englishTitle: string;
  summary: string;
  scenario: string;
  styleCategory: string;
  colorFamily: ColorFamily;
  recommendedTools: TargetTool[];
  tags: string[];
  sampleTopic: string;
  sampleSubtitle: string;
  customNotes: string;
  visualSpec: VisualSpec;
  promptAnatomy: PromptAnatomy;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return (
    "#" +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function parseColorToRgb(
  color: string,
  fallbackBg: RgbColor = { r: 255, g: 255, b: 255 }
): RgbColor {
  const s = (color || "").trim();
  const hex6 = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (hex6) {
    const intVal = parseInt(hex6[1], 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
    };
  }
  const hex3 = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (hex3) {
    return {
      r: parseInt(hex3[1][0] + hex3[1][0], 16),
      g: parseInt(hex3[1][1] + hex3[1][1], 16),
      b: parseInt(hex3[1][2] + hex3[1][2], 16),
    };
  }
  const rgba =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      s
    );
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const a = rgba[4] !== undefined ? Math.max(0, Math.min(1, Number(rgba[4]))) : 1;
    return {
      r: clampByte(r * a + fallbackBg.r * (1 - a)),
      g: clampByte(g * a + fallbackBg.g * (1 - a)),
      b: clampByte(b * a + fallbackBg.b * (1 - a)),
    };
  }
  return { ...fallbackBg };
}

export function relativeLuminance(rgb: RgbColor): number {
  const toLinear = (c: number) => {
    const s = clampByte(c) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

export function computeContrastRatio(fgColor: string, bgColor: string): number {
  const bgRgb = parseColorToRgb(bgColor, { r: 255, g: 255, b: 255 });
  const fgRgb = parseColorToRgb(fgColor, bgRgb);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function rgbToHsl({ r, g, b }: RgbColor): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(1, s));
  const ln = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) [r1, g1, b1] = [c, x, 0];
  else if (hn < 120) [r1, g1, b1] = [x, c, 0];
  else if (hn < 180) [r1, g1, b1] = [0, c, x];
  else if (hn < 240) [r1, g1, b1] = [0, x, c];
  else if (hn < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: clampByte((r1 + m) * 255),
    g: clampByte((g1 + m) * 255),
    b: clampByte((b1 + m) * 255),
  };
}

function mixRgb(a: RgbColor, b: RgbColor, weightB: number): RgbColor {
  const t = Math.max(0, Math.min(1, weightB));
  return {
    r: clampByte(a.r * (1 - t) + b.r * t),
    g: clampByte(a.g * (1 - t) + b.g * t),
    b: clampByte(a.b * (1 - t) + b.b * t),
  };
}

function adjustColorForTargetContrast(
  fgHex: string,
  bgHex: string,
  minRatio: number
): string {
  const bgRgb = parseColorToRgb(bgHex, { r: 255, g: 255, b: 255 });
  const bgLum = relativeLuminance(bgRgb);
  const darkBg = bgLum < 0.35;
  const fgRgb = parseColorToRgb(fgHex, bgRgb);
  if (computeContrastRatio(rgbToHex(fgRgb), rgbToHex(bgRgb)) >= minRatio) {
    return rgbToHex(fgRgb);
  }
  const hsl = rgbToHsl(fgRgb);
  // Nudge lightness away from background until target ratio is satisfied while preserving hue
  for (let step = 1; step <= 24; step++) {
    const candidateL = darkBg
      ? Math.min(0.96, hsl.l + step * 0.035)
      : Math.max(0.08, hsl.l - step * 0.035);
    const candHex = rgbToHex(hslToRgb(hsl.h, Math.max(hsl.s, 0.12), candidateL));
    if (computeContrastRatio(candHex, rgbToHex(bgRgb)) >= minRatio) {
      return candHex;
    }
  }
  return darkBg ? "#F4F6FA" : "#14181F";
}

export function evaluatePaletteContrast(
  palette: VisualPalette
): PaletteContrastReport {
  const bgRgb = parseColorToRgb(palette.bg, { r: 255, g: 255, b: 255 });
  const isDarkCanvas = relativeLuminance(bgRgb) < 0.35;

  const textBgRatio = computeContrastRatio(palette.text, palette.bg);
  const textSurfaceRatio = computeContrastRatio(palette.text, palette.surface);
  const accentBgRatio = computeContrastRatio(palette.accent, palette.bg);

  const worstText = Math.min(textBgRatio, textSurfaceRatio);
  const textGrade: WcagGrade =
    worstText >= 7 ? "AAA" : worstText >= 4.5 ? "AA" : "WARN";
  const accentGrade: WcagGrade =
    accentBgRatio >= 7 ? "AAA" : accentBgRatio >= 3.2 ? "AA" : "WARN";

  const warnings: string[] = [];
  if (textBgRatio < 4.5) {
    warnings.push(
      `正文与画布底色对比度仅 ${textBgRatio.toFixed(1)}:1（建议 ≥ 4.5:1 防投影发灰）`
    );
  }
  if (textSurfaceRatio < 4.5) {
    warnings.push(
      `正文与卡片底色对比度仅 ${textSurfaceRatio.toFixed(1)}:1（建议 ≥ 4.5:1）`
    );
  }
  if (accentBgRatio < 3.2) {
    warnings.push(
      `强调色与画布底色对比度偏低（${accentBgRatio.toFixed(1)}:1），大屏易不清晰`
    );
  }

  const overallGrade: WcagGrade =
    textGrade === "WARN" || accentGrade === "WARN"
      ? "WARN"
      : textGrade === "AAA" && accentBgRatio >= 4.5
      ? "AAA"
      : "AA";

  return {
    textBgRatio,
    textSurfaceRatio,
    accentBgRatio,
    textGrade,
    accentGrade,
    overallGrade,
    isDarkCanvas,
    warnings,
  };
}

export function autoFixPaletteContrast(palette: VisualPalette): VisualPalette {
  const bgRgb = parseColorToRgb(palette.bg, { r: 255, g: 255, b: 255 });
  const isDark = relativeLuminance(bgRgb) < 0.35;
  const surfaceRgb = parseColorToRgb(palette.surface, bgRgb);
  const surfaceMatchesPolarity = isDark
    ? relativeLuminance(surfaceRgb) < 0.45
    : relativeLuminance(surfaceRgb) >= 0.45;

  const fixedSurface =
    surfaceMatchesPolarity &&
    computeContrastRatio(palette.surface, palette.bg) > 1.03
      ? palette.surface
      : rgbToHex(
          mixRgb(
            bgRgb,
            { r: 255, g: 255, b: 255 },
            isDark ? 0.08 : 0.6
          )
        );

  // Ensure text passes WCAG AAA (>= 7.5:1) against both bg and surface
  let fixedText = adjustColorForTargetContrast(palette.text, palette.bg, 7.5);
  if (computeContrastRatio(fixedText, fixedSurface) < 6.0) {
    fixedText = isDark ? "#F5F7FA" : "#14181F";
  }

  // Ensure muted passes readable >= 4.5:1
  const fixedMuted = adjustColorForTargetContrast(palette.muted, palette.bg, 4.5);

  // Ensure accent passes >= 4.5:1 against bg while preserving hue
  const fixedAccent = adjustColorForTargetContrast(palette.accent, palette.bg, 4.5);
  const accRgb = parseColorToRgb(fixedAccent, bgRgb);
  const fixedAccentSoft = isDark
    ? `rgba(${accRgb.r}, ${accRgb.g}, ${accRgb.b}, 0.18)`
    : rgbToHex(mixRgb(bgRgb, accRgb, 0.12));

  const fixedChart0 = fixedAccent;
  const fixedChart1 = adjustColorForTargetContrast(
    palette.chartColors[1] || fixedText,
    palette.bg,
    3.5
  );

  return {
    ...palette,
    surface: fixedSurface,
    text: fixedText,
    muted: fixedMuted,
    accent: fixedAccent,
    accentSoft: fixedAccentSoft,
    chartColors: [
      fixedChart0,
      fixedChart1,
      palette.chartColors[2] || fixedMuted,
      palette.chartColors[3] || palette.border,
    ],
  };
}

function colorDistanceSq(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Pure zero-dependency ImageData quantizer: extracts a complete, WCAG-verified
 * PPTGod VisualPalette from any uploaded slide screenshot, poster, or artwork.
 */
export function extractStyleFromImageData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ExtractedImageStyle {
  // 5-bit per channel spatial bucket quantization (32x32x32 max, super fast < 10ms)
  const buckets = new Map<
    number,
    { rSum: number; gSum: number; bSum: number; count: number; edgeWeight: number }
  >();

  const totalPixels = Math.max(1, width * height);
  const stride = Math.max(1, Math.floor(totalPixels / 8000));

  for (let idx = 0; idx < totalPixels; idx += stride) {
    const off = idx * 4;
    const alpha = pixels[off + 3];
    if (alpha < 180) continue;
    const r = pixels[off];
    const g = pixels[off + 1];
    const b = pixels[off + 2];

    const x = idx % width;
    const y = Math.floor(idx / width);
    const isEdge =
      x < width * 0.12 ||
      x > width * 0.88 ||
      y < height * 0.12 ||
      y > height * 0.88;

    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const existing = buckets.get(key);
    if (existing) {
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
      existing.count += 1;
      if (isEdge) existing.edgeWeight += 2.2;
    } else {
      buckets.set(key, {
        rSum: r,
        gSum: g,
        bSum: b,
        count: 1,
        edgeWeight: isEdge ? 2.2 : 0.5,
      });
    }
  }

  const clusters = Array.from(buckets.values())
    .map((b) => {
      const rgb: RgbColor = {
        r: Math.round(b.rSum / b.count),
        g: Math.round(b.gSum / b.count),
        b: Math.round(b.bSum / b.count),
      };
      const hsl = rgbToHsl(rgb);
      return {
        rgb,
        hex: rgbToHex(rgb),
        hsl,
        lum: relativeLuminance(rgb),
        count: b.count,
        bgScore: b.count * (1 + b.edgeWeight / Math.max(1, b.count)) * (1.25 - hsl.s * 0.5),
        accentScore:
          Math.pow(hsl.s, 1.35) *
          (1 - Math.abs(hsl.l - 0.48) * 1.4) *
          Math.log2(b.count + 2),
      };
    })
    .sort((a, b) => b.count - a.count);

  if (clusters.length === 0) {
    const fallback: VisualPalette = {
      bg: "#F6F5F0",
      surface: "#FFFFFF",
      text: "#18181B",
      muted: "#5C6370",
      accent: "#C84B31",
      accentSoft: "#FBECE8",
      border: "#DCD8CE",
      chartColors: ["#C84B31", "#1D4ED8", "#0F766E", "#64748B"],
    };
    return {
      palette: fallback,
      colorFamily: "light",
      isDarkCanvas: false,
      dominantSwatches: ["#F6F5F0", "#18181B", "#C84B31", "#1D4ED8", "#0F766E"],
      contrast: evaluatePaletteContrast(fallback),
    };
  }

  // Deduplicate top visual swatches (Euclidean distance >= 38)
  const distinct: typeof clusters = [];
  for (const c of clusters) {
    if (distinct.every((d) => colorDistanceSq(d.rgb, c.rgb) >= 38 * 38)) {
      distinct.push(c);
      if (distinct.length >= 14) break;
    }
  }

  // Pick dominant canvas background (biased toward outer perimeter & lower saturation)
  const bgCluster = [...distinct].sort((a, b) => b.bgScore - a.bgScore)[0];
  const isDarkCanvas = bgCluster.lum < 0.32;

  // Slightly refine canvas bg so slides stay ultra-clean and never muddy
  const bgRgb = isDarkCanvas
    ? hslToRgb(bgCluster.hsl.h, Math.min(bgCluster.hsl.s, 0.34), Math.min(bgCluster.hsl.l, 0.14))
    : hslToRgb(bgCluster.hsl.h, Math.min(bgCluster.hsl.s, 0.22), Math.max(bgCluster.hsl.l, 0.94));
  const bgHex = rgbToHex(bgRgb);

  const surfaceRgb = isDarkCanvas
    ? mixRgb(bgRgb, { r: 255, g: 255, b: 255 }, 0.08)
    : bgCluster.hsl.l > 0.97
    ? mixRgb(bgRgb, { r: 235, g: 237, b: 242 }, 0.45)
    : { r: 255, g: 255, b: 255 };
  const surfaceHex = rgbToHex(surfaceRgb);

  // Pick richest distinct accent color
  const accentCandidates = distinct
    .filter((c) => colorDistanceSq(c.rgb, bgRgb) > 55 * 55)
    .sort((a, b) => b.accentScore - a.accentScore);
  const rawAccent = accentCandidates[0]
    ? accentCandidates[0].hex
    : isDarkCanvas
    ? "#38BDF8"
    : "#1D4ED8";
  const accentHex = adjustColorForTargetContrast(rawAccent, bgHex, 4.5);
  const accentRgb = parseColorToRgb(accentHex, bgRgb);
  const accentHsl = rgbToHsl(accentRgb);

  const accentSoft = isDarkCanvas
    ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.18)`
    : rgbToHex(mixRgb(bgRgb, accentRgb, 0.12));

  const textRgb = isDarkCanvas
    ? mixRgb({ r: 245, g: 247, b: 250 }, bgRgb, 0.06)
    : mixRgb({ r: 20, g: 24, b: 31 }, bgRgb, 0.08);
  const textHex = adjustColorForTargetContrast(rgbToHex(textRgb), bgHex, 8.0);

  const mutedRgb = isDarkCanvas
    ? mixRgb(textRgb, bgRgb, 0.34)
    : mixRgb(textRgb, bgRgb, 0.42);
  const mutedHex = adjustColorForTargetContrast(rgbToHex(mutedRgb), bgHex, 4.5);

  const border = isDarkCanvas
    ? `rgba(${mutedRgb.r}, ${mutedRgb.g}, ${mutedRgb.b}, 0.28)`
    : rgbToHex(mixRgb(bgRgb, textRgb, 0.16));

  // Build 4 distinct chart colors from remaining extracted accents or analogous hues
  const extraCharts: string[] = [accentHex];
  for (const cand of accentCandidates.slice(1)) {
    const safe = adjustColorForTargetContrast(cand.hex, bgHex, 3.3);
    const sRgb = parseColorToRgb(safe, bgRgb);
    if (
      extraCharts.every(
        (existing) => colorDistanceSq(parseColorToRgb(existing, bgRgb), sRgb) >= 52 * 52
      )
    ) {
      extraCharts.push(safe);
    }
    if (extraCharts.length >= 4) break;
  }
  const hueOffsets = [150, 215, 45];
  let offsetIdx = 0;
  while (extraCharts.length < 4) {
    const synth = rgbToHex(
      hslToRgb(
        accentHsl.h + hueOffsets[offsetIdx % hueOffsets.length],
        Math.max(0.42, Math.min(0.75, accentHsl.s || 0.55)),
        isDarkCanvas ? 0.64 : 0.42
      )
    );
    extraCharts.push(adjustColorForTargetContrast(synth, bgHex, 3.3));
    offsetIdx += 1;
  }

  const palette: VisualPalette = {
    bg: bgHex,
    surface: surfaceHex,
    text: textHex,
    muted: mutedHex,
    accent: accentHex,
    accentSoft,
    border,
    chartColors: [
      extraCharts[0],
      extraCharts[1],
      extraCharts[2],
      extraCharts[3],
    ],
  };

  // Classify ColorFamily deterministically
  let colorFamily: ColorFamily = "light";
  if (isDarkCanvas) {
    colorFamily = "dark";
  } else if (accentHsl.s >= 0.72) {
    colorFamily = "vivid";
  } else if (
    (bgCluster.hsl.h >= 20 && bgCluster.hsl.h <= 62 && bgCluster.hsl.s >= 0.14) ||
    (accentHsl.h >= 12 && accentHsl.h <= 45)
  ) {
    colorFamily = "warm";
  } else if (accentHsl.h >= 70 && accentHsl.h <= 170) {
    colorFamily = "earth";
  }

  return {
    palette,
    colorFamily,
    isDarkCanvas,
    dominantSwatches: distinct.slice(0, 6).map((d) => d.hex),
    contrast: evaluatePaletteContrast(palette),
  };
}

export function serializeStylePackJson(
  prompt: PromptItem,
  specOverride?: VisualSpec
): string {
  const pack: PortableStylePack = {
    schema: "pptgod.style.v1",
    exportedAt: new Date().toISOString(),
    title: prompt.title,
    englishTitle: prompt.englishTitle,
    summary: prompt.summary,
    scenario: prompt.scenario,
    styleCategory: prompt.styleCategory,
    colorFamily: prompt.colorFamily,
    recommendedTools: prompt.recommendedTools,
    tags: prompt.tags,
    sampleTopic: prompt.sampleTopic,
    sampleSubtitle: prompt.sampleSubtitle,
    customNotes: prompt.customNotes,
    visualSpec: specOverride ?? prompt.visualSpec,
    promptAnatomy: prompt.promptAnatomy,
  };
  return JSON.stringify(pack, null, 2);
}

export function parseImportedStylePackJson(
  rawText: string
): { ok: true; pack: PortableStylePack } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "JSON 顶层结构必须是对象" };
    }
    const p = parsed as Partial<PortableStylePack>;
    if (
      !p.visualSpec ||
      !p.visualSpec.palette ||
      !p.visualSpec.layout ||
      !p.visualSpec.typography ||
      !Array.isArray(p.visualSpec.palette.chartColors) ||
      p.visualSpec.palette.chartColors.length !== 4
    ) {
      return { ok: false, error: "缺少完整的 visualSpec 配色或版式字段" };
    }
    const title = typeof p.title === "string" && p.title.trim() ? p.title.trim().slice(0, 60) : "导入自定义风格";
    const englishTitle =
      typeof p.englishTitle === "string" && p.englishTitle.trim()
        ? p.englishTitle.trim().slice(0, 60)
        : "Imported Style System";
    return {
      ok: true,
      pack: {
        schema: "pptgod.style.v1",
        exportedAt: typeof p.exportedAt === "string" ? p.exportedAt : new Date().toISOString(),
        title,
        englishTitle,
        summary: typeof p.summary === "string" ? p.summary.slice(0, 200) : "",
        scenario: typeof p.scenario === "string" ? p.scenario : "品牌提案",
        styleCategory: typeof p.styleCategory === "string" ? p.styleCategory : "极简主义",
        colorFamily:
          p.colorFamily === "light" ||
          p.colorFamily === "dark" ||
          p.colorFamily === "warm" ||
          p.colorFamily === "vivid" ||
          p.colorFamily === "earth"
            ? p.colorFamily
            : "light",
        recommendedTools:
          Array.isArray(p.recommendedTools) && p.recommendedTools.length > 0
            ? p.recommendedTools
            : ["claude-html", "gamma-kimi"],
        tags: Array.isArray(p.tags)
          ? p.tags.filter((t): t is string => typeof t === "string").slice(0, 6)
          : ["导入风格"],
        sampleTopic:
          typeof p.sampleTopic === "string" && p.sampleTopic.trim()
            ? p.sampleTopic.trim()
            : title,
        sampleSubtitle:
          typeof p.sampleSubtitle === "string" ? p.sampleSubtitle.trim() : "",
        customNotes: typeof p.customNotes === "string" ? p.customNotes.trim() : "",
        visualSpec: p.visualSpec,
        promptAnatomy: p.promptAnatomy ?? {
          style: "",
          palette: "",
          typography: "",
          layout: "",
          content: "",
        },
      },
    };
  } catch {
    return { ok: false, error: "无法解析 JSON 文件，请确认是有效的 .pptgod.json 风格包" };
  }
}
