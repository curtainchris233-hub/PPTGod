"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileCode,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Link2,
  ListOrdered,
  Lock,
  Maximize2,
  Play,
  Redo2,
  Save,
  Sparkles,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import AiAmbientAccent from "@/components/AiAmbientAccent";
import SlideCanvas from "@/components/SlideCanvas";
import DeckAuditDrawer from "@/components/generate/DeckAuditDrawer";
import DeckSpecTweaker from "@/components/generate/DeckSpecTweaker";
import ExportPromptModal from "@/components/generate/ExportPromptModal";
import OutlineDraftPanel from "@/components/generate/OutlineDraftPanel";
import SlidePropertyInspector from "@/components/generate/SlidePropertyInspector";
import SlideTreeSidebar from "@/components/generate/SlideTreeSidebar";
import { useApp } from "@/context/AppContext";
import {
  createDefaultSlideOfType,
  generateStructuredDeck,
  SOURCE_MATERIAL_PRESETS,
  type PolishAction,
} from "@/lib/deckGenerator";
import { autoFillMissingSpeakerNotes } from "@/lib/deckLinter";
import { exportStandaloneHtmlDeck } from "@/lib/htmlExporter";
import { autoFixPaletteContrast } from "@/lib/paletteExtractor";
import { buildSlideImagePrompt } from "@/lib/promptCompiler";
import {
  clearDocIntakeHandoff,
  readDocIntakeHandoff,
} from "@/lib/docIntakeHandoff";
import { clearStudioHandoff, readStudioHandoff } from "@/lib/studioHandoff";
import {
  DOMAIN_TABS,
  SLIDE_TYPE_LABELS,
  type DeckSlideItem,
  type DocumentAnalysisResult,
  type OutlineDraftItem,
  type PromptItem,
  type SavedDeck,
  type SlideType,
  type VisualSpec,
} from "@/types/prompt";
import "@/styles/generate.css";

interface GenerateClientProps {
  styles: PromptItem[];
  initialStyleSlug: string;
  initialTopic: string;
  initialDeck: SavedDeck | null;
  deckForbidden: boolean;
  initialHandoff?: boolean;
  initialIntake?: boolean;
  /** Deep-linked panel to open on arrival (`/generate?panel=audit`). */
  initialPanel?: "audit";
}

const MAX_HISTORY_SNAPSHOTS = 40;
const MAX_UPLOAD_IMG_BYTES = 400 * 1024;
const DRAFT_STORAGE_KEY = "pptgod_unsaved_draft_v4";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let clientIdSeq = 0;

function nextClientId(prefix: string): string {
  clientIdSeq += 1;
  return `${prefix}_${clientIdSeq}`;
}

interface LocalDraftSnapshot {
  styleSlug: string;
  topic: string;
  subtitle: string;
  audience: string;
  slideCount: number;
  deckSpec: VisualSpec;
  slides: DeckSlideItem[];
  savedAt: number;
}

function stripLargeImagesForDraft(slides: DeckSlideItem[]): DeckSlideItem[] {
  return slides.map((s) => {
    if (
      s.imageSlot?.kind === "data-url" &&
      typeof s.imageSlot.dataUrl === "string" &&
      s.imageSlot.dataUrl.length > 100_000
    ) {
      return {
        ...s,
        imageSlot: {
          ...s.imageSlot,
          kind: "svg-preset",
          dataUrl: undefined,
        },
      };
    }
    return s;
  });
}

function readLocalDraft(): LocalDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraftSnapshot>;
    if (
      !parsed ||
      typeof parsed.topic !== "string" ||
      !Array.isArray(parsed.slides) ||
      parsed.slides.length === 0 ||
      !parsed.deckSpec ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed as LocalDraftSnapshot;
  } catch {
    return null;
  }
}

function clearLocalDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Client-side HTML5 Canvas image compressor:
 * downscales to max edge 1280px and reduces JPEG quality until <= 400KB.
 */
