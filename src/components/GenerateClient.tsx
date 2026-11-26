"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import ExportPromptModal from "@/components/generate/ExportPromptModal";
import PresentationEditorView, {
  type PendingPolishProposal,
} from "@/components/generate/PresentationEditorView";
import WorkshopWizardView, {
  type UploadedFileRecord,
} from "@/components/generate/WorkshopWizardView";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  createDefaultSlideOfType,
  generateStructuredDeck,
  type PolishAction,
} from "@/lib/deckGenerator";
import { autoFillMissingSpeakerNotes } from "@/lib/deckLinter";
import {
  clearDocIntakeHandoff,
  readDocIntakeHandoff,
} from "@/lib/docIntakeHandoff";
import { exportStandaloneHtmlDeck } from "@/lib/htmlExporter";
import { autoFixPaletteContrast } from "@/lib/paletteExtractor";
import { buildSlideImagePrompt } from "@/lib/promptCompiler";
import { clearStudioHandoff, readStudioHandoff } from "@/lib/studioHandoff";
import {
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
import "@/styles/workshop.css";

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
const TARGET_IMAGE_DATA_URL_CHARS = Math.floor((400 * 1024 * 4) / 3);
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

async function compressImageToDataUrl(file: File): Promise<{
  dataUrl: string;
  sizeKb: number;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
  return compressImageDataUrl(rawDataUrl);
}

async function compressImageDataUrl(rawDataUrl: string): Promise<{ dataUrl: string; sizeKb: number }> {
  if (rawDataUrl.length <= TARGET_IMAGE_DATA_URL_CHARS) {
    return { dataUrl: rawDataUrl, sizeKb: Math.round((rawDataUrl.length * 0.75) / 1024) };
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("图片解码失败"));
    el.src = rawDataUrl;
  });

  const maxEdge = 1280;
  let w = img.width;
  let h = img.height;
  if (w > maxEdge || h > maxEdge) {
    const scale = maxEdge / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("图片压缩失败");
  ctx.drawImage(img, 0, 0, w, h);

  for (const quality of [0.84, 0.72, 0.58, 0.46]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= TARGET_IMAGE_DATA_URL_CHARS) {
      return { dataUrl, sizeKb: Math.round((dataUrl.length * 0.75) / 1024) };
    }
  }
  throw new Error("图片压缩后仍过大");
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
  const { setEditorFullBleed } = useLayout();

  const initialStyle = useMemo(
    () => styles.find((s) => s.slug === initialStyleSlug) || styles[0],
    [styles, initialStyleSlug]
  );

  // Two-stage flow: Workshop Wizard (PNG-3) vs Full-Bleed Presentation Editor (PNG-4)
  const [mode, setMode] = useState<"workshop" | "editor">(() =>
    initialDeck || initialPanel === "audit" ? "editor" : "workshop"
  );
  const [auditOpen, setAuditOpen] = useState<boolean>(
    initialPanel === "audit"
  );

  // Collapse global left navigation sidebar whenever in full-bleed Presentation Editor mode.
  useEffect(() => {
    setEditorFullBleed(mode === "editor");
    if (mode === "editor" && typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
      document.getElementById("main-content")?.scrollTo({ top: 0 });
    }
    return () => setEditorFullBleed(false);
  }, [mode, setEditorFullBleed]);

  const [selectedSlug, setSelectedSlug] = useState(initialStyle?.slug || "");
  const activeStyle = useMemo(
    () => styles.find((s) => s.slug === selectedSlug) || styles[0],
    [styles, selectedSlug]
  );

  const [deckSpec, setDeckSpec] = useState<VisualSpec>(
    () => initialDeck?.visualSpec || initialStyle?.visualSpec
  );
  const [handoffApplied, setHandoffApplied] = useState(false);

  const [topic, setTopic] = useState(
    initialDeck?.title || initialTopic || ""
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
    Math.max(5, Math.min(20, initialDeck?.slides?.length || 8))
  );
  const [sourceText, setSourceText] = useState("");
  const [engineMode, setEngineMode] = useState<"smart" | "llm">("smart");
  const [apiBase, setApiBase] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4o-mini");

  // Document Upload State
  const [parsingDoc, setParsingDoc] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysisResult | null>(
    null
  );

  // Step 2 Editable Outline State
  const [outlineDraft, setOutlineDraft] = useState<OutlineDraftItem[] | null>(
    null
  );
  const [generatingOutline, setGeneratingOutline] = useState(false);

  // Slides + Undo/Redo History Stack
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
      slideCount: 8,
      scenario: initialStyle?.scenario,
      archetype: initialStyle?.visualSpec.layout.archetype,
    });
  });

  const [pastHistory, setPastHistory] = useState<DeckSlideItem[][]>([]);
  const [futureHistory, setFutureHistory] = useState<DeckSlideItem[][]>([]);
  const lastTextSnapshotAtRef = useRef<number>(0);

  // Local Auto-Save Draft State
  const [pendingDraft, setPendingDraft] = useState<LocalDraftSnapshot | null>(
    null
  );
  const hasLocalEditsRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!initialDeck);

  const [activeIndex, setActiveIndex] = useState(0);
  const [newSlideType, setNewSlideType] = useState<SlideType>("image-split");

  // Image Manager State
  const [generatingImg, setGeneratingImg] = useState(false);
  const [imgModelName, setImgModelName] = useState("dall-e-3");
  const [imgPromptCopied, setImgPromptCopied] = useState(false);

  // Single-Slide Polish State (B13: Preview + Confirm)
  const [polishingAction, setPolishingAction] = useState<PolishAction | null>(
    null
  );
  const [pendingPolish, setPendingPolish] =
    useState<PendingPolishProposal | null>(null);

  // Export Marp / Prompt Modal State
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
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeIndex];
  const title = topic.trim() || activeStyle?.sampleTopic || "PPTGod Deck";

  // Mount effect: consume Doc Intake OR Studio handoff OR check local auto-save draft
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;

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

          const isPromptIntake = intake.fileType === "prompt";
          if (!isPromptIntake && intake.fileName) {
            setUploadedFiles([
              {
                id: nextClientId("intake_doc"),
                fileName: intake.fileName,
                charCount: intake.charCount,
              },
            ]);
          }
          if (intake.analysis) setDocAnalysis(intake.analysis);
          if (intake.parsedOutline && intake.parsedOutline.length > 0) {
            setOutlineDraft(intake.parsedOutline);
          }

          if (intake.autoGenerate) {
            setGenerating(true);
            setGenError(null);
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
                setHasUnsavedChanges(true);
                setMode("editor");
                showToast(
                  isPromptIntake
                    ? `已按主题「${intake.topic}」生成 ${data.slides.length} 页 PPT，可直接编辑`
                    : `已根据「${intake.fileName}」自动整理生成 ${data.slides.length} 页完整 PPT！`,
                  "success"
                );
              } else if (active) {
                const err = data.error || "自动整理演示文稿失败，请重试";
                setGenError(err);
                showToast(err, "error");
              }
            } catch {
              if (active) {
                const err = "自动整理演示文稿网络异常，请重试";
                setGenError(err);
                showToast(err, "error");
              }
            } finally {
              if (active) setGenerating(false);
            }
          } else {
            showToast(
              `已载入资料「${intake.fileName}」与推荐风格，可随时点击开始生成`,
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
          topic: title,
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
    title,
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
      setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
    setMode("editor");
    showToast(
      `已恢复本地草稿「${pendingDraft.topic}」（共 ${pendingDraft.slides.length} 页）`,
      "success"
    );
  };

  const handleDismissDraft = () => {
    setPendingDraft(null);
    clearLocalDraft();
  };

  const commitSlides = useCallback(
    (
      updater: (prev: DeckSlideItem[]) => DeckSlideItem[],
      options?: { groupText?: boolean }
    ) => {
      hasLocalEditsRef.current = true;
      setHasUnsavedChanges(true);
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
      setPendingPolish(null);
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
      setPendingPolish(null);
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

  const handleTopicChange = (val: string) => {
    hasLocalEditsRef.current = true;
    setHasUnsavedChanges(true);
    setTopic(val);
    setSlides((prev) =>
      prev.map((sl, i) =>
        i === 0 && sl.slideType === "cover" ? { ...sl, title: val } : sl
      )
    );
  };

  const handleSubtitleChange = (val: string) => {
    hasLocalEditsRef.current = true;
    setHasUnsavedChanges(true);
    setSubtitle(val);
    setSlides((prev) =>
      prev.map((sl, i) =>
        i === 0 && sl.slideType === "cover" ? { ...sl, subtitle: val } : sl
      )
    );
  };

  /* ====== Document Upload Handler ====== */
  const handleDocumentFile = async (file: File) => {
    if (parsingDoc) return;
    setUploadError(null);
    if (file.size === 0) {
      const msg = `「${file.name}」文件内容为空（0 字节），请重新选择有效文档`;
      setUploadError(msg);
      showToast(msg, "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = `「${file.name}」文件大小超过 10 MB 上限，请压缩或拆分后上传`;
      setUploadError(msg);
      showToast(msg, "error");
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (!["pdf", "docx", "pptx", "md", "txt"].includes(ext)) {
      const msg = `暂不支持「${file.name}」格式（.${ext || "未知"}），请上传 .pdf、.docx、.pptx、.md 或 .txt 文件`;
      setUploadError(msg);
      showToast(msg, "error");
      return;
    }

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
        const msg = data.error || "文档解析失败";
        setUploadError(msg);
        showToast(msg, "error");
        return;
      }

      const record: UploadedFileRecord = {
        id: nextClientId("upload_doc"),
        fileName: data.fileName || file.name,
        sizeBytes: file.size,
        charCount: Number(data.charCount) || 0,
        warning: data.warning,
      };
      setUploadedFiles([record]);

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

      if (Array.isArray(data.parsedOutline) && data.parsedOutline.length > 0) {
        setOutlineDraft(data.parsedOutline);
        setSlideCount(Math.max(5, Math.min(20, data.parsedOutline.length)));
        showToast(
          `已反解 .pptx「${data.fileName}」共 ${data.parsedOutline.length} 页大纲，调整后即可生成！`,
          "success"
        );
        return;
      }

      if (data.isScannedPdf) {
        showToast("检测到扫描版 PDF，请查看提示说明", "error");
      } else {
        showToast(
          parsedAnalysis
            ? `已解析「${data.fileName}」（${data.charCount} 字）· 识别为「${parsedAnalysis.detectedScenario}」`
            : `已成功解析「${data.fileName}」（提取 ${data.charCount} 字）`,
          "success"
        );
      }
    } catch {
      const msg = "上传文档网络异常，请重试";
      setUploadError(msg);
      showToast(msg, "error");
    } finally {
      setParsingDoc(false);
    }
  };

  const handleRemoveUploadedFile = (id: string) => {
    setUploadedFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) {
        setDocAnalysis(null);
        setSourceText("");
      }
      return next;
    });
    setUploadError(null);
    showToast("已移除文档", "default");
  };

  /* ====== Step 2: Generate Editable Outline Draft ====== */
  const handleBuildOutline = async () => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setGenError("请先输入演示文稿主题");
      showToast("请先输入演示文稿主题", "error");
      return;
    }
    if (generatingOutline || generating) return;
    setGeneratingOutline(true);
    setGenError(null);
    try {
      const res = await fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cleanTopic,
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
        const msg = data.error || "生成大纲草案失败";
        setGenError(msg);
        showToast(msg, "error");
        return;
      }
      if (Array.isArray(data.outline) && data.outline.length > 0) {
        setOutlineDraft(data.outline);
        showToast(
          `已规划 ${data.outline.length} 页可编辑大纲，调整标题或页数后即可确认生成`,
          "success"
        );
      }
    } catch {
      const msg = "大纲请求异常，请重试";
      setGenError(msg);
      showToast(msg, "error");
    } finally {
      setGeneratingOutline(false);
    }
  };

  /* ====== Step 3: Deck Generation -> Transitions to Editor ====== */
  const handleGenerate = async (customOutline?: OutlineDraftItem[]) => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setGenError("请先输入演示文稿主题");
      showToast("请先输入演示文稿主题", "error");
      return;
    }
    if (generating || generatingOutline) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cleanTopic,
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
        const msg = data.error || "生成演示文稿失败，请重试";
        setGenError(msg);
        showToast(msg, "error");
        return;
      }
      if (Array.isArray(data.slides) && data.slides.length > 0) {
        commitSlides(() => data.slides);
        setActiveIndex(0);
        setPendingPolish(null);
        if (customOutline) {
          setOutlineDraft(null);
        }
        setMode("editor");
        showToast(
          `已通过${
            data.engine === "llm" ? "大模型 API" : "内置语义引擎"
          }生成 ${data.slides.length} 页完整幻灯片！`,
          "success"
        );
      }
    } catch {
      const msg = "网络请求异常，请点击重试";
      setGenError(msg);
      showToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  /* ====== Slide Tree Operations ====== */
  const handleSelectSlide = (idx: number) => {
    setActiveIndex(idx);
    setPendingPolish(null);
  };

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
    setPendingPolish(null);
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

  /* ====== Single-Slide Smart Polish (Honest B13: Preview -> Confirm) ====== */
  const handleRequestPolish = async (action: PolishAction) => {
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
        setPendingPolish({
          action,
          slideId: currentSlide.id,
          proposed: data.slide as DeckSlideItem,
        });
      }
    } catch {
      showToast("润色请求异常，请重试", "error");
    } finally {
      setPolishingAction(null);
    }
  };

  const handleConfirmPolish = () => {
    if (!pendingPolish) return;
    const { proposed, slideId } = pendingPolish;
    commitSlides(
      (prev) =>
        prev.map((sl, idx) =>
          sl.id === slideId || idx === safeIndex ? { ...sl, ...proposed } : sl
        ),
      { groupText: false }
    );
    setPendingPolish(null);
    showToast("已应用 AI 优化建议（可随时 Ctrl+Z 撤销）", "success");
  };

  const handleDiscardPolish = () => {
    setPendingPolish(null);
  };

  /* ====== Image Manager Handlers ====== */
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
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setImgPromptCopied(true);
      showToast("已复制单页配图美术提示词（适配即梦 / Midjourney）", "success");
      window.setTimeout(() => setImgPromptCopied(false), 1800);
    } else {
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
      if (typeof data.dataUrl === "string" && data.dataUrl) {
        const { dataUrl } = await compressImageDataUrl(data.dataUrl);
        updateCurrentSlide(
          {
            imageSlot: {
              ...(currentSlide.imageSlot || { layout: "left" }),
              kind: "data-url",
              dataUrl,
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
      setHasUnsavedChanges(false);
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
            ? "已开启公开演播分享链接 (/deck)"
            : "已切换为仅自己可见",
          "success"
        );
      }
    }
  };

  const handleCopyShareLink = async () => {
    if (!savedDeckId) return;
    const shareUrl = `${window.location.origin}/deck/${savedDeckId}`;
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setLinkCopied(true);
      showToast("已复制纯净演播分享链接 (/deck)", "success");
      window.setTimeout(() => setLinkCopied(false), 1800);
    } else {
      showToast("复制失败", "error");
    }
  };

  if (!activeStyle || !currentSlide || !deckSpec) {
    return (
      <main className="gl-ws">
        <p>暂无可用视觉风格</p>
      </main>
    );
  }

  return (
    <main className={mode === "editor" ? "gl-ed-root" : "gl-ws-root"}>
      {mode === "workshop" ? (
        <WorkshopWizardView
          styles={styles}
          activeStyle={activeStyle}
          deckSpec={deckSpec}
          topic={topic}
          subtitle={subtitle}
          audience={audience}
          slideCount={slideCount}
          sourceText={sourceText}
          engineMode={engineMode}
          apiBase={apiBase}
          apiKey={apiKey}
          modelName={modelName}
          parsingDoc={parsingDoc}
          uploadedFiles={uploadedFiles}
          uploadError={uploadError}
          docAnalysis={docAnalysis}
          outlineDraft={outlineDraft}
          generatingOutline={generatingOutline}
          generating={generating}
          genError={genError}
          slides={slides}
          pendingDraft={
            pendingDraft
              ? {
                  topic: pendingDraft.topic,
                  slidesCount: pendingDraft.slides.length,
                }
              : null
          }
          deckForbidden={deckForbidden}
          onTopicChange={handleTopicChange}
          onSubtitleChange={handleSubtitleChange}
          onAudienceChange={(val) => {
            hasLocalEditsRef.current = true;
            setAudience(val);
          }}
          onSlideCountChange={setSlideCount}
          onSourceTextChange={setSourceText}
          onEngineModeChange={setEngineMode}
          onApiBaseChange={setApiBase}
          onApiKeyChange={setApiKey}
          onModelNameChange={setModelName}
          onSelectStyle={handleSelectStyle}
          onUploadFile={handleDocumentFile}
          onRemoveUploadedFile={handleRemoveUploadedFile}
          onBuildOutline={handleBuildOutline}
          onChangeOutline={setOutlineDraft}
          onCloseOutline={() => setOutlineDraft(null)}
          onGenerate={handleGenerate}
          onOpenEditor={() => setMode("editor")}
          onOpenExportModal={() => setExportModalOpen(true)}
          onOpenFullscreenPreview={() => setFullscreen(true)}
          onRestoreDraft={handleRestoreDraft}
          onDismissDraft={handleDismissDraft}
        />
      ) : (
        <PresentationEditorView
          styles={styles}
          activeStyle={activeStyle}
          deckSpec={deckSpec}
          handoffApplied={handoffApplied}
          topic={topic}
          title={title}
          subtitle={subtitle}
          audience={audience}
          slides={slides}
          safeIndex={safeIndex}
          currentSlide={currentSlide}
          newSlideType={newSlideType}
          pastCount={pastHistory.length}
          futureCount={futureHistory.length}
          savedDeckId={savedDeckId}
          hasUnsavedChanges={hasUnsavedChanges}
          isPublic={isPublic}
          isViewingForeignSharedDeck={isViewingForeignSharedDeck}
          saving={saving}
          exportingPptx={exportingPptx}
          linkCopied={linkCopied}
          auditOpen={auditOpen}
          generatingImg={generatingImg}
          imgModelName={imgModelName}
          imgPromptCopied={imgPromptCopied}
          polishingAction={polishingAction}
          pendingPolish={pendingPolish}
          onBackToWorkshop={() => setMode("workshop")}
          onTitleChange={handleTopicChange}
          onSelectStyle={handleSelectStyle}
          onChangeSpec={(next) => {
            hasLocalEditsRef.current = true;
            setHasUnsavedChanges(true);
            setDeckSpec(next);
          }}
          onResetSpec={() => {
            setDeckSpec(activeStyle.visualSpec);
            setHandoffApplied(false);
            clearStudioHandoff();
            showToast("已恢复当前母版默认配色与版式", "default");
          }}
          onAuditOpenChange={setAuditOpen}
          onAutoFixContrast={() => {
            hasLocalEditsRef.current = true;
            setHasUnsavedChanges(true);
            setDeckSpec((prev) => ({
              ...prev,
              palette: autoFixPaletteContrast(prev.palette),
            }));
            showToast("已按 WCAG AA 投影可读标准一键校正色板对比度", "success");
          }}
          onAutoFillNotes={() => {
            commitSlides((prev) =>
              autoFillMissingSpeakerNotes(prev, title, audience)
            );
            showToast("已为所有缺失备注页一键补齐演讲提词讲稿", "success");
          }}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSaveCloudDeck={() => handleSaveCloudDeck()}
          onToggleVisibility={handleToggleVisibility}
          onCopyShareLink={handleCopyShareLink}
          onExportPptx={handleExportPptx}
          onExportHtml={handleExportHtml}
          onOpenExportModal={() => setExportModalOpen(true)}
          onOpenFullscreen={() => setFullscreen(true)}
          onChangeNewSlideType={setNewSlideType}
          onSelectSlide={handleSelectSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onMoveSlide={handleMoveSlide}
          onDeleteSlide={handleDeleteSlide}
          onDropReorder={handleDropReorder}
          onAddSlide={handleAddSlide}
          onUpdateSlide={updateCurrentSlide}
          onChangeImgModelName={setImgModelName}
          onUploadSlideImage={handleUploadSlideImage}
          onCopySlideImagePrompt={handleCopySlideImagePrompt}
          onGenerateAiSlideImage={handleGenerateAiSlideImage}
          onRequestPolish={handleRequestPolish}
          onConfirmPolish={handleConfirmPolish}
          onDiscardPolish={handleDiscardPolish}
        />
      )}

      {/* Real-Deck Marp Markdown / Claude & Gamma Prompt Export Modal */}
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

      {/* Fullscreen Presenter Overlay */}
      {fullscreen && (
        <div
          className="pg-presenter-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="全屏演播播放"
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
