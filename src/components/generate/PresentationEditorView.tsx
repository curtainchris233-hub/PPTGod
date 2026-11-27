"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cloud,
  Download,
  FileCode,
  FileCode2,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Maximize2,
  Minus,
  MoreHorizontal,
  Palette,
  Play,
  Plus,
  Redo2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import DeckAuditDrawer from "@/components/generate/DeckAuditDrawer";
import DeckSpecTweaker from "@/components/generate/DeckSpecTweaker";
import SlidePropertyInspector from "@/components/generate/SlidePropertyInspector";
import SlideTreeSidebar from "@/components/generate/SlideTreeSidebar";
import { Button } from "@/components/ui";
import type { PolishAction } from "@/lib/deckGenerator";
import {
  SLIDE_TYPE_LABELS,
  type DeckSlideItem,
  type PromptItem,
  type SlideType,
  type VisualSpec,
} from "@/types/prompt";

export interface PendingPolishProposal {
  action: PolishAction;
  slideId: string;
  proposed: DeckSlideItem;
}

const POLISH_ACTION_LABELS: Record<PolishAction, string> = {
  executive: "高管精炼",
  metrics: "补充量化论据",
  notes: "优化演讲稿",
};

const QUICK_STAGE_LAYOUTS: { type: SlideType; label: string }[] = [
  { type: "cover", label: "封面" },
  { type: "agenda", label: "目录" },
  { type: "data", label: "数据" },
  { type: "comparison", label: "对比" },
  { type: "image-split", label: "图文" },
  { type: "timeline", label: "路线图" },
];

export interface PresentationEditorViewProps {
  styles: PromptItem[];
  activeStyle: PromptItem;
  deckSpec: VisualSpec;
  handoffApplied: boolean;
  topic: string;
  title: string;
  subtitle: string;
  audience: string;
  slides: DeckSlideItem[];
  safeIndex: number;
  currentSlide: DeckSlideItem;
  newSlideType: SlideType;
  pastCount: number;
  futureCount: number;
  savedDeckId: string | null;
  hasUnsavedChanges: boolean;
  isPublic: boolean;
  isViewingForeignSharedDeck: boolean;
  saving: boolean;
  exportingPptx: boolean;
  linkCopied: boolean;
  auditOpen: boolean;
  generatingImg: boolean;
  imgModelName: string;
  imgPromptCopied: boolean;
  engineMode: "smart" | "llm";
  byokReady: boolean;
  polishingAction: PolishAction | null;
  pendingPolish: PendingPolishProposal | null;
  onBackToWorkshop: () => void;
  onOpenByokSettings: () => void;
  onTitleChange: (val: string) => void;
  onSelectStyle: (slug: string) => void;
  onChangeSpec: (next: VisualSpec) => void;
  onResetSpec: () => void;
  onAuditOpenChange: (next: boolean) => void;
  onAutoFixContrast: () => void;
  onAutoFillNotes: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveCloudDeck: () => void;
  onToggleVisibility: () => void;
  onCopyShareLink: () => void;
  onExportPptx: () => void;
  onExportHtml: () => void;
  onOpenExportModal: () => void;
  onOpenFullscreen: () => void;
  onChangeNewSlideType: (t: SlideType) => void;
  onSelectSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onMoveSlide: (idx: number, dir: -1 | 1) => void;
  onDeleteSlide: (idx: number) => void;
  onDropReorder: (fromIdx: number, toIdx: number) => void;
  onAddSlide: () => void;
  onUpdateSlide: (patch: Partial<DeckSlideItem>, coalesce?: boolean) => void;
  onChangeImgModelName: (val: string) => void;
  onUploadSlideImage: (file: File) => void;
  onCopySlideImagePrompt: () => void;
  onGenerateAiSlideImage: () => void;
  onRequestPolish: (action: PolishAction) => void;
  onConfirmPolish: () => void;
  onDiscardPolish: () => void;
}

