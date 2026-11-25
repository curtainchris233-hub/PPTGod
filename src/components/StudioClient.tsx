"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  GitFork,
  Heart,
  Lock,
  Maximize2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildSampleDeckFromPrompt } from "@/lib/deckGenerator";
import { exportStandaloneHtmlDeck } from "@/lib/htmlExporter";
import {
  autoFixPaletteContrast,
  evaluatePaletteContrast,
  serializeStylePackJson,
} from "@/lib/paletteExtractor";
import { compilePrompt } from "@/lib/promptCompiler";
import { saveStudioHandoff } from "@/lib/studioHandoff";
import {
  ALL_SLIDE_TYPES,
  ANATOMY_META,
  SLIDE_TYPE_LABELS,
  TOOL_METADATA,
  getDefaultAudienceForScenario,
  type AnatomyDimension,
  type CustomizerParams,
  type PromptComment,
  type PromptItem,
  type SlideType,
  type TargetTool,
  type VisualSpec,
} from "@/types/prompt";
import "@/styles/studio-v2.css";

const ANATOMY_ORDER: AnatomyDimension[] = [
  "style",
  "palette",
  "typography",
  "layout",
  "content",
];

const ACCENT_PRESETS = [
  "#D9381E",
  "#1652B8",
  "#1B4D3E",
  "#0F766E",
  "#B85D3B",
  "#881337",
  "#38BDF8",
  "#DEC497",
  "#FF5A1F",
  "#0066CC",
  "#F59E0B",
];

interface StudioClientProps {
  initialPrompt: PromptItem;
  initialComments: PromptComment[];
}

