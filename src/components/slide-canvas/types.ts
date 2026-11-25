import type React from "react";
import { buildAdaptiveOutline, type SlideOutlineItem } from "@/lib/promptCompiler";
import type {
  AnatomyDimension,
  DeckSlideItem,
  SlideType,
  TypographyMood,
  VisualLayout,
  VisualPalette,
  VisualSpec,
  VisualTypography,
} from "@/types/prompt";

export interface SlideCanvasProps {
  spec: VisualSpec;
  slideType: SlideType;
  topic: string;
  subtitle: string;
  audience?: string;
  slideCount?: number;
  englishTitle?: string;
  scenario?: string;
  highlightDimension?: AnatomyDimension | null;
  slideData?: Partial<DeckSlideItem>;
  pageIndex?: number;
  totalPages?: number;
  className?: string;
}

export const CN_NUMS = ["壹", "贰", "叁", "肆"];

export function getHeadingFontFamily(mood: TypographyMood): string {
  switch (mood) {
    case "editorial":
    case "academic":
      return `var(--font-serif), var(--font-cjk-serif), 'Songti SC', Georgia, serif`;
    case "chinese":
      return `var(--font-cjk-serif), 'Songti SC', 'STSong', var(--font-serif), serif`;
    case "tech":
      return `var(--font-sans), var(--font-cjk-sans), 'PingFang SC', sans-serif`;
    case "brutalist":
      return `var(--font-sans), var(--font-cjk-sans), 'PingFang SC', sans-serif`;
    case "consulting":
      return `var(--font-sans), var(--font-cjk-sans), 'Microsoft YaHei', sans-serif`;
    default:
      return `var(--font-sans), var(--font-cjk-sans), 'PingFang SC', sans-serif`;
  }
}

export function getBodyFontFamily(mood: TypographyMood): string {
  if (mood === "chinese") {
    return `var(--font-cjk-sans), 'PingFang SC', var(--font-sans), sans-serif`;
  }
  return `var(--font-sans), var(--font-cjk-sans), 'PingFang SC', sans-serif`;
}

export interface SlideRenderContext {
  spec: VisualSpec;
  palette: VisualPalette;
  typography: VisualTypography;
  layout: VisualLayout;
  slideType: SlideType;
  topic: string;
  subtitle: string;
  audience: string;
  englishTitle: string;
  scenario: string;
  highlightDimension: AnatomyDimension | null;
  slideData?: Partial<DeckSlideItem>;
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  isBrutalist: boolean;
  isBauhaus: boolean;
  isChinese: boolean;
  isSwiss: boolean;
  isKeynote: boolean;
  isConsulting: boolean;
  isAcademic: boolean;
  isBlueprint: boolean;
  isBento: boolean;
  isTerminal: boolean;
  isClinical: boolean;
  isEditorial: boolean;
  isEmerald: boolean;
  isChalkboard: boolean;
  isScientific: boolean;
  isCivic: boolean;
  isPmo: boolean;
  isPolaroid: boolean;
  padX: number;
  padY: number;
  radius: number;
  cardStyle: React.CSSProperties;
  effectiveTotalPages: number;
  outline: SlideOutlineItem[];
  currentPageLabel: string;
}

export function buildSlideRenderContext(
  props: SlideCanvasProps
): SlideRenderContext {
  const {
    spec,
    slideType,
    topic,
    subtitle,
    audience = "核心决策团队",
    slideCount = 12,
    englishTitle = "Presentation System",
    scenario = "商业演示",
    highlightDimension = null,
    slideData,
    pageIndex,
    totalPages,
  } = props;

  const { palette, typography, layout } = spec;
  const headingFont = getHeadingFontFamily(typography.mood);
  const bodyFont = getBodyFontFamily(typography.mood);
  const monoFont = `var(--font-mono), ui-monospace, monospace`;

  const isBrutalist =
    layout.archetype === "brutalist-poster" ||
    layout.decorativeMotif === "hard-offset";
  const isBauhaus = layout.archetype === "retro-bauhaus";
  const isChinese = layout.archetype === "neo-chinese";
  const isSwiss = layout.archetype === "swiss-grid";
  const isKeynote = layout.archetype === "keynote-center";
  const isConsulting = layout.archetype === "consulting-mbb";
  const isAcademic = layout.archetype === "academic-paper";
  const isBlueprint = layout.archetype === "tech-blueprint";
  const isBento = layout.archetype === "soft-bento";
  const isTerminal = layout.archetype === "financial-terminal";
  const isClinical = layout.archetype === "clinical-clean";
  const isEditorial =
    layout.archetype === "editorial-asymmetric" ||
    layout.archetype === "luxury-minimal";
  const isEmerald = layout.archetype === "executive-emerald";
  const isChalkboard = layout.archetype === "chalkboard-class";
  const isScientific = layout.archetype === "scientific-figure";
  const isCivic = layout.archetype === "civic-redgold";
  const isPmo = layout.archetype === "pmo-rag-grid";
  const isPolaroid = layout.archetype === "polaroid-zine";

  const padX =
    layout.density === "airy" ? 68 : layout.density === "dense" ? 44 : 56;
  const padY =
    layout.density === "airy" ? 56 : layout.density === "dense" ? 38 : 48;
  const radius = layout.cornerRadius;

  const cardStyle: React.CSSProperties = {
    background: isScientific ? "transparent" : palette.surface,
    border: isBrutalist
      ? `2.5px solid ${palette.border}`
      : isChalkboard
      ? `1.5px dashed ${palette.border}`
      : isScientific
      ? `1px solid ${palette.border}`
      : isBauhaus
      ? `1.5px solid ${palette.border}`
      : `1px solid ${palette.border}`,
    borderRadius: `${radius}px`,
    boxShadow: isBrutalist
      ? `5px 5px 0px ${palette.border}`
      : isPolaroid
      ? `0 8px 22px rgba(44, 34, 30, 0.09)`
      : isBento
      ? `0 6px 20px rgba(17, 20, 24, 0.05)`
      : "none",
  };

  const effectiveTotalPages = Math.max(5, totalPages ?? slideCount);
  const outline = buildAdaptiveOutline(effectiveTotalPages, topic);

  const pageNumMap: Record<SlideType, string> = {
    cover: "01",
    agenda: "02",
    process: "03",
    "image-split": "04",
    data: "05",
    "funnel-donut": "06",
    comparison: "07",
    swot: "08",
    timeline: "09",
    "team-grid": "10",
    quote: "11",
    closing: String(effectiveTotalPages).padStart(2, "0"),
  };

  const currentPageLabel =
    pageIndex !== undefined
      ? String(pageIndex + 1).padStart(2, "0")
      : pageNumMap[slideType];

  return {
    spec,
    palette,
    typography,
    layout,
    slideType,
    topic,
    subtitle,
    audience,
    englishTitle,
    scenario,
    highlightDimension,
    slideData,
    headingFont,
    bodyFont,
    monoFont,
    isBrutalist,
    isBauhaus,
    isChinese,
    isSwiss,
    isKeynote,
    isConsulting,
    isAcademic,
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
    padX,
    padY,
    radius,
    cardStyle,
    effectiveTotalPages,
    outline,
    currentPageLabel,
  };
}
