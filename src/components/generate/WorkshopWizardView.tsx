"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  FileText,
  History,
  LayoutGrid,
  ListOrdered,
  Maximize2,
  Monitor,
  PenLine,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import OutlineDraftPanel from "@/components/generate/OutlineDraftPanel";
import PageHeader from "@/components/layout/PageHeader";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { Button, Progress, Stepper, type StepperStep } from "@/components/ui";
import {
  DOMAIN_TABS,
  SLIDE_TYPE_LABELS,
  type DeckSlideItem,
  type DocumentAnalysisResult,
  type DomainTabId,
  type EvidenceDensity,
  type GenerationRouteMode,
  type OutlineDraftItem,
  type PromptItem,
  type SlideType,
  type VisualSpec,
} from "@/types/prompt";

const QUICK_SAMPLE_TOPICS = [
  "Attention Is All You Need · Transformer 论文精读",
  "DeepSeek-R1 强化学习推理范式与技术拆解",
  "高中物理必修一 · 牛顿第二定律公开课",
  "初中语文 · 《岳阳楼记》意境赏析课件",
];

const PREVIEW_THUMB_TYPES: SlideType[] = [
  "cover",
  "agenda",
  "data",
  "comparison",
  "closing",
];

const SLIDE_COUNT_CHOICES = [6, 8, 10, 12, 16, 20];
const AUDIENCE_CHOICES = [
  { value: "核心决策层与业务团队", label: "管理层" },
  { value: "通用听众", label: "通用" },
  { value: "客户与合作伙伴", label: "客户" },
  { value: "学术评审与同行专家", label: "学术评审" },
  { value: "学生与课堂学员", label: "学生" },
];

export interface UploadedFileRecord {
  id: string;
  fileName: string;
  sizeBytes?: number;
  charCount: number;
  warning?: string;
}

export interface WorkshopWizardViewProps {
  styles: PromptItem[];
  activeStyle: PromptItem;
  deckSpec: VisualSpec;
  topic: string;
  subtitle: string;
  audience: string;
  slideCount: number;
  sourceText: string;
  evidenceDensity: EvidenceDensity;
  routeMode: GenerationRouteMode;
  engineMode: "smart" | "llm";
  apiBase: string;
  apiKey: string;
  modelName: string;
  parsingDoc: boolean;
  uploadedFiles: UploadedFileRecord[];
  uploadError: string | null;
  docAnalysis: DocumentAnalysisResult | null;
  outlineDraft: OutlineDraftItem[] | null;
  generatingOutline: boolean;
  generating: boolean;
  genError: string | null;
  slides: DeckSlideItem[];
  pendingDraft: { topic: string; slidesCount: number } | null;
  deckForbidden: boolean;
  onTopicChange: (val: string) => void;
  onSubtitleChange: (val: string) => void;
  onAudienceChange: (val: string) => void;
  onSlideCountChange: (count: number) => void;
  onSourceTextChange: (val: string) => void;
  onEvidenceDensityChange: (density: EvidenceDensity) => void;
  onRouteModeChange: (routeMode: GenerationRouteMode) => void;
  onEngineModeChange: (m: "smart" | "llm") => void;
  onApiBaseChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
  onModelNameChange: (val: string) => void;
  onSelectStyle: (slug: string) => void;
  onUploadFile: (file: File) => void;
  onRemoveUploadedFile: (id: string) => void;
  onBuildOutline: () => void;
  onChangeOutline: React.Dispatch<
    React.SetStateAction<OutlineDraftItem[] | null>
  >;
  onCloseOutline: () => void;
  onGenerate: (customOutline?: OutlineDraftItem[]) => void;
  onOpenEditor: () => void;
  onOpenExportModal: () => void;
  onOpenFullscreenPreview: () => void;
  onRestoreDraft: () => void;
  onDismissDraft: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkshopWizardView({
  styles,
  activeStyle,
  deckSpec,
  topic,
  subtitle,
  audience,
  slideCount,
  sourceText,
  evidenceDensity,
  routeMode,
  engineMode,
  apiBase,
  apiKey,
  modelName,
  parsingDoc,
  uploadedFiles,
  uploadError,
  docAnalysis,
  outlineDraft,
  generatingOutline,
  generating,
  genError,
  slides,
  pendingDraft,
  deckForbidden,
  onTopicChange,
  onSubtitleChange,
  onAudienceChange,
  onSlideCountChange,
  onSourceTextChange,
  onEvidenceDensityChange,
  onRouteModeChange,
  onEngineModeChange,
  onApiBaseChange,
  onApiKeyChange,
  onModelNameChange,
  onSelectStyle,
  onUploadFile,
  onRemoveUploadedFile,
  onBuildOutline,
  onChangeOutline,
  onCloseOutline,
  onGenerate,
  onOpenEditor,
  onOpenExportModal,
  onOpenFullscreenPreview,
  onRestoreDraft,
  onDismissDraft,
}: WorkshopWizardViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewThumbIdx, setPreviewThumbIdx] = useState(0);
  const [styleDomain, setStyleDomain] = useState<DomainTabId>("all");
  const [advOpen, setAdvOpen] = useState(false);