export default function StudioClient({
  initialPrompt,
  initialComments,
}: StudioClientProps) {
  const {
    user,
    syncVersion,
    openAuthModal,
    compareIds,
    toggleCompare,
    localFavoriteIds,
    toggleLocalFavorite,
    globalTopic,
    showToast,
  } = useApp();

  const [prompt, setPrompt] = useState<PromptItem>(initialPrompt);
  const [activeSlide, setActiveSlide] = useState<SlideType>("cover");
  const [fullscreen, setFullscreen] = useState(false);

  const [liveSpec, setLiveSpec] = useState<VisualSpec>(initialPrompt.visualSpec);

  const [hoveredDimension, setHoveredDimension] =
    useState<AnatomyDimension | null>(null);
  const [pinnedDimension, setPinnedDimension] =
    useState<AnatomyDimension | null>(null);

  const [params, setParams] = useState<CustomizerParams>({
    topic: globalTopic || initialPrompt.sampleTopic,
    subtitle: initialPrompt.sampleSubtitle,
    audience: getDefaultAudienceForScenario(initialPrompt.scenario),
    slideCount: 12,
    language: "zh",
    tone: "executive",
    targetTool: initialPrompt.recommendedTools[0] ?? "claude-html",
    aiImageBatchMode: false,
  });

  const [copied, setCopied] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  // Community Verified Reviews state
  const [comments, setComments] = useState<PromptComment[]>(initialComments);
  const [reviewTool, setReviewTool] = useState<TargetTool>(
    initialPrompt.recommendedTools[0] ?? "claude-html"
  );
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    fetch(`/api/prompts/${initialPrompt.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.prompt) setPrompt(d.prompt);
      })
      .catch(() => {});
  }, [user?.id, syncVersion, initialPrompt.id]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setActiveSlide((cur) => {
          const idx = ALL_SLIDE_TYPES.indexOf(cur);
          return ALL_SLIDE_TYPES[(idx + 1) % ALL_SLIDE_TYPES.length];
        });
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveSlide((cur) => {
          const idx = ALL_SLIDE_TYPES.indexOf(cur);
          return ALL_SLIDE_TYPES[
            (idx - 1 + ALL_SLIDE_TYPES.length) % ALL_SLIDE_TYPES.length
          ];
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const activeHighlight = hoveredDimension ?? pinnedDimension;
  const isCompared = compareIds.includes(prompt.id);
  const isFavorited = user
    ? Boolean(prompt.favoritedByMe)
    : localFavoriteIds.includes(prompt.id);
  const isOwner = Boolean(user && user.id === prompt.authorId);

  const compiledText = useMemo(
    () => compilePrompt(prompt, liveSpec, params, activeSlide),
    [prompt, liveSpec, params, activeSlide]
  );

  const specIsModified =
    JSON.stringify(liveSpec) !== JSON.stringify(prompt.visualSpec);

  const generateHref = `/generate?style=${encodeURIComponent(
    prompt.slug
  )}&topic=${encodeURIComponent(params.topic || prompt.sampleTopic)}&handoff=1`;

  const handleOpenGenerateWorkshop = () => {
    saveStudioHandoff({
      slug: prompt.slug,
      visualSpec: liveSpec,
      topic: params.topic || prompt.sampleTopic,
      subtitle: params.subtitle || prompt.sampleSubtitle,
      audience: params.audience || "核心管理层与业务伙伴",
      slideCount: params.slideCount || 12,
    });
  };

  const handleCopyPrompt = async () => {
    const ok = await copyTextToClipboard(compiledText);
    if (ok) {
      setCopied(true);
      showToast(
        `已复制 ${TOOL_METADATA[params.targetTool].shortName} 成品提示词`,
        "success"
      );
      window.setTimeout(() => setCopied(false), 2000);

      fetch(`/api/prompts/${prompt.id}/copy`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.copiesCount === "number") {
            setPrompt((prev) => ({ ...prev, copiesCount: data.copiesCount }));
          }
        })
        .catch(() => {});
    } else {
      showToast("剪贴板权限受限，请手动全选文本框复制", "error");
    }
  };

  const handleDownloadMd = () => {
    const blob = new Blob([compiledText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prompt.slug}-${params.targetTool}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出 Markdown 提示词文档", "success");
  };

  const handleExportSamplePptx = async () => {
    if (exportingPptx) return;
    setExportingPptx(true);
    try {
      const sampleSlides = buildSampleDeckFromPrompt(
        prompt,
        params.topic || prompt.sampleTopic,
        params.subtitle || prompt.sampleSubtitle
      );
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.topic || prompt.sampleTopic,
          subtitle: params.subtitle || prompt.sampleSubtitle,
          audience: params.audience,
          styleName: prompt.title,
          visualSpec: liveSpec,
          slides: sampleSlides,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "导出 .pptx 失败", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prompt.slug}-sample.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("已生成并下载 16:9 原生 .pptx 样板文件", "success");
    } catch {
      showToast("导出 .pptx 网络异常", "error");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleExportSampleHtml = () => {
    const sampleSlides = buildSampleDeckFromPrompt(
      prompt,
      params.topic || prompt.sampleTopic,
      params.subtitle || prompt.sampleSubtitle
    );
    const html = exportStandaloneHtmlDeck({
      title: params.topic || prompt.sampleTopic,
      subtitle: params.subtitle || prompt.sampleSubtitle,
      audience: params.audience,
      styleName: prompt.title,
      spec: liveSpec,
      slides: sampleSlides,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prompt.slug}-deck.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出离线交互 .html 演示包（支持键盘翻页与打印 PDF）", "success");
  };

  const handleLike = async () => {
    if (!user) {
      showToast("请先登录后点赞");
      openAuthModal("login");
      return;
    }
    const res = await fetch(`/api/prompts/${prompt.id}/like`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setPrompt((prev) => ({
        ...prev,
        likedByMe: data.liked,
        likesCount: data.likesCount,
      }));
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      const added = toggleLocalFavorite(prompt.id);
      showToast(
        added ? "已保存到本地收藏夹（登录可云端同步）" : "已移除本地收藏",
        added ? "success" : "default"
      );
      return;
    }
    const res = await fetch(`/api/prompts/${prompt.id}/favorite`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setPrompt((prev) => ({
        ...prev,
        favoritedByMe: data.favorited,
        savesCount: data.savesCount,
      }));
      showToast(
        data.favorited ? "已收藏至云端" : "已取消收藏",
        data.favorited ? "success" : "default"
      );
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("请先登录后发表实测评价");
      openAuthModal("login");
      return;
    }
    setReviewError("");
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testedTool: reviewTool,
          rating: reviewRating,
          content: reviewContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "发表评价失败");
        return;
      }
      setComments(data.comments ?? []);
      setReviewContent("");
      showToast("已发布你的实测评价，感谢分享！", "success");
    } catch {
      setReviewError("网络连接异常，请稍后重试");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (commentId: string) => {
    const res = await fetch(
      `/api/prompts/${prompt.id}/comments?commentId=${encodeURIComponent(
        commentId
      )}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
      showToast("已删除该条评价");
    }
  };

  const updateAccent = (hex: string) => {
    setLiveSpec((prev) => ({
      ...prev,
      palette: {
        ...prev.palette,
        accent: hex,
        chartColors: [
          hex,
          prev.palette.chartColors[1],
          prev.palette.chartColors[2],
          prev.palette.chartColors[3],
        ],
      },
    }));
  };

  const applySurfacePreset = (mode: "original" | "paper" | "pure" | "dark") => {
    if (mode === "original") {
      setLiveSpec(prompt.visualSpec);
      return;
    }
    if (mode === "paper") {
      setLiveSpec((prev) => ({
        ...prev,
        palette: {
          ...prev.palette,
          bg: "#F6F3EC",
          surface: "#FFFFFF",
          text: "#1C1917",
          muted: "#645D56",
          border: "#DED8CC",
        },
      }));
    } else if (mode === "pure") {
      setLiveSpec((prev) => ({
        ...prev,
        palette: {
          ...prev.palette,
          bg: "#FFFFFF",
          surface: "#F6F7F9",
          text: "#111827",
          muted: "#5B6472",
          border: "#E2E6EC",
        },
      }));
    } else if (mode === "dark") {
      setLiveSpec((prev) => ({
        ...prev,
        palette: {
          ...prev.palette,
          bg: "#0D1117",
          surface: "#161C26",
          text: "#F3F6FA",
          muted: "#95A2B4",
          border: "rgba(255,255,255,0.13)",
        },
      }));
    }
  };

  const currentIdx = ALL_SLIDE_TYPES.indexOf(activeSlide);
  const currentToolMeta = TOOL_METADATA[params.targetTool];

  return (
    <main className="pg-studio-page">
      <div className="pg-container">
        {/* Studio Header Bar */}
        <div className="pg-studio-topbar">
          <div className="pg-studio-crumbs">
            <Link href="/gallery" className="pg-back-link">
              <ArrowLeft size={15} />
              <span>风格画廊</span>
            </Link>
            <span className="pg-crumb-sep">/</span>
            {!prompt.isPublic && (
              <span className="pg-tag pg-tag-private" id="pg-studio-private-badge">
                <Lock size={11} />
                <span>私有</span>
              </span>
            )}
            <span className="pg-tag pg-tag-scenario">{prompt.scenario}</span>
          </div>

          <div className="pg-studio-header-actions">
            <Link
              href={generateHref}
              className="pg-btn pg-btn-primary pg-btn-sm"
              id="pg-studio-generate-btn"
              onClick={handleOpenGenerateWorkshop}
            >
              <Sparkles size={14} />
              <span>在线生成 PPT</span>
            </Link>

            <Link
              href={`/create?fork=${encodeURIComponent(prompt.slug)}`}
              className="pg-btn pg-btn-secondary pg-btn-sm"
              id="pg-studio-remix-btn"
            >
              <GitFork size={14} />
              <span>Remix</span>
            </Link>

            {isOwner && (
              <Link
                href={`/create?edit=${encodeURIComponent(prompt.slug)}`}
                className="pg-btn pg-btn-secondary pg-btn-sm"
                id="pg-studio-edit-btn"
              >
                <Pencil size={14} />
                <span>编辑</span>
              </Link>
            )}

            <button
              type="button"
              className={`pg-btn pg-btn-secondary pg-btn-sm ${
                prompt.likedByMe ? "is-liked-btn" : ""
              }`}
              onClick={handleLike}
              id="pg-studio-like-btn"
            >
              <Heart
                size={14}
                fill={prompt.likedByMe ? "currentColor" : "none"}
              />
              <span>{prompt.likesCount}</span>
            </button>

            <button
              type="button"
              className={`pg-btn pg-btn-secondary pg-btn-sm ${
                isFavorited ? "is-saved-btn" : ""
              }`}
              onClick={handleFavorite}
              id="pg-studio-fav-btn"
            >
              <Bookmark
                size={14}
                fill={isFavorited ? "currentColor" : "none"}
              />
              <span>{isFavorited ? "已收藏" : "收藏"}</span>
            </button>

            <button
              type="button"
              className={`pg-btn pg-btn-secondary pg-btn-sm ${
                isCompared ? "is-compared-btn" : ""
              }`}
              onClick={() => toggleCompare(prompt.id, prompt.title)}
              id="pg-studio-compare-btn"
            >
              <Columns2 size={14} />
              <span>{isCompared ? "已对比" : "对比"}</span>
            </button>
          </div>
        </div>

        {/* Title & Provenance Block */}
        <div className="pg-studio-title-block">
          <div>
            {prompt.remixedFrom && (
              <div className="pg-studio-provenance" id="pg-studio-remix-origin">
                <GitFork size={13} />
                <span>改编自</span>
                <Link href={`/studio/${prompt.remixedFrom.slug}`}>
                  {prompt.remixedFrom.title}
                </Link>
                {prompt.remixedFrom.authorDisplayName && (
                  <span>（@{prompt.remixedFrom.authorDisplayName}）</span>
                )}
              </div>
            )}
            <h1 className="pg-studio-h1">{prompt.title}</h1>
            <p className="pg-studio-summary" title={prompt.summary}>
              {prompt.summary}
            </p>
          </div>

          <Link
            href={`/creator/${prompt.author.username}`}
            className="pg-studio-author-card"
            id="pg-studio-author-link"
          >
            <span
              className="pg-avatar"
              style={{ background: prompt.author.avatarColor }}
            >
              {prompt.author.displayName.slice(0, 1)}
            </span>
            <div>
              <div className="pg-author-name">{prompt.author.displayName}</div>
              <div className="pg-author-meta">
                {prompt.copiesCount.toLocaleString()} 次复制 · {prompt.styleCategory}
              </div>
            </div>
          </Link>
        </div>

        {/* Main 2-Column Studio Workbench */}
        <div className="pg-studio-layout">
          {/* LEFT: 16:9 Stage + 12-Slide Filmstrip + Visual Tweaker + Prompt Anatomy + Verified Reviews */}
          <div className="pg-studio-left">
            <div className="pg-stage-frame">
              <div className="pg-stage-toolbar">
                <div className="pg-stage-slide-indicator">
                  <span className="pg-mono-pill">
                    {SLIDE_TYPE_LABELS[activeSlide].en}
                  </span>
                  <span className="pg-stage-slide-desc">
                    {SLIDE_TYPE_LABELS[activeSlide].label}
                  </span>
                </div>

                <div className="pg-stage-tools">
                  {pinnedDimension && (
                    <button
                      type="button"
                      className="pg-mini-action"
                      onClick={() => setPinnedDimension(null)}
                    >
                      <X size={13} />
                      <span>取消透视</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="pg-mini-action"
                    onClick={() => setFullscreen(true)}
                    id="pg-studio-fullscreen-btn"
                  >
                    <Maximize2 size={13} />
                    <span>全屏 (12页)</span>
                  </button>
                </div>
              </div>

              <div className="pg-stage-canvas-wrap">
                <div className="pg-canvas-motion-slot" key={activeSlide}>
                  <SlideCanvas
                    spec={liveSpec}
                    slideType={activeSlide}
                    topic={params.topic || prompt.sampleTopic}
                    subtitle={params.subtitle || prompt.sampleSubtitle}
                    audience={params.audience}
                    slideCount={params.slideCount}
                    englishTitle={prompt.englishTitle}
                    scenario={prompt.scenario}
                    highlightDimension={activeHighlight}
                  />
                </div>
              </div>

              {/* Quick Blueprint Anatomy Inspector Strip */}
              <div
                className="pg-blueprint-bar"
                role="group"
                aria-label="画布结构透视开关"
              >
                <span className="pg-blueprint-bar-label">
                  <Eye size={13} />
                  <span>透视：</span>
                </span>
                {ANATOMY_ORDER.map((dim) => {
                  const meta = ANATOMY_META[dim];
                  const active = activeHighlight === dim;
                  return (
                    <button
                      key={dim}
                      type="button"
                      className={`pg-blueprint-chip ${active ? "is-active" : ""}`}
                      style={
                        {
                          "--bp-color": meta.color,
                        } as React.CSSProperties
                      }
                      onMouseEnter={() => setHoveredDimension(dim)}
                      onMouseLeave={() => setHoveredDimension(null)}
                      onClick={() =>
                        setPinnedDimension((cur) => (cur === dim ? null : dim))
                      }
                    >
                      <span
                        className="pg-anatomy-dot"
                        style={{ background: meta.color }}
                      />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 12-Page Visual Filmstrip (4x3 Grid) */}
              <div
                className="pg-filmstrip pg-filmstrip-8"
                role="tablist"
                aria-label="12 种标准商业幻灯片样板"
              >
                {ALL_SLIDE_TYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="tab"
                    aria-selected={activeSlide === st}
                    aria-label={SLIDE_TYPE_LABELS[st].label}
                    className={`pg-film-thumb ${
                      activeSlide === st ? "is-active" : ""
                    }`}
                    onClick={() => setActiveSlide(st)}
                  >
                    <div className="pg-film-canvas" aria-hidden="true">
                      <SlideCanvas
                        spec={liveSpec}
                        slideType={st}
                        topic={params.topic || prompt.sampleTopic}
                        subtitle={params.subtitle || prompt.sampleSubtitle}
                        audience={params.audience}
                        slideCount={params.slideCount}
                        englishTitle={prompt.englishTitle}
                        scenario={prompt.scenario}
                      />
                    </div>
                    <span className="pg-film-label">
                      {SLIDE_TYPE_LABELS[st].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Visual Tweaker */}
            <section className="pg-panel" aria-label="视觉参数微调">
              <div className="pg-panel-head">
                <div className="pg-panel-title-wrap">
                  <Sliders size={15} />
                  <h2>实时视觉微调（画面、提示词与导出文件同步联动）</h2>
                </div>
                <div className="pg-btn-group">
                  {(() => {
                    const contrast = evaluatePaletteContrast(liveSpec.palette);
                    return (
                      <>
                        <span
                          id="pg-studio-wcag-pill"
                          className={`pg-wcag-pill pg-wcag-pill--${contrast.overallGrade.toLowerCase()}`}
                          title={`正文/底色 ${contrast.textBgRatio}:1 · 强调色/底色 ${contrast.accentBgRatio}:1`}
                        >
                          <ShieldCheck size={11} />
                          <span>
                            WCAG {contrast.overallGrade} · {contrast.textBgRatio.toFixed(1)}:1
                          </span>
                        </span>
                        {contrast.overallGrade === "WARN" && (
                          <button
                            type="button"
                            id="pg-studio-wcag-fix-btn"
                            className="pg-btn pg-btn-secondary pg-btn-xs"
                            onClick={() => {
                              setLiveSpec((prev) => ({
                                ...prev,
                                palette: autoFixPaletteContrast(prev.palette),
                              }));
                              showToast("已按 WCAG AA 投影标准校正配色对比度", "success");
                            }}
                          >
                            <Wrench size={11} />
                            <span>校正对比度</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <button
                    type="button"
                    id="pg-studio-export-json-btn"
                    className="pg-btn pg-btn-secondary pg-btn-xs"
                    onClick={() => {
                      const jsonStr = serializeStylePackJson(prompt, liveSpec);
                      const blob = new Blob([jsonStr], {
                        type: "application/json;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${prompt.slug}.pptgod.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast("已导出可移植风格包 (.pptgod.json)", "success");
                    }}
                    title="导出当前视觉设计系统 JSON，可在「发布风格」页面一键导入复用"
                  >
                    <FileJson size={12} />
                    <span>导出 .pptgod.json</span>
                  </button>
                  {specIsModified && (
                    <button
                      type="button"
                      className="pg-text-btn"
                      onClick={() => setLiveSpec(prompt.visualSpec)}
                    >
                      <RotateCcw size={13} />
                      <span>恢复原版风格</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="pg-tweaker-grid">
                <div className="pg-tweaker-item">
                  <span className="pg-tweaker-label">画布基底色调</span>
                  <div className="pg-btn-group">
                    {[
                      { id: "original", label: "原版" },
                      { id: "paper", label: "暖纸白" },
                      { id: "pure", label: "纯净白" },
                      { id: "dark", label: "深邃暗" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="pg-mini-pill"
                        onClick={() =>
                          applySurfacePreset(
                            opt.id as "original" | "paper" | "pure" | "dark"
                          )
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pg-tweaker-item">
                  <span className="pg-tweaker-label">
                    核心强调色 <code>{liveSpec.palette.accent}</code>
                  </span>
                  <div className="pg-accent-row">
                    {ACCENT_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={`pg-accent-dot ${
                          liveSpec.palette.accent.toLowerCase() ===
                          hex.toLowerCase()
                            ? "is-active"
                            : ""
                        }`}
                        style={{ background: hex }}
                        onClick={() => updateAccent(hex)}
                        aria-label={`切换强调色为 ${hex}`}
                      />
                    ))}
                    <label className="pg-color-picker-wrap" title="自定义强调色">
                      <input
                        type="color"
                        value={
                          liveSpec.palette.accent.startsWith("#")
                            ? liveSpec.palette.accent
                            : "#C84B31"
                        }
                        onChange={(e) => updateAccent(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="pg-tweaker-item">
                  <span className="pg-tweaker-label">信息密度与留白</span>
                  <div className="pg-btn-group">
                    {(
                      [
                        { id: "airy", label: "高留白" },
                        { id: "balanced", label: "均衡" },
                        { id: "dense", label: "高密度" },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`pg-mini-pill ${
                          liveSpec.layout.density === d.id ? "is-active" : ""
                        }`}
                        onClick={() =>
                          setLiveSpec((prev) => ({
                            ...prev,
                            layout: { ...prev.layout, density: d.id },
                          }))
                        }
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pg-tweaker-item">
                  <span className="pg-tweaker-label">
                    卡片圆角 <code>{liveSpec.layout.cornerRadius}px</code>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={2}
                    value={liveSpec.layout.cornerRadius}
                    onChange={(e) =>
                      setLiveSpec((prev) => ({
                        ...prev,
                        layout: {
                          ...prev.layout,
                          cornerRadius: Number(e.target.value),
                        },
                      }))
                    }
                    className="pg-range"
                  />
                </div>
              </div>
            </section>

            {/* Interactive Prompt Anatomy Breakdown */}
            <section className="pg-panel" aria-label="提示词视觉结构拆解">
              <div className="pg-panel-head">
                <div className="pg-panel-title-wrap">
                  <Eye size={15} />
                  <h2>提示词 5 维结构拆解（悬停或点击可在画布透视对应区域）</h2>
                </div>
              </div>

              <div className="pg-anatomy-list">
                {ANATOMY_ORDER.map((dim) => {
                  const meta = ANATOMY_META[dim];
                  const isActive = activeHighlight === dim;
                  const isPinned = pinnedDimension === dim;
                  return (
                    <button
                      key={dim}
                      type="button"
                      className={`pg-anatomy-item ${isActive ? "is-active" : ""}`}
                      style={
                        {
                          "--anatomy-color": meta.color,
                        } as React.CSSProperties
                      }
                      onMouseEnter={() => setHoveredDimension(dim)}
                      onMouseLeave={() => setHoveredDimension(null)}
                      onClick={() =>
                        setPinnedDimension((cur) => (cur === dim ? null : dim))
                      }
                    >
                      <div className="pg-anatomy-head">
                        <span className="pg-anatomy-badge">
                          <span
                            className="pg-anatomy-dot"
                            style={{ background: meta.color }}
                          />
                          <span>{meta.label}</span>
                        </span>
                        <span className="pg-anatomy-en">
                          {isPinned ? "已锁定透视 · 点击取消" : meta.en}
                        </span>
                      </div>
                      <p className="pg-anatomy-text">
                        {prompt.promptAnatomy[dim]}
                      </p>
                    </button>
                  );
                })}
              </div>

              {prompt.customNotes && (
                <div className="pg-studio-note">
                  <strong>适用建议：</strong>
                  {prompt.customNotes}
                </div>
              )}
            </section>

            {/* Community Per-Tool Verified Reviews */}
            <section
              className="pg-panel"
              id="pg-studio-reviews"
              aria-label="社区分工具实测评价区"
            >
              <div className="pg-panel-head">
                <div className="pg-panel-title-wrap">
                  <MessageSquare size={15} />
                  <h2>社区分工具实测评价（{comments.length}）</h2>
                </div>
              </div>

              <form onSubmit={handleReviewSubmit} className="pg-review-form">
                <div className="pg-review-form-top">
                  <div className="pg-filter-group">
                    <span className="pg-filter-label">实测工具：</span>
                    <select
                      id="pg-review-tool-select"
                      className="pg-select"
                      value={reviewTool}
                      onChange={(e) =>
                        setReviewTool(e.target.value as TargetTool)
                      }
                    >
                      {(Object.keys(TOOL_METADATA) as TargetTool[]).map((t) => (
                        <option key={t} value={t}>
                          {TOOL_METADATA[t].shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-star-picker" aria-label="实测评分">
                    <span className="pg-filter-label">还原度评分：</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`pg-star-btn ${
                          star <= reviewRating ? "is-filled" : ""
                        }`}
                        onClick={() => setReviewRating(star)}
                        aria-label={`${star} 星`}
                      >
                        <Star
                          size={16}
                          fill={star <= reviewRating ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  id="pg-review-textarea"
                  rows={2}
                  placeholder={
                    user
                      ? "分享你在 Claude / Kimi / 即梦 等工具里的实测还原效果与调优技巧（4~500字）..."
                      : "登录后即可发布你的实测反馈与调优心得..."
                  }
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  className="pg-input-inline"
                />

                {reviewError && <div className="pg-form-error">{reviewError}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="pg-btn pg-btn-ink pg-btn-sm"
                    disabled={reviewSubmitting}
                    id="pg-review-submit-btn"
                  >
                    <Send size={13} />
                    <span>
                      {reviewSubmitting
                        ? "提交中..."
                        : user
                        ? "发布实测评价"
                        : "登录并发表评价"}
                    </span>
                  </button>
                </div>
              </form>

              <div className="pg-review-list">
                {comments.length === 0 ? (
                  <p className="pg-tool-desc">
                    暂无实测评价，欢迎成为第一位分享此风格实战体验的创作者！
                  </p>
                ) : (
                  comments.map((cmt) => (
                    <article key={cmt.id} className="pg-review-card">
                      <div className="pg-review-head">
                        <div className="pg-review-author">
                          <span
                            className="pg-avatar"
                            style={{ background: cmt.author.avatarColor }}
                          >
                            {cmt.author.displayName.slice(0, 1)}
                          </span>
                          <Link
                            href={`/creator/${cmt.author.username}`}
                            className="pg-review-author-name"
                          >
                            {cmt.author.displayName}
                          </Link>
                          <span className="pg-tag">
                            {TOOL_METADATA[cmt.testedTool]?.shortName ||
                              cmt.testedTool}
                          </span>
                        </div>
                        <div className="pg-review-meta">
                          <span
                            className="pg-review-stars"
                            aria-label={`${cmt.rating} 星`}
                          >
                            {"★".repeat(cmt.rating)}
                            {"☆".repeat(5 - cmt.rating)}
                          </span>
                          {user && user.id === cmt.author.id && (
                            <button
                              type="button"
                              className="pg-icon-btn"
                              onClick={() => handleDeleteReview(cmt.id)}
                              title="删除评价"
                              aria-label="删除评价"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="pg-review-content">{cmt.content}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: 6 Target Tools + Parameter Form + Compiled Prompt + Quick Launch + Sample Exports */}
          <aside className="pg-studio-right">
            <div className="pg-workbench-sticky">
              {/* Target AI Tool Switcher (6 Ecosystems) */}
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h2>1. 目标 AI 工具</h2>
                </div>
                <div className="pg-tool-tabs pg-tool-tabs-6" role="tablist">
                  {(Object.keys(TOOL_METADATA) as TargetTool[]).map((toolId) => {
                    const t = TOOL_METADATA[toolId];
                    const active = params.targetTool === toolId;
                    const recommended = prompt.recommendedTools.includes(toolId);
                    return (
                      <button
                        key={toolId}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`pg-tool-tab ${active ? "is-active" : ""}`}
                        onClick={() =>
                          setParams((prev) => ({ ...prev, targetTool: toolId }))
                        }
                        id={`pg-tool-tab-${toolId}`}
                      >
                        <div className="pg-tool-tab-top">
                          <span className="pg-tool-tab-name">{t.shortName}</span>
                          {recommended && (
                            <span className="pg-tool-rec">推荐</span>
                          )}
                        </div>
                        <span className="pg-tool-tab-badge">{t.badge}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="pg-tool-desc pg-tool-desc--compact" title={currentToolMeta.description}>
                  {currentToolMeta.description}
                </p>

                {params.targetTool === "ai-image" && (
                  <div className="pg-batch-toggle">
                    <span className="pg-batch-toggle-label">模式：</span>
                    <div className="pg-btn-group">
                      <button
                        type="button"
                        className={`pg-mini-pill ${
                          !params.aiImageBatchMode ? "is-active" : ""
                        }`}
                        onClick={() =>
                          setParams((p) => ({
                            ...p,
                            aiImageBatchMode: false,
                          }))
                        }
                        id="pg-ai-img-single-btn"
                      >
                        单页精修
                      </button>
                      <button
                        type="button"
                        className={`pg-mini-pill ${
                          params.aiImageBatchMode &&
                          (params.aiImageBatchCount ?? 6) === 6
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() =>
                          setParams((p) => ({
                            ...p,
                            aiImageBatchMode: true,
                            aiImageBatchCount: 6,
                          }))
                        }
                        id="pg-ai-img-batch-btn"
                        aria-label="全套 6 页连贯分页生图词包"
                      >
                        6 页连贯
                      </button>
                      <button
                        type="button"
                        className={`pg-mini-pill ${
                          params.aiImageBatchMode &&
                          params.aiImageBatchCount === 12
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() =>
                          setParams((p) => ({
                            ...p,
                            aiImageBatchMode: true,
                            aiImageBatchCount: 12,
                          }))
                        }
                        id="pg-ai-img-batch-12-btn"
                      >
                        12 页全页型
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* PPT Content Customizer */}
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h2>2. 内容参数</h2>
                </div>
                <div className="pg-form pg-form-compact">
                  <div className="pg-field">
                    <label htmlFor="pg-param-topic">PPT 主题</label>
                    <input
                      id="pg-param-topic"
                      type="text"
                      value={params.topic}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, topic: e.target.value }))
                      }
                      placeholder={prompt.sampleTopic}
                    />
                  </div>

                  <div className="pg-field">
                    <label htmlFor="pg-param-subtitle">副标题</label>
                    <input
                      id="pg-param-subtitle"
                      type="text"
                      value={params.subtitle}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          subtitle: e.target.value,
                        }))
                      }
                      placeholder={prompt.sampleSubtitle}
                    />
                  </div>

                  <div className="pg-form-2col">
                    <div className="pg-field">
                      <label htmlFor="pg-param-audience">目标受众</label>
                      <input
                        id="pg-param-audience"
                        type="text"
                        value={params.audience}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            audience: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="pg-field">
                      <label htmlFor="pg-param-slides">
                        页数 ({params.slideCount} 页)
                      </label>
                      <input
                        id="pg-param-slides"
                        type="range"
                        min={6}
                        max={30}
                        value={params.slideCount}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            slideCount: Number(e.target.value),
                          }))
                        }
                        className="pg-range"
                      />
                    </div>
                  </div>

                  <div className="pg-form-2col">
                    <div className="pg-field">
                      <label htmlFor="pg-param-lang">输出语言</label>
                      <select
                        id="pg-param-lang"
                        className="pg-select pg-select-full"
                        value={params.language}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            language: e.target
                              .value as CustomizerParams["language"],
                          }))
                        }
                      >
                        <option value="zh">全中文</option>
                        <option value="bilingual">中英双语</option>
                        <option value="en">English Only</option>
                      </select>
                    </div>
                    <div className="pg-field">
                      <label htmlFor="pg-param-tone">表达基调</label>
                      <select
                        id="pg-param-tone"
                        className="pg-select pg-select-full"
                        value={params.tone}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            tone: e.target.value as CustomizerParams["tone"],
                          }))
                        }
                      >
                        <option value="executive">高管决策·结论先行</option>
                        <option value="analytical">理性分析·数据驱动</option>
                        <option value="inspiring">发布会感·愿景驱动</option>
                        <option value="storytelling">故事叙事·情绪共鸣</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Compiled Prompt + Quick Launch + Direct Sample Deck Exports */}
              <section className="pg-panel pg-compiled-panel">
                <div className="pg-panel-head">
                  <h2>3. 最终提示词</h2>
                  <span className="pg-char-count">
                    {compiledText.length} 字
                  </span>
                </div>

                <textarea
                  id="pg-compiled-prompt-output"
                  className="pg-prompt-codebox"
                  readOnly
                  value={compiledText}
                  rows={12}
                  aria-label="实时生成的完整 PPT 提示词"
                />

                <div className="pg-compiled-actions">
                  <button
                    type="button"
                    className="pg-btn pg-btn-primary pg-btn-flex"
                    onClick={handleCopyPrompt}
                    id="pg-studio-copy-btn"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>
                      {copied
                        ? "已复制到剪贴板！"
                        : `一键复制 ${currentToolMeta.shortName} 提示词`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary"
                    onClick={handleDownloadMd}
                    title="导出为 Markdown 文件"
                    id="pg-studio-download-btn"
                  >
                    <Download size={16} />
                  </button>
                </div>

                {/* External AI Quick Launch */}
                <div className="pg-quick-launch">
                  <span className="pg-quick-launch-head">
                    复制后直达外部 AI 生成平台：
                  </span>
                  <div className="pg-quick-launch-row">
                    {currentToolMeta.launchLinks.map((lnk) => (
                      <a
                        key={lnk.url + lnk.label}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pg-launch-link"
                      >
                        <span>{lnk.label}</span>
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Sample Deck Instant Export */}
                <div className="pg-sample-export-row">
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={handleExportSamplePptx}
                    disabled={exportingPptx}
                    id="pg-studio-export-pptx-btn"
                  >
                    <FileSpreadsheet size={14} />
                    <span>
                      {exportingPptx ? "导出中..." : "下载样板 .pptx"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={handleExportSampleHtml}
                    id="pg-studio-export-html-btn"
                  >
                    <FileCode2 size={14} />
                    <span>导出交互 .html</span>
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {/* Fullscreen Presenter Modal */}
      {fullscreen && (
        <div
          className="pg-presenter-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="全屏幻灯片演播模式"
        >
          <div className="pg-presenter-bar">
            <div className="pg-presenter-info">
              <span>{prompt.title}</span>
              <span className="pg-presenter-counter">
                {currentIdx + 1} / {ALL_SLIDE_TYPES.length} ·{" "}
                {SLIDE_TYPE_LABELS[activeSlide].label}
              </span>
            </div>
            <div className="pg-presenter-controls">
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() =>
                  setActiveSlide(
                    ALL_SLIDE_TYPES[
                      (currentIdx - 1 + ALL_SLIDE_TYPES.length) %
                        ALL_SLIDE_TYPES.length
                    ]
                  )
                }
                aria-label="上一页"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() =>
                  setActiveSlide(
                    ALL_SLIDE_TYPES[(currentIdx + 1) % ALL_SLIDE_TYPES.length]
                  )
                }
                aria-label="下一页"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() => setFullscreen(false)}
                aria-label="退出全屏"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="pg-presenter-stage">
            <SlideCanvas
              spec={liveSpec}
              slideType={activeSlide}
              topic={params.topic || prompt.sampleTopic}
              subtitle={params.subtitle || prompt.sampleSubtitle}
              audience={params.audience}
              slideCount={params.slideCount}
              englishTitle={prompt.englishTitle}
              scenario={prompt.scenario}
            />
          </div>
          <p className="pg-presenter-hint">
            使用键盘方向键 ← / → 切换全部 12 种商业页型，按 Esc 退出全屏演播
          </p>
        </div>
      )}
    </main>
  );
}
