"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Download,
  FileUp,
  Palette,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  Wrench,
} from "lucide-react";
import AiAmbientAccent from "@/components/AiAmbientAccent";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { saveDocIntakeHandoff } from "@/lib/docIntakeHandoff";
import {
  autoFixPaletteContrast,
  evaluatePaletteContrast,
  extractStyleFromImageData,
} from "@/lib/paletteExtractor";
import { compilePrompt } from "@/lib/promptCompiler";
import {
  MATERIAL_KIND_LABELS,
  type DocumentAnalysisResult,
  type OutlineDraftItem,
  type PromptItem,
  type VisualPalette,
} from "@/types/prompt";
import "@/styles/tools.css";

type ToolTab = "pacing" | "pptx-inspect" | "palette-wcag" | "visual-director";

interface ToolsClientProps {
  styles: PromptItem[];
}

interface ParsedPptxSummary {
  fileName: string;
  charCount: number;
  slideCount: number;
  text: string;
  suggestedTopic: string;
  suggestedSubtitle: string;
  parsedOutline?: OutlineDraftItem[];
  analysis?: DocumentAnalysisResult;
}

const DEFAULT_PALETTE: VisualPalette = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#475569",
  accent: "#2563EB",
  accentSoft: "rgba(37, 99, 235, 0.12)",
  border: "#E2E8F0",
  chartColors: ["#2563EB", "#0F172A", "#64748B", "#CBD5E1"],
};

function countSpeechUnits(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  const cjk = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (
    clean.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g) || []
  ).length;
  return cjk + words;
}

