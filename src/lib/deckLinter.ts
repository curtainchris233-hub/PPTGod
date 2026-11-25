import {
  evaluatePaletteContrast,
  type PaletteContrastReport,
} from "@/lib/paletteExtractor";
import { SLIDE_TYPE_LABELS, type DeckSlideItem, type VisualSpec } from "@/types/prompt";

export type DeckLintSeverity = "high" | "medium" | "low";

export type DeckLintFixAction = "autofix-contrast" | "autofix-notes" | "jump-slide";

export interface DeckLintIssue {
  id: string;
  category: "contrast" | "density" | "structure" | "notes";
  severity: DeckLintSeverity;
  slideIndex?: number;
  title: string;
  detail: string;
  fixAction: DeckLintFixAction;
  fixLabel: string;
}

export interface DeckAuditReport {
  score: number;
  grade: "A" | "B" | "C" | "D";
  estimatedMinutes: number;
  totalNotesChars: number;
  missingNotesCount: number;
  contrast: PaletteContrastReport;
  issues: DeckLintIssue[];
  passedChecks: string[];
}

function countReadableUnits(text: string): number {
  const clean = (text || "").trim();
  if (!clean) return 0;
  const cjk = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (clean.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g) || []).length;
  return cjk + words;
}

export function auditDeckQuality(
  slides: DeckSlideItem[],
  spec: VisualSpec,
  meta: { topic?: string; audience?: string } = {}
): DeckAuditReport {
  const contrast = evaluatePaletteContrast(spec.palette);
  const issues: DeckLintIssue[] = [];
  const passedChecks: string[] = [];

  let penalty = 0;

  // 1. Visual & Projector Contrast (max 25 pts)
  if (contrast.textBgRatio < 4.5 || contrast.textSurfaceRatio < 4.5) {
    penalty += 18;
    issues.push({
      id: "contrast-text",
      category: "contrast",
      severity: "high",
      title: `正文对比度不足（${Math.min(contrast.textBgRatio, contrast.textSurfaceRatio).toFixed(1)}:1）`,
      detail: "低于 WCAG AA 4.5:1 基线，在明亮会议室或教室投影仪上容易发灰难读。",
      fixAction: "autofix-contrast",
      fixLabel: "一键校正对比度",
    });
  } else if (contrast.accentBgRatio < 3.2) {
    penalty += 8;
    issues.push({
      id: "contrast-accent",
      category: "contrast",
      severity: "medium",
      title: `品牌强调色区分度偏低（${contrast.accentBgRatio.toFixed(1)}:1）`,
      detail: "强调色与背景接近，建议提高饱和度或深浅对比以突出结论。",
      fixAction: "autofix-contrast",
      fixLabel: "一键校正强调色",
    });
  } else {
    passedChecks.push(
      `投影可读性通过 WCAG ${contrast.overallGrade}（正文 ${contrast.textBgRatio.toFixed(1)}:1）`
    );
  }

  // 2. Per-slide cognitive load & text overflow (max 30 pts)
  let densityIssuesCount = 0;
  slides.forEach((slide, idx) => {
    const pageNo = idx + 1;
    const titleLen = (slide.title || "").trim().length;
    if (titleLen === 0) {
      densityIssuesCount += 1;
      penalty += 6;
      issues.push({
        id: `empty-title-${idx}`,
        category: "density",
        severity: "high",
        slideIndex: idx,
        title: `P${String(pageNo).padStart(2, "0")} 缺少主标题`,
        detail: "每页建议配置 1 句结论先行标题，帮助听众 3 秒内抓住重点。",
        fixAction: "jump-slide",
        fixLabel: `跳至第 ${pageNo} 页`,
      });
    } else if (titleLen > 28) {
      densityIssuesCount += 1;
      penalty += 5;
      issues.push({
        id: `long-title-${idx}`,
        category: "density",
        severity: "medium",
        slideIndex: idx,
        title: `P${String(pageNo).padStart(2, "0")} 标题偏长（${titleLen} 字）`,
        detail: "建议压缩至 24 字以内，避免多行折行挤压下方图表空间。",
        fixAction: "jump-slide",
        fixLabel: `精简第 ${pageNo} 页`,
      });
    }

    const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
    const longBullet = bullets.find((b) => (b || "").trim().length > 52);
    if (longBullet) {
      densityIssuesCount += 1;
      penalty += 5;
      issues.push({
        id: `long-bullet-${idx}`,
        category: "density",
        severity: "medium",
        slideIndex: idx,
        title: `P${String(pageNo).padStart(2, "0")} 存在超长段落要点（${longBullet.trim().length} 字）`,
        detail: "单条要点超过 50 字容易形成“文字墙”，建议拆为短句或转入演讲者备注。",
        fixAction: "jump-slide",
        fixLabel: `优化第 ${pageNo} 页`,
      });
    } else if (bullets.length > 5) {
      densityIssuesCount += 1;
      penalty += 4;
      issues.push({
        id: `too-many-bullets-${idx}`,
        category: "density",
        severity: "low",
        slideIndex: idx,
        title: `P${String(pageNo).padStart(2, "0")} 要点数偏多（${bullets.length} 条）`,
        detail: "单页建议聚焦 3–4 条关键论点以保留呼吸留白。",
        fixAction: "jump-slide",
        fixLabel: `精简第 ${pageNo} 页`,
      });
    }
  });
  if (densityIssuesCount === 0 && slides.length > 0) {
    passedChecks.push("全部页面字数克制，无“文字墙”溢出风险");
  }

  // 3. Narrative arc & layout variety (max 25 pts)
  let structureOk = true;
  if (slides.length >= 3) {
    if (slides[0].slideType !== "cover") {
      structureOk = false;
      penalty += 6;
      issues.push({
        id: "missing-cover",
        category: "structure",
        severity: "medium",
        slideIndex: 0,
        title: "首页不是封面版式（cover）",
        detail: "建议第 1 页使用封面页确立演示主题与听众预期。",
        fixAction: "jump-slide",
        fixLabel: "检查第 1 页",
      });
    }
    if (slides[slides.length - 1].slideType !== "closing") {
      structureOk = false;
      penalty += 5;
      issues.push({
        id: "missing-closing",
        category: "structure",
        severity: "low",
        slideIndex: slides.length - 1,
        title: "尾页缺少总结收口（closing）",
        detail: "建议最后一页切换为结尾页，明确行动呼吁或致谢答疑。",
        fixAction: "jump-slide",
        fixLabel: `检查第 ${slides.length} 页`,
      });
    }
  }

  for (let i = 2; i < slides.length; i++) {
    if (
      slides[i].slideType === slides[i - 1].slideType &&
      slides[i - 1].slideType === slides[i - 2].slideType
    ) {
      structureOk = false;
      penalty += 7;
      const typeLabel = SLIDE_TYPE_LABELS[slides[i].slideType]?.label || slides[i].slideType;
      issues.push({
        id: `repeat-layout-${i}`,
        category: "structure",
        severity: "medium",
        slideIndex: i,
        title: `P${String(i - 1).padStart(2, "0")}–P${String(i + 1).padStart(2, "0")} 连续 3 页使用「${typeLabel}」`,
        detail: "连续重复版式容易引发听众视觉疲劳，建议穿插对比页、图表页或金句页。",
        fixAction: "jump-slide",
        fixLabel: `切换第 ${i + 1} 页版式`,
      });
      break;
    }
  }
  if (structureOk && slides.length > 0) {
    passedChecks.push(`全篇 ${slides.length} 页起承转合完整，版式节奏富有变化`);
  }

  // 4. Presenter readiness & pacing (max 20 pts)
  let missingNotesCount = 0;
  let totalNotesChars = 0;
  slides.forEach((s) => {
    const notes = (s.speakerNotes || "").trim();
    if (notes.length < 8) {
      missingNotesCount += 1;
    } else {
      totalNotesChars += countReadableUnits(notes);
    }
  });

  if (missingNotesCount > 0) {
    penalty += Math.min(18, missingNotesCount * 4);
    issues.push({
      id: "missing-speaker-notes",
      category: "notes",
      severity: missingNotesCount >= Math.ceil(slides.length / 2) ? "high" : "medium",
      title: `有 ${missingNotesCount} 页缺少演讲者备注`,
      detail: `补全逐页口语提词后，可在 /deck 演播台开启排练提词模式与精准倒计时（目标听众：${meta.audience || "听众"}）。`,
      fixAction: "autofix-notes",
      fixLabel: `一键补齐 ${missingNotesCount} 页讲稿`,
    });
  } else if (slides.length > 0) {
    passedChecks.push("全部页面均已配齐演讲者提词备注");
  }

  // Estimate speaking duration: ~210 units/min (fallback 0.8 min/slide when notes absent)
  const notesMinutes = totalNotesChars / 210;
  const fallbackMinutes = missingNotesCount * 0.75;
  const estimatedMinutes = Math.max(
    1,
    Math.round((notesMinutes + fallbackMinutes) * 10) / 10
  );

  const score = Math.max(25, Math.min(100, 100 - penalty));
  const grade: "A" | "B" | "C" | "D" =
    score >= 90 ? "A" : score >= 78 ? "B" : score >= 62 ? "C" : "D";

  return {
    score,
    grade,
    estimatedMinutes,
    totalNotesChars,
    missingNotesCount,
    contrast,
    issues,
    passedChecks,
  };
}