  const visibleStyles = useMemo(() => {
    if (styleDomain === "all") return styles;
    const def = DOMAIN_TABS.find((t) => t.id === styleDomain);
    if (!def) return styles;
    return styles.filter((s) => def.scenarios.includes(s.scenario));
  }, [styles, styleDomain]);

  const activeStepIdx = generating || generatingOutline || outlineDraft
    ? 2
    : topic.trim().length > 0
    ? 1
    : 0;

  const steps: StepperStep[] = [
    {
      id: "content",
      title: "内容与资料",
      description: "描述主题、上传资料",
      status: activeStepIdx > 0 ? "completed" : "active",
    },
    {
      id: "style",
      title: "选择风格",
      description: "确定设计风格与版式",
      status:
        activeStepIdx > 1
          ? "completed"
          : activeStepIdx === 1
          ? "active"
          : "upcoming",
    },
    {
      id: "generate",
      title: "AI 生成",
      description: "智能创作演示文稿",
      status: activeStepIdx === 2 ? "active" : "upcoming",
    },
    {
      id: "edit",
      title: "预览与优化",
      description: "在线编辑与导出",
      status: "upcoming",
    },
  ];

  const previewSlideType = PREVIEW_THUMB_TYPES[previewThumbIdx] ?? "cover";
  const effectiveTopic = topic.trim() || activeStyle.sampleTopic;
  const effectiveSubtitle = subtitle.trim() || activeStyle.sampleSubtitle;
  const busy = generating || generatingOutline;