export default function PresentationEditorView({
  styles,
  activeStyle,
  deckSpec,
  handoffApplied,
  topic,
  title,
  subtitle,
  audience,
  slides,
  safeIndex,
  currentSlide,
  newSlideType,
  pastCount,
  futureCount,
  savedDeckId,
  hasUnsavedChanges,
  isPublic,
  isViewingForeignSharedDeck,
  saving,
  exportingPptx,
  linkCopied,
  auditOpen,
  generatingImg,
  imgModelName,
  imgPromptCopied,
  engineMode,
  byokReady,
  polishingAction,
  pendingPolish,
  onBackToWorkshop,
  onOpenByokSettings,
  onTitleChange,
  onSelectStyle,
  onChangeSpec,
  onResetSpec,
  onAuditOpenChange,
  onAutoFixContrast,
  onAutoFillNotes,
  onUndo,
  onRedo,
  onSaveCloudDeck,
  onToggleVisibility,
  onCopyShareLink,
  onExportPptx,
  onExportHtml,
  onOpenExportModal,
  onOpenFullscreen,
  onChangeNewSlideType,
  onSelectSlide,
  onDuplicateSlide,
  onMoveSlide,
  onDeleteSlide,
  onDropReorder,
  onAddSlide,
  onUpdateSlide,
  onChangeImgModelName,
  onUploadSlideImage,
  onCopySlideImagePrompt,
  onGenerateAiSlideImage,
  onRequestPolish,
  onConfirmPolish,
  onDiscardPolish,
}: PresentationEditorViewProps) {
  const [rightTab, setRightTab] = useState<"slide" | "theme">("slide");
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(true);
  const [zoom, setZoom] = useState<number>(100);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!moreWrapRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const saveStatusText = saving
    ? "正在保存…"
    : savedDeckId && !hasUnsavedChanges
    ? "已保存至云端"
    : "本地草稿 · 未保存";

  const notesLength = (currentSlide.speakerNotes || "").trim().length;

  return (
    <div className="gl-ed" id="gl-editor-page">
      {/* Dedicated Editor Topbar */}
      <div className="gl-ed-topbar" role="region" aria-label="演示文稿编辑器顶栏">
        <div className="gl-ed-topbar-left">
          <button
            type="button"
            className="gl-ed-back-btn"
            onClick={onBackToWorkshop}
            aria-label="返回创作工坊"
            title="返回创作工坊重新配置或生成"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>

          <div className="gl-ed-title-wrap">
            <input
              type="text"
              data-editor-title="true"
              className="gl-ed-title-input"
              aria-label="演示文稿标题"
              value={topic}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="未命名演示文稿"
            />
            <span className="gl-ed-save-status" aria-live="polite">
              <Cloud size={13} aria-hidden="true" />
              <span>{saveStatusText}</span>
            </span>
          </div>
        </div>

        <div className="gl-ed-topbar-right">
          <div className="gl-ed-history-group">
            <button
              type="button"
              id="pg-gen-undo-btn"
              className="gl-ed-icon-btn"
              disabled={pastCount === 0}
              onClick={onUndo}
              title="撤销 (Ctrl+Z)"
              aria-label="撤销"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              id="pg-gen-redo-btn"
              className="gl-ed-icon-btn"
              disabled={futureCount === 0}
              onClick={onRedo}
              title="重做 (Ctrl+Shift+Z)"
              aria-label="重做"
            >
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            id="pg-gen-save-deck-btn"
            loading={saving}
            loadingText="保存中…"
            leftIcon={<Save size={14} />}
            onClick={onSaveCloudDeck}
          >
            {isViewingForeignSharedDeck
              ? "克隆保存"
              : savedDeckId
              ? "保存更新"
              : "保存"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            id="pg-gen-fullscreen-btn"
            leftIcon={<Play size={14} />}
            onClick={onOpenFullscreen}
          >
            演播
          </Button>

          <Button
            variant="primary"
            size="sm"
            id="pg-gen-export-pptx-btn"
            loading={exportingPptx}
            loadingText="导出中…"
            leftIcon={<Download size={14} />}
            onClick={onExportPptx}
          >
            导出 PPTX
          </Button>

          <div className="gl-ed-more-wrap" ref={moreWrapRef}>
            <button
              type="button"
              className="gl-ed-icon-btn"
              aria-label="更多操作与导出格式"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {moreOpen && (
              <div className="gl-ed-more-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  id="pg-gen-export-html-btn"
                  className="gl-ed-more-item"
                  onClick={() => {
                    setMoreOpen(false);
                    onExportHtml();
                  }}
                >
                  <FileCode2 size={14} aria-hidden="true" />
                  <span>导出离线交互 .html</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  id="pg-gen-export-md-btn"
                  className="gl-ed-more-item"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenExportModal();
                  }}
                >
                  <FileCode size={14} aria-hidden="true" />
                  <span>导出 Marp / AI 提示词</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  id="pg-gen-visibility-btn"
                  className="gl-ed-more-item"
                  onClick={() => {
                    setMoreOpen(false);
                    onToggleVisibility();
                  }}
                >
                  {isPublic ? (
                    <Lock size={14} aria-hidden="true" />
                  ) : (
                    <Globe size={14} aria-hidden="true" />
                  )}
                  <span>{isPublic ? "切换为仅自己可见" : "开启公开分享"}</span>
                </button>
                {savedDeckId && isPublic && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      id="pg-gen-copy-share-btn"
                      className="gl-ed-more-item"
                      onClick={() => {
                        setMoreOpen(false);
                        onCopyShareLink();
                      }}
                    >
                      {linkCopied ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Link2 size={14} aria-hidden="true" />
                      )}
                      <span>{linkCopied ? "已复制链接" : "复制公开演播链接"}</span>
                    </button>
                    <Link
                      role="menuitem"
                      href={`/deck/${savedDeckId}`}
                      className="gl-ed-more-item"
                      onClick={() => setMoreOpen(false)}
                    >
                      <Play size={14} aria-hidden="true" />
                      <span>打开独立演播页</span>
                    </Link>
                  </>
                )}
                <div className="gl-ed-more-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="gl-ed-more-item"
                  onClick={() => {
                    setMoreOpen(false);
                    onBackToWorkshop();
                  }}
                >
                  <Wand2 size={14} aria-hidden="true" />
                  <span>返回创作工坊重新生成</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Design Audit Bar & Expandable Report (honest 100-pt checker + 1-click fixes) */}
      <div className="gl-ed-audit-strip">
        <DeckAuditDrawer
          open={auditOpen}
          onOpenChange={onAuditOpenChange}
          defaultOpen={auditOpen}
          slides={slides}
          spec={deckSpec}
          topic={title}
          audience={audience}
          onJumpToSlide={(idx) => onSelectSlide(idx)}
          onAutoFixContrast={onAutoFixContrast}
          onAutoFillNotes={onAutoFillNotes}
        />
      </div>

      {/* 3-Column Full-Bleed Workspace */}
      <div className="gl-ed-body">
        {/* Left: Slide Tree / Outline */}
        <SlideTreeSidebar
          slides={slides}
          safeIndex={safeIndex}
          deckSpec={deckSpec}
          title={title}
          subtitle={subtitle}
          audience={audience}
          englishTitle={activeStyle.englishTitle}
          scenario={activeStyle.scenario}
          newSlideType={newSlideType}
          onChangeNewSlideType={onChangeNewSlideType}
          onSelectSlide={onSelectSlide}
          onDuplicateSlide={onDuplicateSlide}
          onMoveSlide={onMoveSlide}
          onDeleteSlide={onDeleteSlide}
          onDropReorder={onDropReorder}
          onAddSlide={onAddSlide}
        />

        {/* Center: Honest Toolbar + 16:9 Live Stage + Pager/Zoom + Speaker Notes */}
        <section className="gl-ed-center" aria-label="幻灯片画布与演讲备注">
          {/* Honest Stage Toolbar (ONLY real implemented tools — zero fake shapes/animation/transition) */}
          <div className="gl-ed-toolbar">
            <span className="gl-ed-ratio-chip" title="标准 16:9 宽屏画布">
              16:9
            </span>

            <span className="gl-ed-toolbar-sep" aria-hidden="true" />

            <div className="gl-ed-layout-pills" role="group" aria-label="快捷切换版式（仅换版式不动字）">
              {QUICK_STAGE_LAYOUTS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className={`gl-ed-tool-btn ${
                    currentSlide.slideType === item.type ? "is-active" : ""
                  }`}
                  onClick={() => onUpdateSlide({ slideType: item.type }, false)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="gl-ed-toolbar-right">
              <button
                type="button"
                className={`gl-ed-tool-btn ${rightTab === "slide" ? "is-active" : ""}`}
                onClick={() => setRightTab("slide")}
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
                <span>本页编辑</span>
              </button>
              <button
                type="button"
                className={`gl-ed-tool-btn ${rightTab === "theme" ? "is-active" : ""}`}
                onClick={() => setRightTab("theme")}
              >
                <Palette size={13} aria-hidden="true" />
                <span>页面与主题</span>
              </button>
              <button
                type="button"
                className={`gl-ed-tool-btn ${auditOpen ? "is-active" : ""}`}
                onClick={() => onAuditOpenChange(!auditOpen)}
              >
                <ShieldCheck size={13} aria-hidden="true" />
                <span>设计体检</span>
              </button>
            </div>
          </div>

          {/* 16:9 Live Canvas Stage */}
          <div className="gl-ed-stage-bay">
            <div
              className="gl-ed-stage-zoom-wrap"
              style={{
                width: `${zoom}%`,
                maxWidth: zoom <= 100 ? "960px" : `${Math.round(9.6 * zoom)}px`,
              }}
            >
              <div className="pg-stage-canvas-wrap gl-ed-canvas-shell">
                <SlideCanvas
                  spec={deckSpec}
                  slideType={currentSlide.slideType}
                  topic={title}
                  subtitle={subtitle}
                  audience={audience}
                  slideData={currentSlide}
                  pageIndex={safeIndex}
                  totalPages={slides.length}
                  englishTitle={activeStyle.englishTitle}
                  scenario={activeStyle.scenario}
                />
              </div>
            </div>
          </div>

          {/* Bottom Pager & Zoom Strip */}
          <div className="gl-ed-stage-bar">
            <span className="gl-ed-slide-counter">
              <Layers size={13} aria-hidden="true" />
              <span>
                幻灯片 {safeIndex + 1} / {slides.length} ·{" "}
                {SLIDE_TYPE_LABELS[currentSlide.slideType].label}
              </span>
            </span>

            <div className="gl-ed-pager">
              <button
                type="button"
                className="gl-ed-pager-btn"
                disabled={safeIndex <= 0}
                onClick={() => onSelectSlide(Math.max(0, safeIndex - 1))}
                aria-label="上一页"
                title="上一页"
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gl-ed-pager-btn"
                data-pager-next="true"
                disabled={safeIndex >= slides.length - 1}
                onClick={() =>
                  onSelectSlide(Math.min(slides.length - 1, safeIndex + 1))
                }
                aria-label="下一页"
                title="下一页"
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="gl-ed-zoom">
              <button
                type="button"
                className="gl-ed-pager-btn"
                onClick={onOpenFullscreen}
                aria-label="全屏演播"
                title="全屏演播"
              >
                <Maximize2 size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gl-ed-pager-btn"
                data-zoom-out="true"
                disabled={zoom <= 60}
                onClick={() => setZoom((z) => Math.max(60, z - 10))}
                aria-label="缩小"
                title="缩小画布"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gl-ed-zoom-val"
                onClick={() => setZoom(100)}
                title="点击重置为 100% 适应窗口"
              >
                {zoom}%
              </button>
              <button
                type="button"
                className="gl-ed-pager-btn"
                data-zoom-in="true"
                disabled={zoom >= 120}
                onClick={() => setZoom((z) => Math.min(120, z + 10))}
                aria-label="放大"
                title="放大画布"
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Bottom Speaker Notes Card */}
          <div className="gl-ed-notes-card">
            <div className="gl-ed-notes-head">
              <div className="gl-ed-notes-left">
                <label htmlFor="pg-gen-speaker-notes" className="gl-ed-notes-title">
                  演讲备注
                </label>
                <button
                  type="button"
                  id="pg-polish-notes-btn"
                  className="gl-ed-notes-ai-btn"
                  disabled={polishingAction !== null}
                  onClick={() => onRequestPolish("notes")}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>
                    {polishingAction === "notes" ? "生成中…" : "AI 讲稿生成"}
                  </span>
                </button>
              </div>
              <span className="gl-ed-notes-count">约 {notesLength} 字</span>
            </div>
            <textarea
              id="pg-gen-speaker-notes"
              className="gl-ed-notes-textarea"
              rows={3}
              value={currentSlide.speakerNotes || ""}
              onChange={(e) => onUpdateSlide({ speakerNotes: e.target.value })}
              placeholder="填写本页演讲备注或口语提词，导出 .pptx、交互 .html 与 Marp 时将同步写入…"
            />
          </div>
        </section>

        {/* Right: 2 Real Inspector Tabs + Honest AI Assistant Card */}
        <aside className="gl-ed-right" aria-label="属性与主题面板">
          <div
            className={`gl-ed-right-card ${
              mobileInspectorOpen ? "" : "is-mobile-collapsed"
            }`}
          >
            <button
              type="button"
              className="gl-ed-right-mobile-toggle"
              aria-expanded={mobileInspectorOpen}
              onClick={() => setMobileInspectorOpen((v) => !v)}
            >
              <span>属性与主题检查器</span>
              {mobileInspectorOpen ? (
                <ChevronUp size={15} aria-hidden="true" />
              ) : (
                <ChevronDown size={15} aria-hidden="true" />
              )}
            </button>

            <div
              className="gl-ed-right-tabs"
              role="tablist"
              aria-label="右侧编辑面板切换"
            >
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "slide"}
                className={`gl-ed-right-tab ${
                  rightTab === "slide" ? "is-active" : ""
                }`}
                onClick={() => setRightTab("slide")}
              >
                本页编辑
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "theme"}
                className={`gl-ed-right-tab ${
                  rightTab === "theme" ? "is-active" : ""
                }`}
                onClick={() => setRightTab("theme")}
              >
                页面与主题
              </button>
            </div>

            <div className="gl-ed-right-scroll">
              {rightTab === "slide" ? (
                <SlidePropertyInspector
                  currentSlide={currentSlide}
                  safeIndex={safeIndex}
                  title={title}
                  subtitle={subtitle}
                  audience={audience}
                  scenario={activeStyle.scenario}
                  archetype={deckSpec.layout.archetype}
                  generatingImg={generatingImg}
                  imgModelName={imgModelName}
                  imgPromptCopied={imgPromptCopied}
                  byokReady={byokReady}
                  onChangeImgModelName={onChangeImgModelName}
                  onOpenByokSettings={onOpenByokSettings}
                  onUploadSlideImage={onUploadSlideImage}
                  onCopySlideImagePrompt={onCopySlideImagePrompt}
                  onGenerateAiSlideImage={onGenerateAiSlideImage}
                  onUpdateSlide={onUpdateSlide}
                />
              ) : (
                <div className="gl-ed-theme-panel">
                  <div className="gl-ed-theme-field">
                    <label htmlFor="pg-gen-style-select">视觉母版风格</label>
                    <select
                      id="pg-gen-style-select"
                      className="gl-ed-select"
                      value={activeStyle.slug}
                      onChange={(e) => onSelectStyle(e.target.value)}
                    >
                      {styles.map((st) => (
                        <option key={st.id} value={st.slug}>
                          {st.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gl-ed-theme-field">
                    <span>画布比例</span>
                    <div className="gl-ed-static-box">16:9 (宽屏标准)</div>
                  </div>

                  <DeckSpecTweaker
                    defaultOpen
                    deckSpec={deckSpec}
                    baseSpec={activeStyle.visualSpec}
                    handoffApplied={handoffApplied}
                    onChangeSpec={onChangeSpec}
                    onResetSpec={onResetSpec}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Honest AI Assistant Card (3 real /api/polish actions + mandatory preview/confirm, B13) */}
          <div className="gl-ed-ai-card" aria-label="AI 助手单页润色">
            <div className="gl-ed-ai-head">
              <span className="gl-ed-ai-title">
                <Sparkles size={15} aria-hidden="true" />
                <strong>AI 助手</strong>
              </span>
              <button
                type="button"
                id="pg-ed-byok-config-btn"
                className={`gl-ed-byok-btn ${byokReady ? "is-ready" : ""}`}
                onClick={onOpenByokSettings}
                title="配置本地浏览器 BYOK 大模型与生图 API Key（不上传服务器）"
              >
                <KeyRound size={11} aria-hidden="true" />
                <span>
                  {byokReady
                    ? engineMode === "llm"
                      ? "BYOK 已启用"
                      : "BYOK Key 就绪"
                    : "配置本地 BYOK"}
                </span>
              </button>
            </div>

            <div className="gl-ed-ai-actions">
              <button
                type="button"
                id="pg-polish-executive-btn"
                className="gl-ed-ai-chip"
                disabled={polishingAction !== null}
                onClick={() => onRequestPolish("executive")}
              >
                {polishingAction === "executive" ? "润色中…" : "高管精炼"}
              </button>
              <button
                type="button"
                id="pg-polish-metrics-btn"
                className="gl-ed-ai-chip"
                disabled={polishingAction !== null}
                onClick={() => onRequestPolish("metrics")}
              >
                {polishingAction === "metrics" ? "补充中…" : "补充量化论据"}
              </button>
              <button
                type="button"
                className="gl-ed-ai-chip"
                disabled={polishingAction !== null}
                onClick={() => onRequestPolish("notes")}
              >
                {polishingAction === "notes" ? "生成中…" : "优化演讲稿"}
              </button>
            </div>

            {pendingPolish ? (
              <div className="gl-ed-ai-preview" role="region" aria-label="AI 修改建议预览">
                <div className="gl-ed-ai-preview-head">
                  <strong>
                    建议预览 · {POLISH_ACTION_LABELS[pendingPolish.action]}
                  </strong>
                  <button
                    type="button"
                    className="gl-ed-ai-close"
                    aria-label="关闭建议"
                    onClick={onDiscardPolish}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>

                {pendingPolish.action === "notes" ? (
                  <p className="gl-ed-ai-preview-text">
                    {pendingPolish.proposed.speakerNotes || "已生成新版演讲逐字稿。"}
                  </p>
                ) : (
                  <div className="gl-ed-ai-preview-body">
                    <div className="gl-ed-ai-preview-title">
                      {pendingPolish.proposed.title}
                    </div>
                    {pendingPolish.proposed.bullets &&
                      pendingPolish.proposed.bullets.length > 0 && (
                        <ul className="gl-ed-ai-preview-list">
                          {pendingPolish.proposed.bullets.slice(0, 3).map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}

                <div className="gl-ed-ai-preview-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDiscardPolish}
                  >
                    放弃
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onConfirmPolish}
                  >
                    确认应用
                  </Button>
                </div>
              </div>
            ) : (
              <p className="gl-ed-ai-hint">
                点击上方快捷操作，系统会针对当前第 {safeIndex + 1} 页生成优化预览，确认后再写入画布并支持 Ctrl+Z 撤销。
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