export default function ToolsClient({ styles }: ToolsClientProps) {
  const router = useRouter();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<ToolTab>("pacing");

  // 1. Talk-Time & Pacing Calculator
  const [scriptText, setScriptText] = useState(
    "各位评审专家大家好，今天我将围绕新一代 AI 知识引擎的架构演进与季度实测成果进行汇报。\n\n首先看背景痛点：企业在多源文档检索中普遍存在响应慢、权限穿透与幻觉率偏高的问题。\n\n我们通过混合图谱检索与行级权限沙箱，将 P99 延迟压降至 18ms，复杂问答准确率提升 146%。"
  );
  const [paceSlides, setPaceSlides] = useState(10);
  const [paceRate, setPaceRate] = useState<180 | 210 | 240>(210);

  const pacingStats = useMemo(() => {
    const units = countSpeechUnits(scriptText);
    const totalSeconds =
      units > 0 ? Math.round((units / paceRate) * 60) : paceSlides * 45;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const secPerSlide = Math.round(totalSeconds / Math.max(1, paceSlides));
    const unitsPerSlide = Math.round(units / Math.max(1, paceSlides));
    return {
      units,
      mins,
      secs,
      secPerSlide,
      unitsPerSlide,
      isDense: unitsPerSlide > 260,
    };
  }, [scriptText, paceSlides, paceRate]);

  // 2. Local PPTX Diagnostics & Notes Extractor
  const pptxInputRef = useRef<HTMLInputElement | null>(null);
  const [parsingPptx, setParsingPptx] = useState(false);
  const [pptxResult, setPptxResult] = useState<ParsedPptxSummary | null>(null);

  const handleInspectPptx = async (file: File) => {
    if (parsingPptx) return;
    setParsingPptx(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "文件解析失败", "error");
        return;
      }
      setPptxResult({
        fileName: data.fileName || file.name,
        charCount: Number(data.charCount) || String(data.text || "").length,
        slideCount:
          Number(data.slideCount) ||
          (Array.isArray(data.parsedOutline) ? data.parsedOutline.length : 8),
        text: String(data.text || ""),
        suggestedTopic: data.suggestedTopic || file.name,
        suggestedSubtitle: data.suggestedSubtitle || "",
        parsedOutline: Array.isArray(data.parsedOutline)
          ? data.parsedOutline
          : undefined,
        analysis: data.analysis,
      });
      showToast(`已完成「${file.name}」结构体检`, "success");
    } catch {
      showToast("解析异常，请稍后重试", "error");
    } finally {
      setParsingPptx(false);
    }
  };

  const handleDownloadNotes = () => {
    if (!pptxResult) return;
    const blob = new Blob([pptxResult.text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pptxResult.fileName.replace(/\.[^.]+$/, "")}-notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出文档全文与演讲备注", "success");
  };

  const handleSendToWorkshop = () => {
    if (!pptxResult) return;
    const topSlug =
      pptxResult.analysis?.recommendedStyles?.[0]?.slug ||
      styles[0]?.slug ||
      "swiss-international-grid";
    saveDocIntakeHandoff({
      fileName: pptxResult.fileName,
      fileType: "pptx",
      charCount: pptxResult.charCount,
      text: pptxResult.text,
      topic: pptxResult.suggestedTopic,
      subtitle: pptxResult.suggestedSubtitle,
      audience: pptxResult.analysis?.suggestedAudience || "核心受众",
      slideCount: pptxResult.slideCount,
      styleSlug: topSlug,
      autoGenerate: true,
      parsedOutline: pptxResult.parsedOutline,
      analysis: pptxResult.analysis,
    });
    router.push(`/generate?style=${encodeURIComponent(topSlug)}&intake=1`);
  };

  // 3. Brand Image Palette Extractor & WCAG Projector Audit
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const [palette, setPalette] = useState<VisualPalette>(DEFAULT_PALETTE);
  const [extractedSource, setExtractedSource] = useState<string>("");
  const [paletteCopied, setPaletteCopied] = useState(false);

  const contrastReport = useMemo(
    () => evaluatePaletteContrast(palette),
    [palette]
  );

  const handleExtractImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 220 / Math.max(img.width, img.height, 1));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const extracted = extractStyleFromImageData(
          data.data,
          canvas.width,
          canvas.height
        );
        setPalette(extracted.palette);
        setExtractedSource(file.name);
        showToast(`已从「${file.name}」提取 WCAG 校核配色板`, "success");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("图片读取失败，请更换 PNG / JPG 图片", "error");
    };
    img.src = url;
  };

  const handleCopyPaletteCss = async () => {
    const css = `:root {\n  --ppt-bg: ${palette.bg};\n  --ppt-surface: ${palette.surface};\n  --ppt-text: ${palette.text};\n  --ppt-muted: ${palette.muted};\n  --ppt-accent: ${palette.accent};\n  --ppt-border: ${palette.border};\n}`;
    try {
      await navigator.clipboard.writeText(css);
      setPaletteCopied(true);
      showToast("已复制 CSS 色板变量", "success");
      window.setTimeout(() => setPaletteCopied(false), 1600);
    } catch {
      showToast("剪贴板不可用", "error");
    }
  };

  // 4. Visual Director AI Slide Prompt Quick-Composer
  const [vdTopic, setVdTopic] = useState("2026 企业级 AI Agent 架构演进与落地实践");
  const [vdStyleSlug, setVdStyleSlug] = useState(
    styles[0]?.slug || "swiss-international-grid"
  );
  const [vdBatch, setVdBatch] = useState<false | 6 | 12>(6);
  const [vdDensity, setVdDensity] = useState<"airy" | "balanced" | "dense">("balanced");
  const [vdCopied, setVdCopied] = useState(false);

  const activeVdStyle = useMemo(
    () => styles.find((s) => s.slug === vdStyleSlug) || styles[0],
    [styles, vdStyleSlug]
  );

  const vdPrompt = useMemo(() => {
    if (!activeVdStyle) return "";
    const tunedSpec = {
      ...activeVdStyle.visualSpec,
      layout: {
        ...activeVdStyle.visualSpec.layout,
        density: vdDensity,
      },
    };
    return compilePrompt(
      activeVdStyle,
      tunedSpec,
      {
        topic: vdTopic.trim() || activeVdStyle.sampleTopic,
        subtitle: activeVdStyle.sampleSubtitle,
        audience: "核心决策与评审团队",
        slideCount: vdBatch === 12 ? 12 : 6,
        language: "zh",
        tone: "executive",
        targetTool: "ai-image",
        aiImageBatchMode: vdBatch !== false,
        aiImageBatchCount: vdBatch === 12 ? 12 : 6,
      },
      "cover"
    );
  }, [activeVdStyle, vdTopic, vdBatch, vdDensity]);

  const handleCopyVdPrompt = async () => {
    try {
      await navigator.clipboard.writeText(vdPrompt);
      setVdCopied(true);
      showToast("已复制视觉导演 v2 生图提示词", "success");
      window.setTimeout(() => setVdCopied(false), 1600);
    } catch {
      showToast("剪贴板不可用", "error");
    }
  };

  const previewSpec = useMemo(
    () => ({
      palette,
      typography: {
        mood: "swiss" as const,
        headingFontLabel: "Plus Jakarta Sans",
        bodyFontLabel: "Noto Sans SC",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "soft-bento" as const,
        density: "balanced" as const,
        cornerRadius: 12,
        showPageNumber: true,
        decorativeMotif: "bento-dots" as const,
      },
    }),
    [palette]
  );

  const handleExportStyleJson = () => {
    const payload = {
      schema: "pptgod-style-v1",
      title: extractedSource
        ? `${extractedSource.replace(/\.[^.]+$/, "").slice(0, 20)} 品牌主题`
        : "自定义 WCAG 品牌主题",
      englishTitle: "CUSTOM BRAND THEME",
      scenario: "品牌提案",
      visualSpec: previewSpec,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brand-theme.pptgod.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出 .pptgod.json 风格包，可在「发布风格」直接导入", "success");
  };

  return (
    <main className="pg-page">
      <div className="pg-container pg-tools-page">
        <header className="pg-tools-header">
          <div>
            <p className="pg-kicker">PPTGOD LOCAL TOOLBOX</p>
            <h1 className="pg-subpage-title">PPT 效率工具箱</h1>
            <p className="pg-tools-sub">
              纯本地即时运算，不留存私有文件 · 专注汇报前的节奏、可读性与换肤准备
            </p>
          </div>

          <div
            className="pg-tools-tabs"
            role="tablist"
            aria-label="切换 PPT 效率工具"
          >
            <button
              type="button"
              role="tab"
              id="pg-tool-tab-pacing"
              aria-selected={activeTab === "pacing"}
              className={`pg-tools-tab ${activeTab === "pacing" ? "is-active" : ""}`}
              onClick={() => setActiveTab("pacing")}
            >
              <Clock size={14} />
              <span>时长节拍</span>
            </button>
            <button
              type="button"
              role="tab"
              id="pg-tool-tab-pptx"
              aria-selected={activeTab === "pptx-inspect"}
              className={`pg-tools-tab ${
                activeTab === "pptx-inspect" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("pptx-inspect")}
            >
              <FileUp size={14} />
              <span>PPTX 体检</span>
            </button>
            <button
              type="button"
              role="tab"
              id="pg-tool-tab-palette"
              aria-selected={activeTab === "palette-wcag"}
              className={`pg-tools-tab ${
                activeTab === "palette-wcag" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("palette-wcag")}
            >
              <Palette size={14} />
              <span>抽色体检</span>
            </button>
            <button
              type="button"
              role="tab"
              id="pg-tool-tab-director"
              aria-selected={activeTab === "visual-director"}
              className={`pg-tools-tab ${
                activeTab === "visual-director" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("visual-director")}
            >
              <Wand2 size={14} />
              <span>生图导演词</span>
            </button>
          </div>
        </header>

        <section
          className="pg-tools-stage"
          key={activeTab}
          aria-live="polite"
        >
          <AiAmbientAccent variant="panel-corner" />

          {/* Tool 1: Talk-Time & Pacing Calculator */}
          {activeTab === "pacing" && (
            <div className="pg-tools-grid" id="pg-tools-pacing-panel">
              <div className="pg-form">
                <div className="pg-form-2col">
                  <div className="pg-field">
                    <label htmlFor="pg-pace-slides">总页数（{paceSlides} 页）</label>
                    <input
                      id="pg-pace-slides"
                      type="range"
                      min={3}
                      max={40}
                      value={paceSlides}
                      onChange={(e) => setPaceSlides(Number(e.target.value))}
                      className="pg-range"
                    />
                  </div>
                  <div className="pg-field">
                    <label>目标语速</label>
                    <div className="pg-segmented">
                      {(
                        [
                          { rate: 180, label: "学术慢速" },
                          { rate: 210, label: "标准汇报" },
                          { rate: 240, label: "路演快节奏" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.rate}
                          type="button"
                          className={`pg-seg-btn ${
                            paceRate === opt.rate ? "is-active" : ""
                          }`}
                          onClick={() => setPaceRate(opt.rate)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pg-field">
                  <label htmlFor="pg-pace-script">
                    粘贴讲稿或大纲正文（本地即时测算）
                  </label>
                  <textarea
                    id="pg-pace-script"
                    rows={8}
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="粘贴你的演讲逐字稿、提纲或每页备注..."
                  />
                </div>
              </div>

              <div className="pg-tools-metric-panel">
                <div className="pg-tools-kpi-hero" id="pg-pace-result">
                  <span className="pg-tools-kpi-eyebrow">预计总时长</span>
                  <div className="pg-tools-kpi-num">
                    {pacingStats.mins} 分 {String(pacingStats.secs).padStart(2, "0")} 秒
                  </div>
                  <span className="pg-tools-kpi-note">
                    {pacingStats.units} 有效字词 · {paceRate} 字/分钟
                  </span>
                </div>

                <div className="pg-tools-stat-row">
                  <div className="pg-tools-stat-card">
                    <span>均页耗时</span>
                    <strong>{pacingStats.secPerSlide} 秒 / 页</strong>
                  </div>
                  <div className="pg-tools-stat-card">
                    <span>均页字数</span>
                    <strong>{pacingStats.unitsPerSlide} 字 / 页</strong>
                  </div>
                </div>

                <div
                  className={`pg-tools-advice ${
                    pacingStats.isDense ? "is-warn" : "is-ok"
                  }`}
                >
                  <ShieldCheck size={15} />
                  <span>
                    {pacingStats.isDense
                      ? "均页讲稿偏密（>260 字/页），建议拆页或压缩至每页 1 句核心结论"
                      : "节奏均衡，适合大多数 45–90 秒/页的清晰汇报节奏"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tool 2: Old PPTX Diagnostics & Notes Extractor */}
          {activeTab === "pptx-inspect" && (
            <div className="pg-tools-stack" id="pg-tools-pptx-panel">
              <div className="pg-tools-dropzone">
                <input
                  ref={pptxInputRef}
                  id="pg-tools-pptx-input"
                  type="file"
                  accept=".pptx,.pdf,.docx,.md,.txt"
                  className="pg-upload-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleInspectPptx(file);
                    e.target.value = "";
                  }}
                />
                <div className="pg-tools-drop-info">
                  <FileUp size={20} style={{ color: "var(--accent)" }} />
                  <div>
                    <div className="pg-tools-drop-title">
                      上传旧 .pptx（或 PDF / Word），即时体检字数、时长与提取全文
                    </div>
                    <div className="pg-tools-drop-sub">
                      解析完成后可一键下载备注文本，或直接送入工坊 1:1 换肤
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pg-btn pg-btn-primary pg-btn-sm"
                  disabled={parsingPptx}
                  onClick={() => pptxInputRef.current?.click()}
                >
                  <Upload size={14} />
                  <span>{parsingPptx ? "解析中..." : "选择文件"}</span>
                </button>
              </div>

              {pptxResult && (
                <div className="pg-tools-pptx-result">
                  <div className="pg-tools-stat-row">
                    <div className="pg-tools-stat-card">
                      <span>识别页数</span>
                      <strong>{pptxResult.slideCount} 页</strong>
                    </div>
                    <div className="pg-tools-stat-card">
                      <span>提取正文</span>
                      <strong>{pptxResult.charCount} 字</strong>
                    </div>
                    <div className="pg-tools-stat-card">
                      <span>场景与材料</span>
                      <strong>
                        {pptxResult.analysis?.detectedScenario || "通用"} ·{" "}
                        {pptxResult.analysis?.materialKind
                          ? MATERIAL_KIND_LABELS[pptxResult.analysis.materialKind].label
                          : "文档"}
                      </strong>
                    </div>
                  </div>

                  <div className="pg-btn-group">
                    <button
                      type="button"
                      className="pg-btn pg-btn-primary pg-btn-sm"
                      onClick={handleSendToWorkshop}
                    >
                      <Sparkles size={14} />
                      <span>送入工坊一键换肤</span>
                      <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="pg-btn pg-btn-secondary pg-btn-sm"
                      onClick={handleDownloadNotes}
                    >
                      <Download size={14} />
                      <span>导出全文 / 备注 (.txt)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tool 3: Brand Palette Extractor + WCAG Projector Audit */}
          {activeTab === "palette-wcag" && (
            <div className="pg-tools-grid" id="pg-tools-palette-panel">
              <div className="pg-form">
                <input
                  ref={imgInputRef}
                  id="pg-tools-img-input"
                  type="file"
                  accept="image/*"
                  className="pg-upload-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleExtractImage(file);
                    e.target.value = "";
                  }}
                />
                <div className="pg-btn-group" style={{ alignItems: "center" }}>
                  <button
                    type="button"
                    className="pg-btn pg-btn-primary pg-btn-sm"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>上传品牌图 / 海报抽色</span>
                  </button>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={() => {
                      setPalette(autoFixPaletteContrast(palette));
                      showToast("已校正至 WCAG AA 投影标准", "success");
                    }}
                  >
                    <Wrench size={14} />
                    <span>一键校正对比度</span>
                  </button>
                  <button
                    type="button"
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    onClick={handleCopyPaletteCss}
                  >
                    {paletteCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{paletteCopied ? "已复制" : "复制 CSS"}</span>
                  </button>
                  <button
                    type="button"
                    id="pg-tools-export-style-json"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={handleExportStyleJson}
                  >
                    <Download size={14} />
                    <span>导出 .pptgod.json</span>
                  </button>
                </div>

                {extractedSource && (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-muted)" }}>
                    当前来源：{extractedSource}
                  </p>
                )}

                <div className="pg-tools-swatches">
                  {(
                    [
                      { key: "bg", label: "画布底色" },
                      { key: "surface", label: "卡片表面" },
                      { key: "text", label: "主文字" },
                      { key: "accent", label: "品牌强调" },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="pg-tools-swatch-card">
                      <input
                        type="color"
                        value={palette[item.key].startsWith("#") ? palette[item.key] : "#2563EB"}
                        onChange={(e) =>
                          setPalette((prev) => ({
                            ...prev,
                            [item.key]: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                      <span>{item.label}</span>
                      <code>{palette[item.key]}</code>
                    </label>
                  ))}
                </div>

                <div className="pg-tools-advice is-ok">
                  <ShieldCheck size={15} />
                  <span>
                    投影可读性：<strong>WCAG {contrastReport.overallGrade}</strong> · 正文对比度{" "}
                    {contrastReport.textBgRatio.toFixed(1)}:1 · 强调色{" "}
                    {contrastReport.accentBgRatio.toFixed(1)}:1
                  </span>
                </div>
              </div>

              <div className="pg-tools-canvas-preview">
                <SlideCanvas
                  spec={previewSpec}
                  slideType="data"
                  topic="品牌配色实时投影效果验证"
                  subtitle="检查标题、数据图表与留白的真实视觉对比"
                  englishTitle="WCAG PALETTE PREVIEW"
                  scenario="品牌提案"
                />
              </div>
            </div>
          )}

          {/* Tool 4: Visual Director AI Slide Prompt Quick-Composer */}
          {activeTab === "visual-director" && activeVdStyle && (
            <div className="pg-tools-stack" id="pg-tools-director-panel">
              <div className="pg-tools-director-bar">
                <input
                  id="pg-tools-vd-topic"
                  type="text"
                  className="pg-live-topic-input"
                  value={vdTopic}
                  onChange={(e) => setVdTopic(e.target.value)}
                  placeholder="输入你的汇报主题..."
                />
                <select
                  id="pg-tools-vd-style"
                  className="pg-select"
                  value={activeVdStyle.slug}
                  onChange={(e) => setVdStyleSlug(e.target.value)}
                >
                  {styles.map((st) => (
                    <option key={st.id} value={st.slug}>
                      {st.title}
                    </option>
                  ))}
                </select>
                <select
                  id="pg-tools-vd-density"
                  className="pg-select"
                  aria-label="留白与证据密度"
                  value={vdDensity}
                  onChange={(e) =>
                    setVdDensity(e.target.value as "airy" | "balanced" | "dense")
                  }
                >
                  <option value="airy">轻巧高留白</option>
                  <option value="balanced">均衡密度</option>
                  <option value="dense">高证据密排</option>
                </select>
                <div className="pg-segmented">
                  {(
                    [
                      { v: false, label: "单页" },
                      { v: 6, label: "6 页" },
                      { v: 12, label: "12 页" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.v)}
                      type="button"
                      className={`pg-seg-btn ${vdBatch === opt.v ? "is-active" : ""}`}
                      onClick={() => setVdBatch(opt.v)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  id="pg-tools-vd-copy"
                  className="pg-btn pg-btn-primary pg-btn-sm"
                  onClick={handleCopyVdPrompt}
                >
                  {vdCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{vdCopied ? "已复制" : "复制生图词"}</span>
                </button>
              </div>

              <textarea
                id="pg-tools-vd-output"
                className="pg-prompt-codebox"
                readOnly
                rows={12}
                value={vdPrompt}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