async function compressImageToDataUrl(file: File): Promise<{
  dataUrl: string;
  sizeKb: number;
}> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("图片解码失败"));
      el.src = bitmapUrl;
    });

    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持 Canvas 压缩");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const qualities = [0.86, 0.74, 0.62, 0.5];
    let bestUrl = canvas.toDataURL("image/jpeg", 0.82);
    for (const q of qualities) {
      const candidate = canvas.toDataURL("image/jpeg", q);
      bestUrl = candidate;
      const approxBytes = Math.round((candidate.length * 3) / 4);
      if (approxBytes <= MAX_UPLOAD_IMG_BYTES) {
        return {
          dataUrl: candidate,
          sizeKb: Math.max(1, Math.round(approxBytes / 1024)),
        };
      }
    }
    const approxBytes = Math.round((bestUrl.length * 3) / 4);
    return {
      dataUrl: bestUrl,
      sizeKb: Math.max(1, Math.round(approxBytes / 1024)),
    };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export default function GenerateClient({
  styles,
  initialStyleSlug,
  initialTopic,
  initialDeck,
  deckForbidden,
  initialHandoff = false,
  initialIntake = false,
  initialPanel,
}: GenerateClientProps) {
  const { user, openAuthModal, showToast, refreshAuth } = useApp();

  const initialStyle = useMemo(
    () => styles.find((s) => s.slug === initialStyleSlug) || styles[0],
    [styles, initialStyleSlug]
  );

  const [selectedSlug, setSelectedSlug] = useState(initialStyle?.slug || "");
  const activeStyle = useMemo(
    () => styles.find((s) => s.slug === selectedSlug) || styles[0],
    [styles, selectedSlug]
  );

  // Deck-level independent VisualSpec (v4): honors initialDeck.visualSpec, Studio handoff, or inline tweaks
  const [deckSpec, setDeckSpec] = useState<VisualSpec>(
    () => initialDeck?.visualSpec || initialStyle?.visualSpec
  );
  const [handoffApplied, setHandoffApplied] = useState(false);

  const [configOpen, setConfigOpen] = useState(!initialDeck);
  const [styleStripOpen, setStyleStripOpen] = useState(false);
  const [advConfigOpen, setAdvConfigOpen] = useState(false);
  const [topic, setTopic] = useState(
    initialDeck?.title ||
      initialTopic ||
      initialStyle?.sampleTopic ||
      "2026 AI 产品战略与架构升级方案"
  );
  const [subtitle, setSubtitle] = useState(
    initialDeck?.subtitle ||
      initialStyle?.sampleSubtitle ||
      "以确定性设计系统重构团队交付效率"
  );
  const [audience, setAudience] = useState(
    initialDeck?.audience || "核心决策层与业务团队"
  );
  const [slideCount, setSlideCount] = useState(
    Math.max(5, Math.min(20, initialDeck?.slides?.length || 7))
  );
  const [sourceText, setSourceText] = useState("");
  const [engineMode, setEngineMode] = useState<"smart" | "llm">("smart");
  const [apiBase, setApiBase] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4o-mini");

  // Document Upload State (v3 + v4 reverse .pptx + v7 smart style analysis)
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [docDragging, setDocDragging] = useState(false);
  const [parsingDoc, setParsingDoc] = useState(false);
  const [uploadedDocMeta, setUploadedDocMeta] = useState<{
    fileName: string;
    charCount: number;
    warning?: string;
  } | null>(null);
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysisResult | null>(
    null
  );

  // 2-Step Controllable Outline State (v3)
  const [outlineDraft, setOutlineDraft] = useState<OutlineDraftItem[] | null>(
    null
  );
  const [generatingOutline, setGeneratingOutline] = useState(false);

  // Slides + Undo/Redo History Stack (v3)
  const [slides, setSlides] = useState<DeckSlideItem[]>(() => {
    if (initialDeck?.slides && initialDeck.slides.length > 0) {
      return initialDeck.slides;
    }
    return generateStructuredDeck({
      topic:
        initialTopic ||
        initialStyle?.sampleTopic ||
        "2026 AI 产品战略与架构升级方案",
      subtitle:
        initialStyle?.sampleSubtitle || "以确定性设计系统重构团队交付效率",
      audience: "核心决策层与业务团队",
      slideCount: 7,
      scenario: initialStyle?.scenario,
      archetype: initialStyle?.visualSpec.layout.archetype,
    });
  });

  const [pastHistory, setPastHistory] = useState<DeckSlideItem[][]>([]);
  const [futureHistory, setFutureHistory] = useState<DeckSlideItem[][]>([]);
  const lastTextSnapshotAtRef = useRef<number>(0);

  // Local Auto-Save Draft State (v4)
  const [pendingDraft, setPendingDraft] = useState<LocalDraftSnapshot | null>(
    null
  );
  const hasLocalEditsRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [newSlideType, setNewSlideType] = useState<SlideType>("image-split");

  // Image Manager State (v3)
  const [generatingImg, setGeneratingImg] = useState(false);
  const [imgModelName, setImgModelName] = useState("dall-e-3");
  const [imgPromptCopied, setImgPromptCopied] = useState(false);

  // Single-Slide Polish State (v3)
  const [polishingAction, setPolishingAction] = useState<PolishAction | null>(
    null
  );

  // Export Marp / Prompt Modal State (v4)
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [savedDeckId, setSavedDeckId] = useState<string | null>(
    initialDeck && (!user || initialDeck.authorId === user.id)
      ? initialDeck.id
      : null
  );
  const [isPublic, setIsPublic] = useState<boolean>(
    initialDeck ? initialDeck.isPublic : false
  );
  const isViewingForeignSharedDeck = Boolean(
    initialDeck && (!user || initialDeck.authorId !== user.id)
  );

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeIndex];
  const title = topic.trim() || activeStyle?.sampleTopic || "PPTGod Deck";

  // Mount effect: consume Drop-a-Doc intake OR Studio handoff OR check local auto-save draft
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;

      // v7: Seamless Drop-a-Doc Intake -> Auto-Generate PPT Pipeline
      if (!initialDeck && initialIntake) {
        const intake = readDocIntakeHandoff();
        if (intake) {
          clearDocIntakeHandoff();
          const matchedStyle =
            styles.find((s) => s.slug === intake.styleSlug) ||
            initialStyle ||
            styles[0];
          const nextSlideCount = Math.max(
            5,
            Math.min(20, intake.parsedOutline?.length || intake.slideCount || 8)
          );

          if (matchedStyle) {
            setSelectedSlug(matchedStyle.slug);
            setDeckSpec(matchedStyle.visualSpec);
          }
          if (intake.topic) setTopic(intake.topic);
          if (intake.subtitle) setSubtitle(intake.subtitle);
          if (intake.audience) setAudience(intake.audience);
          setSlideCount(nextSlideCount);
          if (intake.text) setSourceText(intake.text);
          // A typed topic from the dashboard is not a document — don't show a file chip.
          const isPromptIntake = intake.fileType === "prompt";
          if (!isPromptIntake) {
            setUploadedDocMeta({
              fileName: intake.fileName,
              charCount: intake.charCount,
            });
          }
          if (intake.analysis) setDocAnalysis(intake.analysis);
          if (intake.parsedOutline && intake.parsedOutline.length > 0) {
            setOutlineDraft(intake.parsedOutline);
          }

          if (intake.autoGenerate) {
            setGenerating(true);
            try {
              const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topic: intake.topic,
                  subtitle: intake.subtitle,
                  audience: intake.audience,
                  sourceText: intake.text,
                  slideCount: nextSlideCount,
                  scenario:
                    intake.analysis?.detectedScenario || matchedStyle?.scenario,
                  archetype: matchedStyle?.visualSpec.layout.archetype,
                  outline: intake.parsedOutline,
                  routeMode: intake.routeMode,
                  evidenceDensity: intake.evidenceDensity,
                  mode: "smart",
                }),
              });
              const data = await res.json();
              if (
                active &&
                res.ok &&
                Array.isArray(data.slides) &&
                data.slides.length > 0
              ) {
                setSlides(data.slides);
                setActiveIndex(0);
                setOutlineDraft(null);
                hasLocalEditsRef.current = true;
                showToast(
                  isPromptIntake
                    ? `已按主题「${intake.topic}」生成 ${data.slides.length} 页 PPT，可直接编辑`
                    : `已根据「${intake.fileName}」自动整理生成 ${data.slides.length} 页完整 PPT！`,
                  "success"
                );
              } else if (active) {
                showToast(
                  data.error || "自动整理演示文稿失败，请点击下方生成重试",
                  "error"
                );
              }
            } catch {
              if (active) {
                showToast("自动整理演示文稿网络异常，请点击下方生成重试", "error");
              }
            } finally {
              if (active) setGenerating(false);
            }
          } else {
            showToast(
              `已载入资料「${intake.fileName}」与推荐风格，可随时点击生成整套 PPT`,
              "success"
            );
          }
          return;
        }
      }

      if (!initialDeck) {
        const handoff = readStudioHandoff(initialStyleSlug || undefined);
        if (handoff && (initialHandoff || handoff.slug === initialStyleSlug)) {
          setDeckSpec(handoff.visualSpec);
          if (handoff.topic) setTopic(handoff.topic);
          if (handoff.subtitle) setSubtitle(handoff.subtitle);
          if (handoff.audience) setAudience(handoff.audience);
          setSlideCount(handoff.slideCount);
          setHandoffApplied(true);
          if (handoff.topic || handoff.subtitle) {
            setSlides((prev) =>
              prev.map((sl, i) =>
                i === 0 && sl.slideType === "cover"
                  ? {
                      ...sl,
                      title: handoff.topic || sl.title,
                      subtitle: handoff.subtitle || sl.subtitle,
                    }
                  : sl
              )
            );
          }
          showToast("已从提示词工作室无缝承接你微调的配色与参数！", "success");
          return;
        }
      }

      if (!initialDeck && !initialHandoff && !initialIntake) {
        const draft = readLocalDraft();
        if (draft) {
          setPendingDraft(draft);
        }
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced localStorage auto-save after any user edit
  useEffect(() => {
    if (!hasLocalEditsRef.current || isViewingForeignSharedDeck) return;
    const timer = window.setTimeout(() => {
      try {
        const snapshot: LocalDraftSnapshot = {
          styleSlug: selectedSlug,
          topic,
          subtitle,
          audience,
          slideCount,
          deckSpec,
          slides: stripLargeImagesForDraft(slides),
          savedAt: Date.now(),
        };
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify(snapshot)
        );
      } catch {
        // Ignore quota errors
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    selectedSlug,
    topic,
    subtitle,
    audience,
    slideCount,
    deckSpec,
    slides,
    isViewingForeignSharedDeck,
  ]);

  const handleSelectStyle = (slug: string) => {
    setSelectedSlug(slug);
    const matched = styles.find((s) => s.slug === slug);
    if (matched) {
      setDeckSpec(matched.visualSpec);
      setHandoffApplied(false);
      clearStudioHandoff();
      hasLocalEditsRef.current = true;
    }
  };

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.styleSlug) setSelectedSlug(pendingDraft.styleSlug);
    setTopic(pendingDraft.topic);
    setSubtitle(pendingDraft.subtitle);
    setAudience(pendingDraft.audience);
    setSlideCount(pendingDraft.slideCount);
    setDeckSpec(pendingDraft.deckSpec);
    setSlides(pendingDraft.slides);
    setActiveIndex(0);
    setPendingDraft(null);
    hasLocalEditsRef.current = true;
    showToast(
      `已恢复本地草稿「${pendingDraft.topic}」（共 ${pendingDraft.slides.length} 页）`,
      "success"
    );
  };

  const handleDismissDraft = () => {
    setPendingDraft(null);
    clearLocalDraft();
  };

  /**
   * Commits a slide mutation while pushing previous slides onto the Undo stack.
   * For rapid typing (groupText = true), snapshots are throttled every 900ms.
   */
  const commitSlides = useCallback(
    (
      updater: (prev: DeckSlideItem[]) => DeckSlideItem[],
      options?: { groupText?: boolean }
    ) => {
      hasLocalEditsRef.current = true;
      const now = Date.now();
      const shouldPush =
        !options?.groupText || now - lastTextSnapshotAtRef.current > 900;
      if (options?.groupText && shouldPush) {
        lastTextSnapshotAtRef.current = now;
      }
      if (!options?.groupText) {
        lastTextSnapshotAtRef.current = 0;
      }

      setSlides((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (shouldPush) {
          setPastHistory((h) => [
            ...h.slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
            prev,
          ]);
          setFutureHistory([]);
        }
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setPastHistory((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setSlides((current) => {
        setFutureHistory((f) => [
          current,
          ...f.slice(0, MAX_HISTORY_SNAPSHOTS - 1),
        ]);
        return previous;
      });
      setActiveIndex((idx) => Math.min(idx, Math.max(0, previous.length - 1)));
      showToast("已撤销上一步编辑");
      return prevPast.slice(0, -1);
    });
  }, [showToast]);

  const handleRedo = useCallback(() => {
    setFutureHistory((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[0];
      setSlides((current) => {
        setPastHistory((p) => [
          ...p.slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
          current,
        ]);
        return nextState;
      });
      setActiveIndex((idx) => Math.min(idx, Math.max(0, nextState.length - 1)));
      showToast("已重做编辑");
      return prevFuture.slice(1);
    });
  }, [showToast]);

  // Global keyboard shortcuts: Fullscreen nav + Ctrl/Cmd+Z Undo/Redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fullscreen) {
        if (e.key === "Escape") setFullscreen(false);
        if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          setActiveIndex((cur) => (cur + 1) % slides.length);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setActiveIndex((cur) => (cur - 1 + slides.length) % slides.length);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTextControl =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (!isTextControl && (e.ctrlKey || e.metaKey)) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          if (pastHistory.length > 0) {
            e.preventDefault();
            handleUndo();
          }
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          if (futureHistory.length > 0) {
            e.preventDefault();
            handleRedo();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    fullscreen,
    slides.length,
    pastHistory.length,
    futureHistory.length,
    handleUndo,
    handleRedo,
  ]);

  const updateCurrentSlide = (
    patch: Partial<DeckSlideItem>,
    groupText = true
  ) => {
    commitSlides(
      (prev) =>
        prev.map((sl, idx) => (idx === safeIndex ? { ...sl, ...patch } : sl)),
      { groupText }
    );
  };

  /* ====== Document Upload Handler (v3 + v4 reverse .pptx outline import) ====== */
  const handleDocumentFile = async (file: File) => {
    if (parsingDoc) return;
    setParsingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "文档解析失败", "error");
        return;
      }

      setUploadedDocMeta({
        fileName: data.fileName || file.name,
        charCount: Number(data.charCount) || 0,
        warning: data.warning,
      });

      const parsedAnalysis: DocumentAnalysisResult | null =
        data.analysis && typeof data.analysis === "object"
          ? (data.analysis as DocumentAnalysisResult)
          : null;
      setDocAnalysis(parsedAnalysis);

      if (typeof data.text === "string" && data.text.trim()) {
        setSourceText(data.text);
      }
      if (data.suggestedTopic && !data.isScannedPdf) {
        setTopic(data.suggestedTopic);
        commitSlides((prev) =>
          prev.map((sl, i) =>
            i === 0 && sl.slideType === "cover"
              ? {
                  ...sl,
                  title: data.suggestedTopic,
                  subtitle: data.suggestedSubtitle || sl.subtitle,
                }
              : sl
          )
        );
      }
      if (data.suggestedSubtitle && !data.isScannedPdf) {
        setSubtitle(data.suggestedSubtitle);
      }
      if (parsedAnalysis && !data.isScannedPdf) {
        if (parsedAnalysis.suggestedAudience) {
          setAudience(parsedAnalysis.suggestedAudience);
        }
        if (
          !(Array.isArray(data.parsedOutline) && data.parsedOutline.length > 0)
        ) {
          setSlideCount(
            Math.max(5, Math.min(20, parsedAnalysis.suggestedSlideCount || 8))
          );
        }
      }

      // v4: Reverse .pptx upload populates Step 1 Outline Editor immediately!
      if (Array.isArray(data.parsedOutline) && data.parsedOutline.length > 0) {
        setOutlineDraft(data.parsedOutline);
        setSlideCount(Math.max(5, Math.min(20, data.parsedOutline.length)));
        setConfigOpen(true);
        showToast(
          `已反解 .pptx「${data.fileName}」共 ${data.parsedOutline.length} 页大纲，点击渲染即可一键重塑母版风格！`,
          "success"
        );
        return;
      }

      if (data.isScannedPdf) {
        showToast("检测到扫描版 PDF，请查看提示说明", "error");
      } else {
        showToast(
          parsedAnalysis
            ? `已解析「${data.fileName}」（${data.charCount} 字）· 识别为「${parsedAnalysis.detectedScenario}」并推荐 Top 3 风格`
            : `已成功解析「${data.fileName}」（提取 ${data.charCount} 字）`,
          "success"
        );
      }
    } catch {
      showToast("上传文档网络异常，请重试", "error");
    } finally {
      setParsingDoc(false);
    }
  };

  /* ====== Step 1: Generate Editable Outline Draft (v3) ====== */
  const handleBuildOutline = async () => {
    if (!topic.trim()) {
      showToast("请先输入 PPT 主题", "error");
      return;
    }
    setGeneratingOutline(true);
    try {
      const res = await fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subtitle,
          audience,
          sourceText,
          slideCount,
          scenario: activeStyle?.scenario,
          mode: engineMode,
          ...(engineMode === "llm"
            ? { apiBase, apiKey, model: modelName }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "生成大纲草案失败", "error");
        return;
      }
      if (Array.isArray(data.outline) && data.outline.length > 0) {
        setOutlineDraft(data.outline);
        showToast(
          `已规划 ${data.outline.length} 页可编辑大纲，调整版式或标题后即可渲染全套 PPT！`,
          "success"
        );
      }
    } catch {
      showToast("大纲请求异常，请重试", "error");
    } finally {
      setGeneratingOutline(false);
    }
  };

  /* ====== Step 2 / Direct 1-Click Deck Generation ====== */
  const handleGenerate = async (customOutline?: OutlineDraftItem[]) => {
    if (!topic.trim()) {
      showToast("请先输入 PPT 主题", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subtitle,
          audience,
          sourceText,
          slideCount: customOutline ? customOutline.length : slideCount,
          scenario: activeStyle?.scenario,
          archetype: deckSpec.layout.archetype,
          outline: customOutline,
          mode: engineMode,
          ...(engineMode === "llm"
            ? { apiBase, apiKey, model: modelName }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "生成演示文稿失败", "error");
        return;
      }
      if (Array.isArray(data.slides) && data.slides.length > 0) {
        commitSlides(() => data.slides);
        setActiveIndex(0);
        if (customOutline) {
          setOutlineDraft(null);
        }
        showToast(
          `已通过${
            data.engine === "llm" ? "大模型 API" : "内置语义引擎"
          }生成 ${data.slides.length} 页完整幻灯片！`,
          "success"
        );
      }
    } catch {
      showToast("网络请求异常，请稍后重试", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = SOURCE_MATERIAL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTopic(preset.topic);
    setSubtitle(preset.subtitle);
    setAudience(preset.audience);
    setSourceText(preset.rawText);
    setUploadedDocMeta(null);
    setDocAnalysis(null);
    const nextSlides = generateStructuredDeck({
      topic: preset.topic,
      subtitle: preset.subtitle,
      audience: preset.audience,
      sourceText: preset.rawText,
      slideCount,
      scenario: activeStyle?.scenario,
      archetype: deckSpec.layout.archetype,
    });
    commitSlides(() => nextSlides);
    setActiveIndex(0);
    showToast(
      `已载入范例「${preset.label}」并生成 ${nextSlides.length} 页预览`,
      "success"
    );
  };

  /* ====== Slide Tree Operations ====== */
  const handleAddSlide = () => {
    const created = createDefaultSlideOfType(newSlideType, {
      index: slides.length,
      topic: title,
      subtitle,
      audience,
      scenario: activeStyle?.scenario,
      archetype: deckSpec.layout.archetype,
    });
    created.id = nextClientId(`slide_custom_${slides.length}`);
    commitSlides((prev) => [...prev, created]);
    setActiveIndex(slides.length);
  };

  const handleDuplicateSlide = (idx: number) => {
    const src = slides[idx];
    if (!src) return;
    const clone: DeckSlideItem = {
      ...structuredClone(src),
      id: nextClientId(`slide_dup_${idx}`),
      title: src.title.includes("副本") ? src.title : `${src.title}（副本）`,
    };
    commitSlides((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setActiveIndex(idx + 1);
    showToast(`已复制第 ${idx + 1} 页`, "success");
  };

  const handleDeleteSlide = (idx: number) => {
    if (slides.length <= 1) {
      showToast("至少保留 1 页幻灯片", "error");
      return;
    }
    commitSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIndex((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
    showToast(`已删除第 ${idx + 1} 页 · 可点撤销恢复`);
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    commitSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    if (safeIndex === idx) setActiveIndex(target);
  };

  const handleDropReorder = (fromIdx: number, toIdx: number) => {
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= slides.length ||
      toIdx >= slides.length
    ) {
      return;
    }
    commitSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setActiveIndex(toIdx);
  };

  /* ====== Single-Slide Smart Polish (v3) ====== */
  const handlePolishSlide = async (action: PolishAction) => {
    if (!currentSlide || polishingAction) return;
    setPolishingAction(action);
    try {
      const useLlm = engineMode === "llm" && apiKey.trim().length > 0;
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slide: currentSlide,
          action,
          mode: useLlm ? "llm" : "smart",
          ...(useLlm ? { apiBase, apiKey, model: modelName } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "单页润色失败", "error");
        return;
      }
      if (data.slide) {
        updateCurrentSlide(data.slide, false);
        const labelMap: Record<PolishAction, string> = {
          executive: "高管决策风提炼",
          metrics: "量化论据补充",
          notes: "演讲逐字稿润色",
        };
        showToast(
          `已完成本页「${labelMap[action]}」（可随时 Ctrl+Z 撤销）`,
          "success"
        );
      }
    } catch {
      showToast("润色请求异常，请重试", "error");
    } finally {
      setPolishingAction(null);
    }
  };

  /* ====== Image Manager Handlers (v3) ====== */
  const handleUploadSlideImage = async (file: File) => {
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      showToast("请上传 PNG、JPG 或 WebP 格式图片", "error");
      return;
    }
    try {
      const { dataUrl, sizeKb } = await compressImageToDataUrl(file);
      updateCurrentSlide(
        {
          imageSlot: {
            ...(currentSlide.imageSlot || { layout: "left" }),
            kind: "data-url",
            dataUrl,
            caption:
              currentSlide.imageSlot?.caption ||
              file.name.replace(/\.[^.]+$/, ""),
          },
        },
        false
      );
      showToast(`图片已自动压缩至 ${sizeKb}KB 并嵌入当前页`, "success");
    } catch {
      showToast("图片压缩处理失败，请更换图片重试", "error");
    }
  };

  const handleCopySlideImagePrompt = async () => {
    if (!activeStyle || !currentSlide) return;
    const text = buildSlideImagePrompt(
      activeStyle.title,
      activeStyle.englishTitle,
      deckSpec,
      currentSlide
    );
    try {
      await navigator.clipboard.writeText(text);
      setImgPromptCopied(true);
      showToast("已复制单页配图美术提示词（适配即梦 / Midjourney）", "success");
      window.setTimeout(() => setImgPromptCopied(false), 1800);
    } catch {
      showToast("剪贴板权限受限，请手动复制", "error");
    }
  };

  const handleGenerateAiSlideImage = async () => {
    if (!activeStyle || !currentSlide || generatingImg) return;
    setGeneratingImg(true);
    try {
      const promptText = buildSlideImagePrompt(
        activeStyle.title,
        activeStyle.englishTitle,
        deckSpec,
        currentSlide
      );
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          apiBase,
          apiKey,
          model: imgModelName,
          size: "1024x1024",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "AI 生图失败", "error");
        return;
      }
      if (data.dataUrl) {
        updateCurrentSlide(
          {
            imageSlot: {
              ...(currentSlide.imageSlot || { layout: "left" }),
              kind: "data-url",
              dataUrl: data.dataUrl,
            },
          },
          false
        );
        showToast("AI 配图生成成功并已嵌入本页！", "success");
      }
    } catch {
      showToast("AI 生图网络异常，请重试", "error");
    } finally {
      setGeneratingImg(false);
    }
  };

  /* ====== Export & Cloud Deck Handlers ====== */
  const handleExportPptx = async () => {
    if (!activeStyle || exportingPptx) return;
    setExportingPptx(true);
    try {
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          audience,
          styleName: activeStyle.title,
          visualSpec: deckSpec,
          slides,
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
      a.download = `${activeStyle.slug || "pptgod"}-deck.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("高保真 16:9 原生 .pptx 演示文稿已开始下载！", "success");
    } catch {
      showToast("导出失败，请重试", "error");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleExportHtml = () => {
    if (!activeStyle) return;
    const html = exportStandaloneHtmlDeck({
      title,
      subtitle,
      audience,
      styleName: activeStyle.title,
      spec: deckSpec,
      slides,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeStyle.slug || "pptgod"}-interactive.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      "离线交互 .html 演示包已导出（方向键翻页 / N 键看讲稿 / 打印即存 16:9 矢量 PDF）",
      "success"
    );
  };

  const handleSaveCloudDeck = async (overrideIsPublic?: boolean) => {
    if (!user) {
      showToast("请先登录后保存文稿至云端");
      openAuthModal("login");
      return;
    }
    if (!activeStyle || saving) return;
    setSaving(true);
    const targetVisibility =
      overrideIsPublic !== undefined ? overrideIsPublic : isPublic;
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isViewingForeignSharedDeck ? undefined : savedDeckId || undefined,
          title,
          subtitle,
          audience,
          promptId: activeStyle.id,
          promptSlug: activeStyle.slug,
          promptTitle: activeStyle.title,
          visualSpec: deckSpec,
          slides,
          isPublic: targetVisibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "保存失败", "error");
        return;
      }
      setSavedDeckId(data.deck.id);
      setIsPublic(Boolean(data.deck.isPublic));
      clearLocalDraft();
      hasLocalEditsRef.current = false;
      refreshAuth();
      showToast(
        isViewingForeignSharedDeck
          ? "已克隆并保存到你的云端文稿库！"
          : `已保存至云端文稿库（${
              data.deck.isPublic ? "公开演播分享" : "仅自己可见"
            }）`,
        "success"
      );
    } catch {
      showToast("保存失败，请检查网络", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    const nextPublic = !isPublic;
    setIsPublic(nextPublic);
    if (savedDeckId && user && !isViewingForeignSharedDeck) {
      const res = await fetch(`/api/decks/${savedDeckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: nextPublic }),
      });
      if (res.ok) {
        showToast(
          nextPublic
            ? "已开启公开演播分享链接 (/deck)，任何人持链接均可沉浸预览"
            : "已切换为私有，仅你本人可访问",
          "success"
        );
      }
    }
  };

  const handleCopyShareLink = async () => {
    if (!savedDeckId) return;
    const shareUrl = `${window.location.origin}/deck/${savedDeckId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      showToast("已复制纯净演播分享链接 (/deck)", "success");
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      showToast("复制失败", "error");
    }
  };

  if (!activeStyle || !currentSlide || !deckSpec) {
    return (
      <main className="pg-page">
        <div className="pg-container" style={{ paddingTop: "48px" }}>
          <div className="pg-empty-state">
            <h2>暂无可用视觉风格</h2>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pg-page">
      <div className="pg-container">
        {/* Compact Single-Row Top Bar (Figma Slides Style) */}
        <header className="pg-gen-topbar pg-gen-topbar--compact">
          <div className="pg-gen-title-group">
            <h1 className="pg-gen-compact-title">在线 PPT 工坊</h1>
            <select
              id="pg-gen-style-select"
              className="pg-select pg-gen-style-select-inline"
              aria-label="选择视觉母版风格"
              value={activeStyle.slug}
              onChange={(e) => handleSelectStyle(e.target.value)}
            >
              {(() => {
                const assigned = new Set<string>();
                const groups = DOMAIN_TABS.filter((t) => t.id !== "all").map(
                  (tab) => {
                    const items = styles.filter((st) => {
                      if (assigned.has(st.id)) return false;
                      if (tab.scenarios.includes(st.scenario)) {
                        assigned.add(st.id);
                        return true;
                      }
                      return false;
                    });
                    return { label: tab.label, items };
                  }
                );
                const remaining = styles.filter((st) => !assigned.has(st.id));
                if (remaining.length > 0) {
                  groups.push({ label: "社区自定义风格", items: remaining });
                }
                return groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <optgroup
                      key={g.label}
                      label={`${g.label} (${g.items.length})`}
                    >
                      {g.items.map((st) => (
                        <option key={st.id} value={st.slug}>
                          {st.title}
                        </option>
                      ))}
                    </optgroup>
                  ));
              })()}
            </select>
            <button
              type="button"
              className={`pg-btn pg-btn-ghost pg-btn-xs ${
                styleStripOpen ? "is-open" : ""
              }`}
              onClick={() => setStyleStripOpen((v) => !v)}
              id="pg-gen-toggle-styles-btn"
              title="展开 36 套风格可视化换肤条"
            >
              <Wand2 size={13} />
              <span>换肤 ({styles.length})</span>
            </button>
          </div>

          <div className="pg-gen-delivery-bar">
            <button
              type="button"
              className={`pg-gen-visibility-chip ${
                isPublic ? "is-public" : ""
              }`}
              onClick={handleToggleVisibility}
              id="pg-gen-visibility-btn"
              title={
                isPublic
                  ? "公开演播链接可访问（点击切换私有）"
                  : "仅自己可见（点击开启公开分享）"
              }
            >
              {isPublic ? <Globe size={13} /> : <Lock size={13} />}
              <span>{isPublic ? "公开" : "私有"}</span>
            </button>

            {savedDeckId && isPublic && (
              <>
                <Link
                  href={`/deck/${savedDeckId}`}
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  id="pg-gen-open-stage-btn"
                  title="打开纯净演播分享页"
                >
                  <Play size={13} />
                  <span>演播</span>
                </Link>
                <button
                  type="button"
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  onClick={handleCopyShareLink}
                  id="pg-gen-copy-share-btn"
                  title="复制纯净演播分享链接"
                >
                  {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
                  <span>{linkCopied ? "已复制" : "分享"}</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={() => handleSaveCloudDeck()}
              disabled={saving}
              id="pg-gen-save-deck-btn"
              aria-label={
                isViewingForeignSharedDeck
                  ? "克隆保存到我的云端文稿"
                  : savedDeckId
                  ? "保存更新到云端文稿"
                  : "保存到云端文稿"
              }
            >
              <Save size={13} />
              <span>
                {saving
                  ? "保存中..."
                  : isViewingForeignSharedDeck
                  ? "克隆保存"
                  : savedDeckId
                  ? "更新"
                  : "保存"}
              </span>
            </button>

            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={() => setExportModalOpen(true)}
              id="pg-gen-export-md-btn"
              title="导出 Marp Markdown 或 6 工具提示词"
            >
              <FileCode size={13} />
              <span>Marp / 词</span>
            </button>

            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={handleExportHtml}
              id="pg-gen-export-html-btn"
              title="导出离线交互 .html / 打印 PDF"
              aria-label="导出离线交互 .html"
            >
              <FileCode2 size={13} />
              <span>.html</span>
            </button>

            <button
              type="button"
              className="pg-btn pg-btn-primary pg-btn-sm"
              onClick={handleExportPptx}
              disabled={exportingPptx}
              id="pg-gen-export-pptx-btn"
            >
              <FileSpreadsheet size={13} />
              <span>{exportingPptx ? "导出中..." : "导出 .pptx"}</span>
            </button>
          </div>
        </header>

        {/* Local Unsaved Draft Auto-Recovery Banner (v4) */}
        {pendingDraft && (
          <div className="pg-draft-banner" id="pg-draft-restore-banner">
            <div className="pg-draft-banner-info">
              <History size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span>
                本地草稿「<strong>{pendingDraft.topic}</strong>」（{pendingDraft.slides.length} 页）
              </span>
            </div>
            <div className="pg-btn-group">
              <button
                type="button"
                className="pg-btn pg-btn-primary pg-btn-xs"
                onClick={handleRestoreDraft}
                id="pg-draft-restore-btn"
              >
                恢复草稿
              </button>
              <button
                type="button"
                className="pg-btn pg-btn-ghost pg-btn-xs"
                onClick={handleDismissDraft}
                id="pg-draft-dismiss-btn"
              >
                忽略
              </button>
            </div>
          </div>
        )}

        {deckForbidden && (
          <div
            className="pg-form-error"
            style={{ marginBottom: "12px" }}
            id="pg-gen-deck-forbidden"
          >
            请求的演示文稿为私有状态，已为你打开全新工作台。
          </div>
        )}

        {isViewingForeignSharedDeck && (
          <div className="pg-gen-banner" id="pg-gen-shared-banner">
            <span>
              预览公开文稿「{initialDeck?.title}」· 可自由换肤试编，点击「克隆保存」生成个人副本
            </span>
          </div>
        )}

        {/* Slim Canvas-First Command Bar (Tweaker + Audit + Single-Row Composer) */}
        <section
          className={`pg-gen-config-card pg-gen-config-card--slim ${
            docDragging ? "is-drag-over" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDocDragging(true);
          }}
          onDragLeave={() => setDocDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDocDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleDocumentFile(file);
          }}
        >
          <AiAmbientAccent variant="panel-corner" />

          {/* Optional Expandable 36-Style Visual Strip */}
          {styleStripOpen && (
            <div
              className="pg-gen-style-strip"
              role="radiogroup"
              aria-label="选择或一键切换 PPT 视觉风格"
            >
              {styles.map((st) => {
                const isSelected = st.slug === activeStyle.slug;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`pg-gen-style-pill ${isSelected ? "is-active" : ""}`}
                    onClick={() => handleSelectStyle(st.slug)}
                  >
                    <span
                      className="pg-gen-style-dot"
                      style={{
                        background: `linear-gradient(135deg, ${st.visualSpec.palette.bg} 45%, ${st.visualSpec.palette.accent} 45%)`,
                      }}
                    />
                    <span>{st.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Slim 1-Row Utility Bar: Brand Tweaker + Deck Audit + Toggle Composer */}
          <div className="pg-gen-utility-row">
            <div className="pg-gen-utility-modules">
              <DeckSpecTweaker
                deckSpec={deckSpec}
                baseSpec={activeStyle.visualSpec}
                handoffApplied={handoffApplied}
                onChangeSpec={(next) => {
                  hasLocalEditsRef.current = true;
                  setDeckSpec(next);
                }}
                onResetSpec={() => {
                  setDeckSpec(activeStyle.visualSpec);
                  setHandoffApplied(false);
                  clearStudioHandoff();
                  showToast("已恢复当前母版默认配色与版式", "default");
                }}
              />

              <DeckAuditDrawer
                defaultOpen={initialPanel === "audit"}
                slides={slides}
                spec={deckSpec}
                topic={topic}
                audience={audience}
                onJumpToSlide={(idx) => {
                  setActiveIndex(idx);
                  showToast(`已定位到第 ${idx + 1} 页，可在右侧直接优化`);
                }}
                onAutoFixContrast={() => {
                  hasLocalEditsRef.current = true;
                  setDeckSpec((prev) => ({
                    ...prev,
                    palette: autoFixPaletteContrast(prev.palette),
                  }));
                  showToast("已按 WCAG AA 投影可读标准一键校正色板对比度", "success");
                }}
                onAutoFillNotes={() => {
                  commitSlides((prev) =>
                    autoFillMissingSpeakerNotes(prev, topic, audience)
                  );
                  showToast("已为所有缺失备注页一键补齐自然口语提词讲稿", "success");
                }}
              />
            </div>

            <button
              type="button"
              className="pg-btn pg-btn-ghost pg-btn-xs pg-gen-collapse-btn"
              onClick={() => setConfigOpen((v) => !v)}
              id="pg-gen-toggle-config-btn"
            >
              <span>{configOpen ? "收起素材" : "展开素材配置"}</span>
              {configOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {configOpen && (
            <div className="pg-gen-composer">
              {/* Row 1: Single-Line Command Input + Upload + Page Count + Outline/Generate CTAs */}
              <div className="pg-gen-composer-bar">
                <input
                  ref={docInputRef}
                  id="pg-doc-upload-input"
                  type="file"
                  accept=".pdf,.docx,.pptx,.md,.txt"
                  className="pg-upload-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentFile(file);
                    e.target.value = "";
                  }}
                />

                <div className="pg-gen-topic-wrap">
                  <input
                    id="pg-gen-topic"
                    type="text"
                    className="pg-gen-topic-input"
                    value={topic}
                    onChange={(e) => {
                      const val = e.target.value;
                      hasLocalEditsRef.current = true;
                      setTopic(val);
                      setSlides((prev) =>
                        prev.map((sl, i) =>
                          i === 0 && sl.slideType === "cover"
                            ? { ...sl, title: val }
                            : sl
                        )
                      );
                    }}
                    placeholder="输入 PPT 主题，或直接拖入 PDF / Word / PPTX / TXT 文档..."
                  />
                </div>

                <button
                  type="button"
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  disabled={parsingDoc}
                  onClick={() => docInputRef.current?.click()}
                  id="pg-doc-upload-btn"
                  title="支持 .pdf、.docx、.pptx、.md、.txt（最大 10MB）"
                >
                  <Upload size={13} />
                  <span>{parsingDoc ? "解析中..." : "传文档"}</span>
                </button>

                <label
                  className="pg-gen-pages-pill"
                  htmlFor="pg-gen-count"
                  title="滑动调整规划页数（5–20 页）"
                >
                  <span>{slideCount} 页</span>
                  <input
                    id="pg-gen-count"
                    type="range"
                    min={5}
                    max={20}
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="pg-range pg-range--mini"
                  />
                </label>

                <button
                  type="button"
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  onClick={handleBuildOutline}
                  disabled={generatingOutline || generating}
                  id="pg-gen-outline-btn"
                >
                  <ListOrdered size={14} />
                  <span>{generatingOutline ? "规划中..." : "大纲"}</span>
                </button>

                <button
                  type="button"
                  className="pg-btn pg-btn-primary pg-btn-sm"
                  onClick={() => handleGenerate()}
                  disabled={generating || generatingOutline}
                  id="pg-gen-run-btn"
                >
                  <Sparkles size={14} />
                  <span>{generating ? "生成中..." : "一键生成"}</span>
                </button>
              </div>

              {/* Row 2: Single-Line Scrollable Presets + Progressive Disclosure Advanced Settings Toggle */}
              <div className="pg-gen-composer-sub">
                <div className="pg-gen-presets-scroll">
                  <span className="pg-preset-hint">范例：</span>
                  {SOURCE_MATERIAL_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pg-preset-chip"
                      onClick={() => handleApplyPreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={`pg-btn pg-btn-ghost pg-btn-xs pg-gen-adv-toggle ${
                    advConfigOpen ? "is-open" : ""
                  }`}
                  onClick={() => setAdvConfigOpen((v) => !v)}
                  id="pg-gen-adv-toggle-btn"
                  aria-expanded={advConfigOpen}
                >
                  <FileText size={12} />
                  <span>{advConfigOpen ? "收起详情" : "展开更多配置"}</span>
                  {advConfigOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* Uploaded Doc Badge + Warning + v7 Smart Top-3 Style Recommendations */}
              {uploadedDocMeta && (
                <div className="pg-upload-badge" id="pg-doc-upload-badge">
                  <span>
                    已载入：{uploadedDocMeta.fileName}（{uploadedDocMeta.charCount} 字）
                  </span>
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    onClick={() => {
                      setUploadedDocMeta(null);
                      setDocAnalysis(null);
                    }}
                    aria-label="清除文档提示"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {uploadedDocMeta?.warning && (
                <div className="pg-upload-warning" id="pg-doc-scan-warning">
                  {uploadedDocMeta.warning}
                </div>
              )}

              {docAnalysis && docAnalysis.recommendedStyles.length > 0 && (
                <div className="pg-gen-doc-recs" id="pg-gen-doc-recs">
                  <div className="pg-gen-doc-recs-head">
                    <div className="pg-gen-doc-recs-title">
                      <Sparkles size={13} />
                      <span>
                        识别场景：<strong>{docAnalysis.detectedScenario}</strong>（
                        {docAnalysis.confidence}%）· Top 3 风格
                      </span>
                    </div>
                    {docAnalysis.keyMetrics.length > 0 && (
                      <span className="pg-gen-doc-metrics-hint">
                        {docAnalysis.keyMetrics.slice(0, 3).join(" · ")}
                      </span>
                    )}
                  </div>

                  <div
                    className="pg-gen-doc-rec-pills"
                    role="group"
                    aria-label="文档智能推荐 PPT 风格"
                  >
                    {docAnalysis.recommendedStyles.map((rec, idx) => {
                      const matchedStyle = styles.find(
                        (s) => s.slug === rec.slug || s.id === rec.id
                      );
                      const isCurrent = activeStyle.slug === rec.slug;
                      return (
                        <button
                          key={rec.slug}
                          type="button"
                          data-rec-slug={rec.slug}
                          className={`pg-gen-doc-rec-btn ${
                            isCurrent ? "is-active" : ""
                          }`}
                          title={rec.reasons.join(" · ")}
                          onClick={() => {
                            handleSelectStyle(rec.slug);
                            showToast(
                              `已切换推荐风格「${rec.title}」（匹配度 ${rec.score}%）`,
                              "success"
                            );
                          }}
                        >
                          {matchedStyle && (
                            <span
                              className="pg-gen-style-dot"
                              style={{
                                background: `linear-gradient(135deg, ${matchedStyle.visualSpec.palette.bg} 45%, ${matchedStyle.visualSpec.palette.accent} 45%)`,
                              }}
                            />
                          )}
                          <span className="pg-gen-doc-rec-name">
                            #{idx + 1} {rec.title}
                          </span>
                          <span className="pg-gen-doc-rec-score">
                            {rec.score}%
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pg-gen-doc-recs-actions">
                    <button
                      type="button"
                      id="pg-gen-doc-autogen-btn"
                      className="pg-btn pg-btn-primary pg-btn-xs"
                      disabled={generating}
                      onClick={() =>
                        handleGenerate(outlineDraft ?? undefined)
                      }
                    >
                      <Sparkles size={12} />
                      <span>
                        {generating ? "生成中..." : "按文档生成整套 PPT"}
                      </span>
                    </button>
                    <button
                      type="button"
                      id="pg-gen-doc-prompt-btn"
                      className="pg-btn pg-btn-secondary pg-btn-xs"
                      onClick={() => setExportModalOpen(true)}
                    >
                      <FileCode size={12} />
                      <span>导出 Marp / 提示词</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Progressive Disclosure Drawer: Subtitle, Audience, Source Text & Custom LLM API */}
              {advConfigOpen && (
                <div className="pg-gen-config-grid pg-gen-adv-drawer">
                  <div className="pg-form pg-form-compact">
                    <div className="pg-form-2col">
                      <div className="pg-field">
                        <label htmlFor="pg-gen-subtitle">副标题</label>
                        <input
                          id="pg-gen-subtitle"
                          type="text"
                          value={subtitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            hasLocalEditsRef.current = true;
                            setSubtitle(val);
                            setSlides((prev) =>
                              prev.map((sl, i) =>
                                i === 0 && sl.slideType === "cover"
                                  ? { ...sl, subtitle: val }
                                  : sl
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="pg-field">
                        <label htmlFor="pg-gen-audience">目标受众</label>
                        <input
                          id="pg-gen-audience"
                          type="text"
                          value={audience}
                          onChange={(e) => {
                            hasLocalEditsRef.current = true;
                            setAudience(e.target.value);
                          }}
                        />
                      </div>
                    </div>
                    <div className="pg-field">
                      <label htmlFor="pg-gen-source">原始素材 / 正文要点（可选）</label>
                      <textarea
                        id="pg-gen-source"
                        rows={3}
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="粘贴会议纪要、PRD、教案或论文摘要，系统自动提炼章节与指标..."
                      />
                    </div>
                  </div>

                  <div className="pg-gen-engine-box">
                    <div className="pg-field">
                      <label>生成引擎</label>
                      <div className="pg-segmented">
                        <button
                          type="button"
                          className={`pg-seg-btn ${
                            engineMode === "smart" ? "is-active" : ""
                          }`}
                          onClick={() => setEngineMode("smart")}
                          id="pg-engine-smart-btn"
                        >
                          内置语义引擎（免 Key）
                        </button>
                        <button
                          type="button"
                          className={`pg-seg-btn ${
                            engineMode === "llm" ? "is-active" : ""
                          }`}
                          onClick={() => setEngineMode("llm")}
                          id="pg-engine-llm-btn"
                        >
                          自定义大模型 API
                        </button>
                      </div>
                    </div>

                    {engineMode === "smart" ? (
                      <p className="pg-tool-desc" style={{ margin: 0 }}>
                        开箱即用，支持 5–20 页全 12 种页型编排。
                      </p>
                    ) : (
                      <div className="pg-form pg-form-compact">
                        <div className="pg-form-2col">
                          <div className="pg-field">
                            <label htmlFor="pg-llm-base">API Base URL</label>
                            <input
                              id="pg-llm-base"
                              type="text"
                              value={apiBase}
                              onChange={(e) => setApiBase(e.target.value)}
                              placeholder="https://api.deepseek.com/v1"
                            />
                          </div>
                          <div className="pg-field">
                            <label htmlFor="pg-llm-model">模型名称</label>
                            <input
                              id="pg-llm-model"
                              type="text"
                              value={modelName}
                              onChange={(e) => setModelName(e.target.value)}
                              placeholder="gpt-4o-mini / deepseek-chat"
                            />
                          </div>
                        </div>
                        <div className="pg-field">
                          <label htmlFor="pg-llm-key">API Key（仅本次转发，不留存）</label>
                          <input
                            id="pg-llm-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 1 Editable Outline Panel */}
              {outlineDraft && (
                <OutlineDraftPanel
                  outlineDraft={outlineDraft}
                  generating={generating}
                  onChangeOutline={setOutlineDraft}
                  onClose={() => setOutlineDraft(null)}
                  onConfirmRender={(draft) => handleGenerate(draft)}
                />
              )}
            </div>
          )}
        </section>

        {/* 3-Column Live Workshop: Slide Tree | 16:9 Stage + Polish + Notes | WYSIWYG Inspector */}
        <section className="pg-gen-workspace" aria-label="幻灯片在线编辑器">
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
            onChangeNewSlideType={setNewSlideType}
            onSelectSlide={setActiveIndex}
            onDuplicateSlide={handleDuplicateSlide}
            onMoveSlide={handleMoveSlide}
            onDeleteSlide={handleDeleteSlide}
            onDropReorder={handleDropReorder}
            onAddSlide={handleAddSlide}
          />

          {/* CENTER: 16:9 Stage + Undo/Redo + Single-Slide Polish Bar + Speaker Notes */}
          <div className="pg-gen-center">
            <div className="pg-stage-frame">
              <div className="pg-stage-toolbar">
                <div className="pg-stage-slide-indicator">
                  <span className="pg-mono-pill">
                    P{String(safeIndex + 1).padStart(2, "0")} /{" "}
                    {String(slides.length).padStart(2, "0")}
                  </span>
                  <span className="pg-stage-slide-desc">
                    {SLIDE_TYPE_LABELS[currentSlide.slideType].label} ·{" "}
                    {activeStyle.title}
                  </span>
                </div>
                <div className="pg-gen-stage-actions">
                  <button
                    type="button"
                    className="pg-mini-action"
                    disabled={pastHistory.length === 0}
                    onClick={handleUndo}
                    id="pg-gen-undo-btn"
                    title="撤销上一步修改 (Ctrl+Z)"
                    aria-label="撤销"
                  >
                    <Undo2 size={13} />
                    <span>撤销</span>
                  </button>
                  <button
                    type="button"
                    className="pg-mini-action"
                    disabled={futureHistory.length === 0}
                    onClick={handleRedo}
                    id="pg-gen-redo-btn"
                    title="重做修改 (Ctrl+Shift+Z)"
                    aria-label="重做"
                  >
                    <Redo2 size={13} />
                    <span>重做</span>
                  </button>
                  <button
                    type="button"
                    className="pg-mini-action"
                    onClick={() => setFullscreen(true)}
                    id="pg-gen-fullscreen-btn"
                  >
                    <Maximize2 size={13} />
                    <span>全屏演播</span>
                  </button>
                </div>
              </div>

              <div className="pg-stage-canvas-wrap">
                <div
                  className="pg-canvas-motion-slot"
                  key={`${currentSlide.id}-${currentSlide.slideType}`}
                >
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

            {/* Single-Slide Smart Polish Bar */}
            <div className="pg-polish-bar" aria-label="单页智能润色工具栏">
              <span className="pg-polish-label">
                <Sparkles size={14} style={{ color: "var(--accent)" }} />
                <span>单页智能润色：</span>
              </span>
              <div className="pg-polish-actions">
                <button
                  type="button"
                  className="pg-polish-chip"
                  disabled={polishingAction !== null}
                  onClick={() => handlePolishSlide("executive")}
                  id="pg-polish-executive-btn"
                >
                  {polishingAction === "executive" ? "润色中..." : "提炼高管风"}
                </button>
                <button
                  type="button"
                  className="pg-polish-chip"
                  disabled={polishingAction !== null}
                  onClick={() => handlePolishSlide("metrics")}
                  id="pg-polish-metrics-btn"
                >
                  {polishingAction === "metrics" ? "补充中..." : "补充量化论据"}
                </button>
                <button
                  type="button"
                  className="pg-polish-chip"
                  disabled={polishingAction !== null}
                  onClick={() => handlePolishSlide("notes")}
                  id="pg-polish-notes-btn"
                >
                  {polishingAction === "notes" ? "生成中..." : "润色演讲逐字稿"}
                </button>
              </div>
            </div>

            <div className="pg-gen-notes-box">
              <label htmlFor="pg-gen-speaker-notes">
                演讲者备注（演讲逐字稿，导出 .pptx、交互 .html 与 Marp 时将一并写入）
              </label>
              <textarea
                id="pg-gen-speaker-notes"
                rows={3}
                value={currentSlide.speakerNotes || ""}
                onChange={(e) =>
                  updateCurrentSlide({ speakerNotes: e.target.value })
                }
                placeholder="填写本页演讲逐字稿、口语串词或演讲者备注..."
              />
            </div>
          </div>

          {/* RIGHT: Contextual WYSIWYG Slide Inspector (All 12 Slide Types) */}
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
            onChangeImgModelName={setImgModelName}
            onUploadSlideImage={handleUploadSlideImage}
            onCopySlideImagePrompt={handleCopySlideImagePrompt}
            onGenerateAiSlideImage={handleGenerateAiSlideImage}
            onUpdateSlide={updateCurrentSlide}
          />
        </section>
      </div>

      {/* Real-Deck Marp Markdown / Claude & Gamma Prompt Export Modal (v4) */}
      <ExportPromptModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={title}
        subtitle={subtitle}
        audience={audience}
        styleName={activeStyle.title}
        spec={deckSpec}
        slides={slides}
        onNotify={showToast}
      />

      {/* Fullscreen Roadshow Modal */}
      {fullscreen && (
        <div
          className="pg-presenter-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="全屏路演播放"
        >
          <div className="pg-presenter-bar">
            <div className="pg-presenter-info">
              <span>{title}</span>
              <span className="pg-presenter-counter">
                {safeIndex + 1} / {slides.length} ·{" "}
                {SLIDE_TYPE_LABELS[currentSlide.slideType].label}
              </span>
            </div>
            <div className="pg-presenter-controls">
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() =>
                  setActiveIndex(
                    (safeIndex - 1 + slides.length) % slides.length
                  )
                }
                aria-label="上一页"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() => setActiveIndex((safeIndex + 1) % slides.length)}
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
          {currentSlide.speakerNotes && (
            <p
              className="pg-presenter-hint"
              style={{ maxWidth: "820px", textAlign: "center" }}
            >
              讲稿备注：{currentSlide.speakerNotes}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