  return (
    <div className="gl-ws" id="gl-workshop-page">
      <PageHeader
        className="gl-ws-hero"
        title={
          <>
            创作工坊 · AI 驱动的{" "}
            <span className="gl-page-header-highlight">PPT 创作</span>
          </>
        }
        subtitle="输入想法、上传资料、选择风格，一键生成专业、美观、有说服力的演示文稿"
        actions={
          slides.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenEditor}
              id="gl-ws-enter-editor-btn"
            >
              直接进入编辑器
            </Button>
          ) : undefined
        }
      />

      {/* Draft recovery & permission alerts */}
      {pendingDraft && (
        <div className="gl-ws-banner" id="pg-draft-restore-banner">
          <div className="gl-ws-banner-copy">
            <History size={15} aria-hidden="true" />
            <span>
              发现本地未保存草稿「<strong>{pendingDraft.topic}</strong>」（
              {pendingDraft.slidesCount} 页）
            </span>
          </div>
          <div className="gl-ws-banner-actions">
            <Button
              variant="primary"
              size="sm"
              id="pg-draft-restore-btn"
              onClick={onRestoreDraft}
            >
              恢复草稿
            </Button>
            <Button
              variant="ghost"
              size="sm"
              id="pg-draft-dismiss-btn"
              onClick={onDismissDraft}
            >
              忽略
            </Button>
          </div>
        </div>
      )}

      {deckForbidden && (
        <div className="gl-ws-alert gl-ws-alert--error" id="pg-gen-deck-forbidden" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>请求的演示文稿为私有状态，已为你打开全新创作工坊。</span>
        </div>
      )}

      {/* Main 2-column layout: Left Vertical Stepper | Right Workspace */}
      <div className="gl-ws-layout">
        <aside className="gl-ws-stepper-card" aria-label="创作流程步骤">
          <Stepper
            steps={steps}
            orientation="vertical"
            onStepClick={(stepId) => {
              if (stepId === "edit") onOpenEditor();
            }}
          />
        </aside>

        <div className="gl-ws-main">
          {/* Top 60:40 Row — Content & Upload | Live Sample Preview */}
          <div className="gl-ws-top-grid">
            {/* Left 60%: Content & Materials */}
            <section
              className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-ws-content-card"
              aria-labelledby="gl-ws-content-heading"
            >
              <div className="gl-panel-header">
                <div className="gl-panel-title-group">
                  <span className="gl-panel-icon" aria-hidden="true">
                    <Sparkles size={17} />
                  </span>
                  <h2 className="gl-panel-title" id="gl-ws-content-heading">
                    内容与资料
                  </h2>
                </div>
              </div>

              <div className="gl-ws-topic-box">
                <PenLine
                  size={17}
                  className="gl-ws-topic-icon"
                  aria-hidden="true"
                />
                <textarea
                  id="pg-gen-topic"
                  className="gl-ws-topic-textarea"
                  rows={3}
                  maxLength={1000}
                  value={topic}
                  onChange={(e) => onTopicChange(e.target.value)}
                  placeholder="描述你想创建的演示文稿，例如「Attention Is All You Need 论文精读」或「高中物理 · 电磁感应公开课」"
                  aria-label="演示文稿主题与核心内容"
                />
                <span className="gl-ws-char-count" aria-live="polite">
                  {topic.length} / 1000
                </span>
              </div>

              <div className="gl-ws-samples">
                <span className="gl-ws-samples-label">试试示例：</span>
                <div className="gl-ws-samples-list">
                  {QUICK_SAMPLE_TOPICS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      data-sample-chip="true"
                      data-sample-topic={sample}
                      className={`gl-sample-chip ${
                        topic === sample ? "is-active" : ""
                      }`}
                      onClick={() => onTopicChange(sample)}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split Upload Zone + Parsed File Cards */}
              <div className="gl-ws-upload-split">
                <div
                  className={`gl-ws-dropzone ${dragging ? "is-drag-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) onUploadFile(file);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="pg-doc-upload-input"
                    type="file"
                    accept=".pdf,.docx,.pptx,.md,.txt"
                    className="gl-sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadFile(file);
                      e.target.value = "";
                    }}
                  />
                  <span className="gl-ws-dropzone-icon" aria-hidden="true">
                    <Upload size={22} />
                  </span>
                  <strong className="gl-ws-dropzone-title">上传资料</strong>
                  <p className="gl-ws-dropzone-hint">
                    支持 PDF、Word (.docx)、PPT (.pptx)、Markdown、TXT · 单文件 ≤ 10 MB
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    id="pg-doc-upload-btn"
                    loading={parsingDoc}
                    loadingText="正在解析…"
                    leftIcon={<Upload size={13} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </Button>
                </div>

                <div className="gl-ws-file-list" aria-label="已上传文件列表">
                  {uploadedFiles.length > 0 ? (
                    uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="gl-ws-file-card"
                        id="pg-doc-upload-badge"
                      >
                        <span className="gl-ws-file-badge" aria-hidden="true">
                          <FileText size={16} />
                        </span>
                        <div className="gl-ws-file-info">
                          <strong title={file.fileName}>{file.fileName}</strong>
                          <span>
                            {file.sizeBytes ? `${formatFileSize(file.sizeBytes)} · ` : ""}
                            已提取 {file.charCount.toLocaleString("zh-CN")} 字
                          </span>
                          {file.warning && (
                            <em className="gl-ws-file-warn" id="pg-doc-scan-warning">
                              {file.warning}
                            </em>
                          )}
                        </div>
                        <button
                          type="button"
                          className="gl-upload-remove-btn"
                          data-remove-file={file.id}
                          aria-label={`移除文件 ${file.fileName}`}
                          title="移除该文件"
                          onClick={() => onRemoveUploadedFile(file.id)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="gl-ws-file-empty">
                      <FileText size={18} aria-hidden="true" />
                      <span>上传文档后将在这里显示解析状态，并自动推荐匹配风格</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="gl-ws-upload-error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Document Analysis Recommendations */}
              {docAnalysis && docAnalysis.recommendedStyles.length > 0 && (
                <div className="gl-ws-doc-recs" id="pg-gen-doc-recs">
                  <div className="gl-ws-doc-recs-head">
                    <Sparkles size={13} aria-hidden="true" />
                    <span>
                      识别场景：<strong>{docAnalysis.detectedScenario}</strong>（
                      {docAnalysis.confidence}%）· 推荐风格：
                    </span>
                  </div>
                  <div className="gl-ws-doc-rec-pills">
                    {docAnalysis.recommendedStyles.map((rec, idx) => (
                      <button
                        key={rec.slug}
                        type="button"
                        data-rec-slug={rec.slug}
                        className={`gl-ws-rec-pill ${
                          activeStyle.slug === rec.slug ? "is-active" : ""
                        }`}
                        onClick={() => onSelectStyle(rec.slug)}
                      >
                        #{idx + 1} {rec.title.split(" · ")[0]} · {rec.score}%
                      </button>
                    ))}
                    <button
                      type="button"
                      id="pg-gen-doc-prompt-btn"
                      className="gl-ws-rec-pill"
                      onClick={onOpenExportModal}
                    >
                      <FileCode size={12} aria-hidden="true" />
                      <span>导出 Marp / 提示词</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Right 40%: Live Sample Preview (honest 示例预览 disclosure) */}
            <section
              className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-ws-preview-card"
              aria-labelledby="gl-ws-preview-heading"
            >
              <div className="gl-panel-header">
                <div className="gl-panel-title-group">
                  <span className="gl-panel-icon" aria-hidden="true">
                    <Monitor size={17} />
                  </span>
                  <h2 className="gl-panel-title" id="gl-ws-preview-heading">
                    示例预览
                  </h2>
                  <span className="gl-ws-sample-pill">示例文稿</span>
                </div>
                <button
                  type="button"
                  className="gl-ws-text-btn"
                  onClick={onOpenFullscreenPreview}
                >
                  <Maximize2 size={13} aria-hidden="true" />
                  <span>全屏预览</span>
                </button>
              </div>

              <div className="gl-ws-preview-stage">
                <SlidePreviewFrame
                  spec={deckSpec}
                  slideType={previewSlideType}
                  topic={effectiveTopic}
                  subtitle={effectiveSubtitle}
                  audience={audience}
                  englishTitle={activeStyle.englishTitle}
                  scenario={activeStyle.scenario}
                  isSample
                  sampleLabel="示例预览"
                  radius="md"
                />
              </div>

              <div
                className="gl-ws-preview-thumbs"
                aria-label="预览页缩略图"
              >
                {PREVIEW_THUMB_TYPES.map((st, idx) => {
                  const active = idx === previewThumbIdx;
                  return (
                    <button
                      key={st}
                      type="button"
                      data-preview-thumb={st}
                      className={`gl-preview-thumb ${active ? "is-active" : ""}`}
                      aria-label={`预览第 ${idx + 1} 页：${SLIDE_TYPE_LABELS[st].label}`}
                      aria-pressed={active}
                      onClick={() => setPreviewThumbIdx(idx)}
                    >
                      <SlidePreviewFrame
                        spec={deckSpec}
                        slideType={st}
                        topic={effectiveTopic}
                        subtitle={effectiveSubtitle}
                        englishTitle={activeStyle.englishTitle}
                        scenario={activeStyle.scenario}
                        radius="sm"
                      />
                      <span className="gl-preview-thumb-idx">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Middle Row: Style Selector Strip */}
          <section
            className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-ws-styles-card"
            aria-labelledby="gl-ws-styles-heading"
          >
            <div className="gl-panel-header">
              <div className="gl-panel-title-group">
                <span className="gl-panel-icon" aria-hidden="true">
                  <LayoutGrid size={17} />
                </span>
                <h2 className="gl-panel-title" id="gl-ws-styles-heading">
                  选择演示风格
                </h2>
              </div>
              <Link href="/gallery" className="gl-ws-more-link">
                <span>更多风格</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="gl-ws-domain-pills" role="tablist" aria-label="风格分类">
              {DOMAIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={styleDomain === tab.id}
                  className={`gl-ws-domain-pill ${
                    styleDomain === tab.id ? "is-active" : ""
                  }`}
                  onClick={() => setStyleDomain(tab.id)}
                >
                  {tab.id === "all" ? "全部风格" : tab.label}
                </button>
              ))}
            </div>

            <div
              className="gl-style-rail"
              data-style-rail="true"
              role="radiogroup"
              aria-label="选择演示文稿视觉风格"
            >
              {visibleStyles.map((st) => {
                const selected = st.slug === activeStyle.slug;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-style-slug={st.slug}
                    className={`gl-style-rail-card ${selected ? "is-selected" : ""}`}
                    onClick={() => onSelectStyle(st.slug)}
                  >
                    <div className="gl-style-rail-thumb">
                      <SlidePreviewFrame
                        spec={st.visualSpec}
                        slideType="cover"
                        topic={effectiveTopic}
                        subtitle={st.sampleSubtitle}
                        englishTitle={st.englishTitle}
                        scenario={st.scenario}
                        radius="sm"
                      />
                      {selected && (
                        <span className="gl-style-rail-check" aria-hidden="true">
                          <Check size={12} strokeWidth={2.8} />
                        </span>
                      )}
                    </div>
                    <div className="gl-style-rail-meta">
                      <strong>{st.title.split(" · ")[0]}</strong>
                      <span>
                        {st.scenario} · {st.styleCategory}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Honest Indeterminate Progress / Error Recovery (B8) */}
          {busy && (
            <div className="gl-ws-progress-card" role="status" aria-live="polite">
              <Progress
                status="running"
                stageLabel={
                  generatingOutline
                    ? "正在根据主题与资料规划可编辑大纲…"
                    : `正在使用「${activeStyle.title.split(" · ")[0]}」风格生成 ${slideCount} 页演示文稿…`
                }
              />
            </div>
          )}

          {genError && !busy && (
            <div className="gl-ws-alert gl-ws-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{genError}</span>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw size={13} />}
                onClick={() => onGenerate(outlineDraft ?? undefined)}
              >
                重试生成
              </Button>
            </div>
          )}

          {/* Step 2 Editable Outline Draft Panel */}
          {outlineDraft && (
            <OutlineDraftPanel
              outlineDraft={outlineDraft}
              generating={generating}
              onChangeOutline={onChangeOutline}
              onClose={onCloseOutline}
              onConfirmRender={(draft) => onGenerate(draft)}
            />
          )}

          {/* Advanced Settings Drawer (Subtitle, Audience, Source Text, BYOK LLM) */}
          {advOpen && (
            <section
              className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-ws-adv-panel"
              aria-label="高级生成设置"
            >
              <div className="gl-ws-adv-grid">
                <div className="gl-ws-adv-col">
                  <label className="gl-ws-field">
                    <span>副标题</span>
                    <input
                      id="pg-gen-subtitle"
                      type="text"
                      value={subtitle}
                      onChange={(e) => onSubtitleChange(e.target.value)}
                      placeholder="可选，例如「以确定性设计系统重构团队交付效率」"
                    />
                  </label>
                  <label className="gl-ws-field">
                    <span>目标受众</span>
                    <input
                      id="pg-gen-audience"
                      type="text"
                      value={audience}
                      onChange={(e) => onAudienceChange(e.target.value)}
                    />
                  </label>
                  <label className="gl-ws-field">
                    <span>补充资料 / 原始正文（可选）</span>
                    <textarea
                      id="pg-gen-source"
                      rows={3}
                      value={sourceText}
                      onChange={(e) => onSourceTextChange(e.target.value)}
                      placeholder="粘贴会议纪要、PRD、论文摘要或数据要点…"
                    />
                  </label>
                </div>

                <div className="gl-ws-adv-col">
                  <div className="gl-ws-field">
                    <span>内容证据密度</span>
                    <div
                      className="gl-ws-engine-seg gl-ws-engine-seg--3"
                      role="group"
                      aria-label="内容证据密度"
                    >
                      {(
                        [
                          { id: "light", label: "精炼提纲" },
                          { id: "balanced", label: "均衡论证" },
                          { id: "high-evidence", label: "高密度原文" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          id={`pg-density-${opt.id}-btn`}
                          className={evidenceDensity === opt.id ? "is-active" : ""}
                          onClick={() => onEvidenceDensityChange(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="gl-ws-field">
                    <span>文档整理路由（适配 .pptx 与长文档）</span>
                    <div
                      className="gl-ws-engine-seg"
                      role="group"
                      aria-label="文档整理路由"
                    >
                      <button
                        type="button"
                        id="pg-route-restructure-btn"
                        className={routeMode === "restructure" ? "is-active" : ""}
                        onClick={() => onRouteModeChange("restructure")}
                      >
                        重构故事线
                      </button>
                      <button
                        type="button"
                        id="pg-route-beautify-btn"
                        className={routeMode === "beautify-1to1" ? "is-active" : ""}
                        onClick={() => onRouteModeChange("beautify-1to1")}
                      >
                        1:1 保词换肤
                      </button>
                    </div>
                  </div>

                  <div className="gl-ws-field">
                    <span>生成引擎</span>
                    <div className="gl-ws-engine-seg">
                      <button
                        type="button"
                        id="pg-engine-smart-btn"
                        className={engineMode === "smart" ? "is-active" : ""}
                        onClick={() => onEngineModeChange("smart")}
                      >
                        内置智能引擎（免 Key）
                      </button>
                      <button
                        type="button"
                        id="pg-engine-llm-btn"
                        className={engineMode === "llm" ? "is-active" : ""}
                        onClick={() => onEngineModeChange("llm")}
                      >
                        自定义大模型（BYOK）
                      </button>
                    </div>
                  </div>

                  {engineMode === "smart" ? (
                    <p className="gl-ws-engine-note">
                      内置语义结构引擎开箱即用，支持 5–20 页全 12 种商业与学术页型编排；需要多语言或深度改写时可切换 BYOK 自定义模型（与全局设置弹窗实时同步）。
                    </p>
                  ) : (
                    <>
                      <label className="gl-ws-field">
                        <span>API Base URL</span>
                        <input
                          id="pg-llm-base"
                          type="text"
                          value={apiBase}
                          onChange={(e) => onApiBaseChange(e.target.value)}
                          placeholder="https://api.deepseek.com/v1"
                        />
                      </label>
                      <label className="gl-ws-field">
                        <span>模型名称</span>
                        <input
                          id="pg-llm-model"
                          type="text"
                          value={modelName}
                          onChange={(e) => onModelNameChange(e.target.value)}
                          placeholder="gpt-4o-mini / deepseek-chat"
                        />
                      </label>
                      <label className="gl-ws-field">
                        <span>API Key（仅存本地标签页会话，不留存服务端）</span>
                        <input
                          id="pg-llm-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => onApiKeyChange(e.target.value)}
                          placeholder="sk-..."
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Bottom Fixed Params & Generation Action Bar */}
          <div className="gl-ws-action-bar">
            <div className="gl-ws-params">
              <label className="gl-ws-param-pill">
                <span>页数</span>
                <select
                  id="pg-gen-count"
                  name="slideCount"
                  aria-label="规划页数"
                  value={
                    SLIDE_COUNT_CHOICES.includes(slideCount)
                      ? String(slideCount)
                      : String(slideCount)
                  }
                  onChange={(e) => onSlideCountChange(Number(e.target.value))}
                >
                  {Array.from(new Set([...SLIDE_COUNT_CHOICES, slideCount]))
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        约 {n} 页
                      </option>
                    ))}
                </select>
              </label>

              <span
                className="gl-ws-static-pill"
                title="PPTGod 统一输出标准 16:9 宽屏演示文稿"
              >
                <span>比例</span>
                <strong>16:9 (宽屏)</strong>
              </span>

              <label className="gl-ws-param-pill">
                <span>受众</span>
                <select
                  name="audience"
                  aria-label="目标受众"
                  value={
                    AUDIENCE_CHOICES.some((a) => a.value === audience)
                      ? audience
                      : "核心决策层与业务团队"
                  }
                  onChange={(e) => onAudienceChange(e.target.value)}
                >
                  {AUDIENCE_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                id="pg-gen-adv-toggle-btn"
                className={`gl-ws-adv-btn ${advOpen ? "is-open" : ""}`}
                aria-expanded={advOpen}
                onClick={() => setAdvOpen((v) => !v)}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span>高级设置</span>
                {advOpen ? (
                  <ChevronUp size={13} aria-hidden="true" />
                ) : (
                  <ChevronDown size={13} aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="gl-ws-ctas">
              <Button
                variant="secondary"
                size="md"
                id="pg-gen-outline-btn"
                disabled={busy}
                loading={generatingOutline}
                loadingText="规划中…"
                leftIcon={<ListOrdered size={15} />}
                onClick={onBuildOutline}
              >
                先看大纲
              </Button>
              <Button
                variant="primary"
                size="md"
                id="pg-gen-run-btn"
                disabled={busy}
                loading={generating}
                loadingText="生成中…"
                leftIcon={<Sparkles size={15} />}
                onClick={() => onGenerate()}
              >
                开始生成
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