export function autoFillMissingSpeakerNotes(
  slides: DeckSlideItem[],
  topic: string,
  audience: string
): DeckSlideItem[] {
  const safeTopic = (topic || "本场演示").trim();
  const safeAudience = (audience || "各位嘉宾").trim();

  return slides.map((slide, idx) => {
    if ((slide.speakerNotes || "").trim().length >= 8) {
      return slide;
    }
    const pageNo = idx + 1;
    const label = SLIDE_TYPE_LABELS[slide.slideType]?.label || "核心内容";
    const head = (slide.title || safeTopic).trim();
    const firstBullet = slide.bullets?.find((b) => b.trim())?.trim();

    let generated = "";
    if (slide.slideType === "cover") {
      generated = `各位${safeAudience}大家好，欢迎来到今天的分享。今天我将围绕「${head}」，在接下来的 ${slides.length} 页里为大家呈现核心洞察与落地路径。`;
    } else if (slide.slideType === "closing") {
      generated = `以上是关于「${safeTopic}」的全部汇报内容。核心行动建议已浓缩在本页，接下来非常欢迎各位${safeAudience}提问交流与指正。`;
    } else if (slide.slideType === "data" || slide.slideType === "funnel-donut") {
      const kpiHint = slide.kpis?.[0]
        ? `重点关注「${slide.kpis[0].label}：${slide.kpis[0].value}」这一核心指标，`
        : "";
      generated = `来到第 ${pageNo} 页「${head}」。${kpiHint}这组量化数据直接印证了我们的阶段性判断，建议结合图表趋势向${safeAudience}展开说明。`;
    } else {
      generated = `第 ${pageNo} 页（${label}）聚焦「${head}」。${
        firstBullet ? `请大家重点留意「${firstBullet.slice(0, 32)}」，` : ""
      }讲完本页后可自然承接下一页展开具体推进细节。`;
    }
    return {
      ...slide,
      speakerNotes: generated,
    };
  });
}
