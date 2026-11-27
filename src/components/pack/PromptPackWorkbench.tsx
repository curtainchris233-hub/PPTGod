"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Cpu,
  FileText,
  FolderUp,
  History,
  ListChecks,
  Palette,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Stepper, UploadDropzone, type StepperStep } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";
import { readByokPrefs, subscribeByokPrefs, type ByokLocalPrefs } from "@/lib/byokLocalStore";
import { saveDocIntakeHandoff } from "@/lib/docIntakeHandoff";
import { PACK_SAMPLES } from "@/lib/packSamples";
import type { ParsedDataTable } from "@/lib/spreadsheetParser";
import {
  DESIGN_DIRECTIONS,
  PACK_DENSITIES,
  PACK_DRAFT_KEY,
  consumePackHandoff,
  deletePackHistory,
  isPromptPack,
  outlineDocumentSections,
  packSlideToCanvas,
  packStyleToVisualSpec,
  packToDeckSlides,
  parsePackJsonImport,
  pickDefaultLongDocSectionIds,
  readPackHistory,
  upsertPackHistory,
  type DocumentSectionSlice,
  type PackDensity,
  type PackHistoryEntry,
  type PackLanguage,
  type PackSlide,
  type PackStyle,
  type PackTool,
  type PromptPack,
} from "@/lib/promptPack";
import { PackExportPanel, PackOutlineEditor, PackPreviewStrip, PackStyleCard } from "./PackResultPanels";
import "@/styles/pack.css";

type InputTab = "paste" | "upload" | "sample";
const MAX_CHARS = 16000;
const MAX_RAW_CHARS = 120000;
const MIN_CHARS = 20;
const MAX_MULTI_UPLOAD_FILES = 5;

interface UploadedSourceDoc {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  enabled: boolean;
  status: "parsing" | "success" | "error";
  statusText?: string;
  warning?: string;
  error?: string;
  text: string;
  suggestedTopic?: string;
  tables: ParsedDataTable[];
  selectedTableIds: string[];
}

interface Draft {
  pack: PromptPack;
  tool: PackTool;
  language: PackLanguage;
  density?: PackDensity;
  fallbackReason?: string;
  historyId?: string;
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(PACK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (!parsed || !isPromptPack(parsed.pack)) return null;
    const restoredDensity: PackDensity =
      parsed.density === "reading" || parsed.pack.insight.density === "reading"
        ? "reading"
        : "speaker";
    return {
      pack: parsed.pack,
      tool: (parsed.tool as PackTool) || "chatgpt",
      language: (parsed.language as PackLanguage) || "zh",
      density: restoredDensity,
      fallbackReason: parsed.fallbackReason,
      historyId: typeof parsed.historyId === "string" ? parsed.historyId : undefined,
    };
  } catch {
    return null;
  }
}

function formatHistoryTime(ts: number): string {
  try {
    const d = new Date(ts);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${min}`;
  } catch {
    return "";
  }
}

export default function PromptPackWorkbench({
  initialAnchorStyle = null,
}: {
  initialAnchorStyle?: PackStyle | null;
}) {
  const router = useRouter();
  const { showToast } = useApp();
  const { openSettingsModal } = useLayout();

  const [tab, setTab] = useState<InputTab>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [language, setLanguage] = useState<PackLanguage>("zh");
  const [density, setDensity] = useState<PackDensity>("speaker");
  const [directionId, setDirectionId] = useState("auto");
  const [anchorStyle, setAnchorStyle] = useState<PackStyle | null>(initialAnchorStyle);
  const [rulesOnly, setRulesOnly] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedSourceDoc[]>([]);
  const [parsing, setParsing] = useState(false);

  // Long-document (> 16,000 chars) section selection (derived without effect cascades)
  const [sectionOverrides, setSectionOverrides] = useState<{ docKey: string; ids: string[] } | null>(null);

  const [pack, setPack] = useState<PromptPack | null>(null);
  const [tool, setTool] = useState<PackTool>("chatgpt");
  const [fallbackReason, setFallbackReason] = useState<string | undefined>();
  const [shortNotice, setShortNotice] = useState<{ got: number; want: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byok, setByok] = useState<ByokLocalPrefs | null>(null);

  // Interactive polish & history state
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [refiningSlideId, setRefiningSlideId] = useState<string | null>(null);
  const [undoMap, setUndoMap] = useState<Record<string, PackSlide>>({});
  const [history, setHistory] = useState<PackHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>();

  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => setByok(readByokPrefs());
    Promise.resolve().then(sync);
    return subscribeByokPrefs(sync);
  }, []);

  const enabledDocs = useMemo(
    () => uploadedDocs.filter((d) => d.status === "success" && d.enabled),
    [uploadedDocs]
  );

  // Strict Q5 boundary: `paste` tab uses pure plain `text` with zero table auto-detection;
  // `upload` tab combines enabled uploaded files & selected `.xlsx`/`.csv` sheets.
  const useUploadedBundle = enabledDocs.length > 0 && (tab === "upload" || text.trim().length === 0);

  const combinedUploadText = useMemo(() => {
    if (!enabledDocs.length) return "";
    return enabledDocs
      .map((doc) => {
        if (doc.tables.length > 0) {
          const chosen = doc.tables.filter((t) => doc.selectedTableIds.includes(t.id));
          if (!chosen.length) return "";
          const tblBlocks = chosen
            .map(
              (tbl) =>
                `## 【数据表：${doc.fileName} · ${tbl.sheetName}】\n核心结论：${tbl.summaryLine}\n${tbl.headers.join(" | ")}\n${tbl.rows.map((r) => r.join(" | ")).join("\n")}`
            )
            .join("\n\n");
          return `# 【资料来源：${doc.fileName}】\n${tblBlocks}`;
        }
        return doc.text.trim() ? `# 【资料来源：${doc.fileName}】\n${doc.text}` : "";
      })
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_RAW_CHARS);
  }, [enabledDocs]);

  const activeUploadTables = useMemo<ParsedDataTable[]>(() => {
    if (!useUploadedBundle) return [];
    return enabledDocs.flatMap((doc) =>
      doc.tables.filter((t) => doc.selectedTableIds.includes(t.id))
    );
  }, [useUploadedBundle, enabledDocs]);

  const activeFileName = useMemo(() => {
    if (!useUploadedBundle) return fileName;
    if (enabledDocs.length === 1) return enabledDocs[0].fileName;
    return `${enabledDocs[0].fileName} 等 ${enabledDocs.length} 份资料`;
  }, [useUploadedBundle, enabledDocs, fileName]);

  const rawActiveText = useUploadedBundle ? combinedUploadText : text;

  // Recompute long-document sections whenever raw text exceeds MAX_CHARS.
  const isLongDoc = rawActiveText.length > MAX_CHARS;
  const docKey = isLongDoc
    ? `${rawActiveText.length}:${rawActiveText.slice(0, 64)}:${rawActiveText.slice(-64)}`
    : "";
  const docSections: DocumentSectionSlice[] = useMemo(
    () => (isLongDoc ? outlineDocumentSections(rawActiveText) : []),
    [isLongDoc, rawActiveText]
  );

  const selectedSectionIds = useMemo(() => {
    if (!isLongDoc) return [];
    if (sectionOverrides && sectionOverrides.docKey === docKey) {
      return sectionOverrides.ids;
    }
    return pickDefaultLongDocSectionIds(docSections, MAX_CHARS);
  }, [isLongDoc, docKey, sectionOverrides, docSections]);

  const effectiveSource = useMemo(() => {
    if (!isLongDoc) return rawActiveText;
    const chosen = docSections.filter((s) => selectedSectionIds.includes(s.id));
    if (!chosen.length) return rawActiveText.slice(0, MAX_CHARS);
    return chosen.map((s) => s.text).join("\n\n").slice(0, MAX_CHARS);
  }, [isLongDoc, rawActiveText, docSections, selectedSectionIds]);

  const hasKey = Boolean(byok?.apiKey);
  const engineLabel = rulesOnly
    ? "内置规则引擎"
    : hasKey
      ? `BYOK · ${byok?.modelName || "自定义模型"}`
      : "内置规则引擎（免 Key）";

  const generate = useCallback(
    async (override?: {
      text: string;
      fileName: string;
      topic?: string;
      audience?: string;
      slideCount?: number;
      anchorStyle?: PackStyle | null;
      tables?: ParsedDataTable[];
    }) => {
      const rawSrc = (override?.text ?? effectiveSource).trim();
      const tablesToUse = override ? (override.tables ?? []) : activeUploadTables;
      const src =
        rawSrc.length > MAX_CHARS
          ? (() => {
              const secs = outlineDocumentSections(rawSrc);
              const ids = new Set(pickDefaultLongDocSectionIds(secs, MAX_CHARS));
              const picked = secs.filter((s) => ids.has(s.id)).map((s) => s.text).join("\n\n");
              return (picked || rawSrc).slice(0, MAX_CHARS);
            })()
          : rawSrc;

      if (src.length < MIN_CHARS && tablesToUse.length === 0) {
        setError(`资料内容太少（至少 ${MIN_CHARS} 个字）。可以粘贴论文摘要、课本章节、会议纪要或上传汇总数据表。`);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      const prefs = readByokPrefs();
      const useAnchor = override?.anchorStyle !== undefined ? override.anchorStyle : anchorStyle;
      try {
        const res = await fetch("/api/prompt-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            text: src.slice(0, MAX_CHARS),
            fileName: override?.fileName ?? activeFileName,
            topic: override?.topic ?? topic,
            audience: override?.audience ?? audience,
            slideCount: override?.slideCount ?? slideCount,
            language,
            density,
            directionId,
            ...(useAnchor ? { anchorStyle: useAnchor } : {}),
            ...(tablesToUse.length > 0 ? { tables: tablesToUse } : {}),
            mode: rulesOnly ? "smart" : "auto",
            ...(prefs.apiKey && !rulesOnly
              ? { apiKey: prefs.apiKey, apiBase: prefs.apiBase, model: prefs.modelName }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !isPromptPack(data.pack)) {
          setError(data.error || "生成失败，请稍后重试");
          return;
        }
        const nextPack = data.pack as PromptPack;
        setPack(nextPack);
        setActiveSlideId(null);
        setUndoMap({});
        const saved = upsertPackHistory({ pack: nextPack, tool, language });
        setActiveHistoryId(saved.id);
        setHistory(saved.items);

        const want = nextPack.insight.requestedSlides ?? 0;
        setShortNotice(want && nextPack.slides.length < want - 1 ? { got: nextPack.slides.length, want } : null);
        setFallbackReason(typeof data.fallbackReason === "string" ? data.fallbackReason : undefined);
        window.requestAnimationFrame(() => {
          if (window.innerWidth <= 1024) {
            resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("网络异常，请检查连接后重试");
      } finally {
        if (abortRef.current === ctrl) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [effectiveSource, activeUploadTables, activeFileName, topic, audience, slideCount, language, density, directionId, anchorStyle, rulesOnly, tool]
  );

  // Mount: load local history; handle homepage handoff → auto-generate; otherwise restore last draft.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setHistory(readPackHistory());
      const handoff = consumePackHandoff();
      if (handoff) {
        setText(handoff.text.slice(0, MAX_RAW_CHARS));
        setFileName(handoff.fileName);
        if (handoff.topic) setTopic(handoff.topic);
        if (handoff.audience) setAudience(handoff.audience);
        if (handoff.slideCount) setSlideCount(handoff.slideCount);
        void generate({ ...handoff, anchorStyle: initialAnchorStyle });
        return;
      }
      const draft = readDraft();
      if (draft) {
        setPack(draft.pack);
        setTool(draft.tool);
        setLanguage(draft.language);
        if (draft.density) setDensity(draft.density);
        setFallbackReason(draft.fallbackReason);
        setActiveHistoryId(draft.historyId);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the latest pack draft & keep active history item synchronized (never includes BYOK key).
  useEffect(() => {
    if (!pack) return;
    try {
      window.localStorage.setItem(
        PACK_DRAFT_KEY,
        JSON.stringify({ pack, tool, language, density, fallbackReason, historyId: activeHistoryId })
      );
    } catch {
      // quota / private mode — ignore
    }
    if (activeHistoryId) {
      upsertPackHistory({ id: activeHistoryId, pack, tool, language });
    }
  }, [pack, tool, language, density, fallbackReason, activeHistoryId]);

  const loadSample = (id: string) => {
    const s = PACK_SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setUploadedDocs([]);
    setText(s.text);
    setFileName(s.fileName);
    setAudience(s.audience);
    setSlideCount(s.slideCount);
    setTopic("");
    setTab("paste");
    void generate({ text: s.text, fileName: s.fileName, audience: s.audience, slideCount: s.slideCount, topic: "", tables: [] });
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length || parsing) return;
    const activeNonErrorCount = uploadedDocs.filter((d) => d.status !== "error").length;
    const slotsLeft = MAX_MULTI_UPLOAD_FILES - activeNonErrorCount;
    if (slotsLeft <= 0) {
      showToast(`最多支持同时混传 ${MAX_MULTI_UPLOAD_FILES} 份文件，请先移除不需要的文件`, "error");
      return;
    }
    const batch = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      showToast(`最多混传 ${MAX_MULTI_UPLOAD_FILES} 份文件，已为您取前 ${slotsLeft} 份`, "default");
    }

    const pendingDocs: UploadedSourceDoc[] = batch.map((f, idx) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${idx}`,
      fileName: f.name,
      fileType: f.name.split(".").pop()?.toLowerCase() || "txt",
      size: f.size,
      enabled: true,
      status: "parsing",
      statusText: "正在解析资料内容…",
      text: "",
      tables: [],
      selectedTableIds: [],
    }));

    setUploadedDocs((prev) => [...prev.filter((d) => d.status !== "error"), ...pendingDocs]);
    setParsing(true);
    setError(null);

    try {
      let firstSuggestedTopic = "";
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        const docId = pendingDocs[i].id;
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/parse-document", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg = data.error || "文档解析失败，请检查文件格式";
            setUploadedDocs((prev) =>
              prev.map((d) =>
                d.id === docId ? { ...d, status: "error", enabled: false, error: msg } : d
              )
            );
            continue;
          }
          const extracted = String(data.text || "");
          const parsedTables: ParsedDataTable[] = Array.isArray(data.tables) ? data.tables : [];
          const resolvedName = String(data.fileName || file.name);
          if (!firstSuggestedTopic && data.suggestedTopic) {
            firstSuggestedTopic = String(data.suggestedTopic).slice(0, 60);
          }

          const totalRows = parsedTables.reduce((sum, t) => sum + t.rowCount, 0);
          const statusText =
            parsedTables.length > 0
              ? `已读取 ${parsedTables.length} 张汇总表（共 ${totalRows} 行）`
              : extracted.length > MAX_CHARS
                ? `已提取 ${extracted.length.toLocaleString("zh-CN")} 字（已开启长文档章节筛选）`
                : `已提取 ${extracted.length.toLocaleString("zh-CN")} 字`;

          setUploadedDocs((prev) =>
            prev.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    fileName: resolvedName,
                    fileType: String(data.fileType || d.fileType),
                    status: "success",
                    statusText,
                    warning: typeof data.warning === "string" ? data.warning : undefined,
                    text: extracted.slice(0, MAX_RAW_CHARS),
                    suggestedTopic: data.suggestedTopic ? String(data.suggestedTopic) : undefined,
                    tables: parsedTables,
                    selectedTableIds: parsedTables.map((t) => t.id),
                  }
                : d
            )
          );

          // Mirror single prose doc into text state so switching to paste tab shows it seamlessly
          if (activeNonErrorCount === 0 && batch.length === 1 && parsedTables.length === 0) {
            setText(extracted.slice(0, MAX_RAW_CHARS));
            setFileName(resolvedName);
          }
        } catch {
          setUploadedDocs((prev) =>
            prev.map((d) =>
              d.id === docId
                ? { ...d, status: "error", enabled: false, error: "网络异常，请重试" }
                : d
            )
          );
        }
      }
      if (firstSuggestedTopic && !topic.trim()) {
        setTopic(firstSuggestedTopic);
      }
    } finally {
      setParsing(false);
    }
  };

  const toggleDocEnabled = (docId: string) => {
    setUploadedDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const toggleDocSheet = (docId: string, tableId: string) => {
    setUploadedDocs((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const exists = d.selectedTableIds.includes(tableId);
        if (exists && d.selectedTableIds.length <= 1) {
          showToast("至少保留勾选 1 张工作表（或直接取消勾选整个文件）", "default");
          return d;
        }
        const nextIds = exists
          ? d.selectedTableIds.filter((x) => x !== tableId)
          : [...d.selectedTableIds, tableId];
        return { ...d, selectedTableIds: nextIds };
      })
    );
  };

  const removeUploadedDoc = (docId: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleRefineSlide = async (slide: PackSlide, instruction: string) => {
    if (!pack || refiningSlideId) return;
    const prefs = readByokPrefs();
    if (!prefs.apiKey) {
      showToast("请先在设置中配置 BYOK API Key 后再使用单页润色", "error");
      openSettingsModal();
      return;
    }
    setRefiningSlideId(slide.id);
    try {
      const res = await fetch("/api/prompt-pack/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slide,
          topic: pack.insight.topic,
          audience: pack.insight.audience,
          styleName: pack.style.name,
          instruction,
          language,
          sourceText: effectiveSource.slice(0, 6000),
          apiKey: prefs.apiKey,
          apiBase: prefs.apiBase,
          model: prefs.modelName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.slide) {
        showToast(data.error || "单页润色失败，请稍后重试", "error");
        return;
      }
      setUndoMap((prev) => ({ ...prev, [slide.id]: slide }));
      setPack((prev) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s) => (s.id === slide.id ? (data.slide as PackSlide) : s)),
            }
          : prev
      );
      showToast(`已润色「${(data.slide as PackSlide).title}」（可随时撤销）`, "success");
    } catch {
      showToast("网络异常，单页润色失败", "error");
    } finally {
      setRefiningSlideId(null);
    }
  };

  const handleUndoRefine = (slideId: string) => {
    const prevSlide = undoMap[slideId];
    if (!prevSlide || !pack) return;
    setPack({
      ...pack,
      slides: pack.slides.map((s) => (s.id === slideId ? prevSlide : s)),
    });
    setUndoMap((prev) => {
      const copy = { ...prev };
      delete copy[slideId];
      return copy;
    });
    showToast("已恢复润色前的本页内容", "default");
  };

  const handleLoadHistory = (entry: PackHistoryEntry) => {
    setPack(entry.pack);
    setTool(entry.tool);
    setLanguage(entry.language);
    setActiveHistoryId(entry.id);
    setActiveSlideId(null);
    setFallbackReason(undefined);
    setShortNotice(null);
    setHistoryOpen(false);
    showToast(`已切换到「${entry.topic}」`, "success");
  };

  const handleDeleteHistory = (id: string) => {
    const next = deletePackHistory(id);
    setHistory(next);
    if (activeHistoryId === id) setActiveHistoryId(undefined);
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parsePackJsonImport(String(reader.result || ""));
      if (!parsed.ok) {
        showToast(parsed.error, "error");
        return;
      }
      setPack(parsed.pack);
      setTool(parsed.tool);
      setLanguage(parsed.language);
      setActiveSlideId(null);
      setFallbackReason(undefined);
      setShortNotice(null);
      const saved = upsertPackHistory({
        pack: parsed.pack,
        tool: parsed.tool,
        language: parsed.language,
      });
      setActiveHistoryId(saved.id);
      setHistory(saved.items);
      showToast(`已导入提示词包「${parsed.pack.insight.topic}」`, "success");
    };
    reader.readAsText(file, "utf-8");
  };

  const toggleSection = (id: string) => {
    const nextIds = selectedSectionIds.includes(id)
      ? selectedSectionIds.filter((x) => x !== id)
      : [...selectedSectionIds, id];
    setSectionOverrides({ docKey, ids: nextIds });
  };

  const sendToGenerate = () => {
    if (!pack) return;
    const readySlides = packToDeckSlides(pack).slice(0, 20);
    saveDocIntakeHandoff({
      fileName: pack.insight.fileName || fileName || "提示词包资料.txt",
      fileType: "txt",
      charCount: effectiveSource.length || pack.insight.charCount,
      text: effectiveSource || pack.slides.map((s) => [s.title, ...s.points].join("\n")).join("\n\n"),
      topic: pack.insight.topic,
      subtitle: pack.slides[0]?.points[0] || pack.insight.subtitle,
      audience: pack.insight.audience,
      slideCount: Math.min(20, readySlides.length),
      styleSlug: pack.style.referenceSlug ?? "",
      autoGenerate: false,
      customSpec: packStyleToVisualSpec(pack.style),
      readySlides,
      parsedOutline: pack.slides.slice(0, 20).map((s, i) => ({
        id: `outline_${i + 1}`,
        slideType: packSlideToCanvas(s, pack.insight).slideType,
        sectionTag: String(i + 1).padStart(2, "0"),
        title: s.title,
        summary: [...s.points, ...s.data.map((d) => `${d.label} ${d.value}`)].join("；").slice(0, 160),
      })),
    });
    router.push("/generate?intake=1&mode=editor");
  };

  const steps: StepperStep[] = useMemo(() => {
    const hasText = effectiveSource.trim().length >= MIN_CHARS || activeUploadTables.length > 0;
    return [
      { id: "source", title: "资料", status: pack || hasText ? "completed" : "active" },
      { id: "style", title: "风格", status: pack ? "completed" : hasText ? "active" : "upcoming" },
      { id: "outline", title: "逐页大纲", status: pack ? "completed" : "upcoming" },
      { id: "export", title: "复制到 AI 工具", status: pack ? "active" : "upcoming" },
    ];
  }, [pack, effectiveSource, activeUploadTables.length]);

  const effectiveCharCount = effectiveSource.length;

  return (
    <main className="gl-pack" id="pg-pack-page">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="提示词包工作台"
        subtitle="把论文、课本、报告变成可直接粘贴到 ChatGPT / Gamma / Kimi / Claude 的 PPT 提示词：定制风格 + 逐页大纲，数据只取自你的资料"
        compact
        actions={
          <div className="gl-pack-header-actions">
            <input
              ref={jsonInputRef}
              id="pg-pack-import-json-input"
              type="file"
              accept="application/json,.json"
              className="gl-sr-only"
              onChange={handleImportJson}
            />
            <Button
              size="sm"
              variant="ghost"
              id="pg-pack-import-json-btn"
              leftIcon={<FolderUp size={14} />}
              onClick={() => jsonInputRef.current?.click()}
            >
              导入 .json
            </Button>
            <Button
              size="sm"
              variant={historyOpen ? "primary" : "secondary"}
              id="pg-pack-history-toggle"
              aria-expanded={historyOpen}
              leftIcon={<History size={14} />}
              onClick={() => {
                setHistoryOpen((v) => {
                  const next = !v;
                  if (next) setHistory(readPackHistory());
                  return next;
                });
              }}
            >
              历史记录{history.length ? ` (${history.length})` : ""}
            </Button>
          </div>
        }
      />

      {historyOpen ? (
        <section className="gl-pack-card gl-pack-history" id="pg-pack-history-panel" aria-label="本地提示词包历史">
          <header className="gl-pack-card-head is-compact">
            <div>
              <p className="gl-pack-eyebrow">本地历史记录（最多保留 10 份 · 仅存浏览器，不含 API Key）</p>
            </div>
            <button type="button" className="gl-pack-mini-btn" onClick={() => setHistoryOpen(false)}>
              收起 <X size={12} aria-hidden="true" />
            </button>
          </header>
          {history.length ? (
            <ul className="gl-pack-history-list">
              {history.map((item) => {
                const isCurrent = item.id === activeHistoryId;
                return (
                  <li key={item.id} className={`gl-pack-history-item ${isCurrent ? "is-current" : ""}`}>
                    <button
                      type="button"
                      className="gl-pack-history-load"
                      onClick={() => handleLoadHistory(item)}
                    >
                      <strong>{item.topic}</strong>
                      <span>
                        {item.styleName} · {item.slideCount} 页 · {formatHistoryTime(item.savedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="gl-pack-history-del"
                      aria-label={`删除历史记录 ${item.topic}`}
                      onClick={() => handleDeleteHistory(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gl-pack-history-empty">还没有保存过提示词包。生成第一份后会自动保存在这里。</p>
          )}
        </section>
      ) : null}

      <Stepper steps={steps} orientation="horizontal" ariaLabel="提示词包生成步骤" className="gl-pack-stepper" />

      <div className="gl-pack-layout">
        {/* ------------------------------------------------ input column */}
        <section className="gl-pack-card gl-pack-input" aria-labelledby="pg-pack-input-title">
          <header className="gl-pack-card-head is-compact">
            <h2 className="gl-pack-h2" id="pg-pack-input-title">
              资料输入
            </h2>
            <span className="gl-pack-count" aria-live="polite">
              {isLongDoc
                ? `已选 ${effectiveCharCount.toLocaleString("zh-CN")} / ${MAX_CHARS.toLocaleString("zh-CN")} 字（原文 ${rawActiveText.length.toLocaleString("zh-CN")} 字）`
                : `${effectiveCharCount.toLocaleString("zh-CN")} / ${MAX_CHARS.toLocaleString("zh-CN")} 字`}
            </span>
          </header>

          <div className="gl-pack-seg" role="tablist" aria-label="资料来源">
            {(
              [
                { id: "paste", label: "粘贴文本", icon: <FileText size={14} /> },
                { id: "upload", label: "上传文档", icon: <Upload size={14} /> },
                { id: "sample", label: "示例资料", icon: <BookOpen size={14} /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`pg-pack-tab-${t.id}`}
                aria-selected={tab === t.id}
                className={tab === t.id ? "is-active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === "paste" ? (
            <textarea
              id="pg-pack-text"
              className="gl-pack-textarea"
              value={text}
              maxLength={MAX_RAW_CHARS}
              placeholder={"粘贴论文摘要、课本章节、读书笔记、会议纪要或经营报告…\n\n小技巧：保留原文的小标题（如「一、背景」「## 方法」），大纲会更贴合资料结构；超过 16,000 字的长文档会自动弹出章节筛选器。"}
              onChange={(e) => setText(e.target.value)}
            />
          ) : null}

          {tab === "upload" ? (
            <div className="gl-pack-upload-zone">
              <UploadDropzone
                variant="compact"
                multiple
                files={[]}
                onFilesAccepted={handleFiles}
                uploading={parsing}
                title="拖入文档或汇总表（最多同时混传 5 份）"
                hint="支持 PDF、Word (.docx)、PPT (.pptx)、Excel (.xlsx)、CSV、Markdown、TXT（单文件 ≤ 10 MB；数据表限 ≤ 30 行汇总表）"
                buttonLabel={uploadedDocs.length > 0 ? "继续添加文件" : "选择文件"}
                inputId="pg-pack-file-input"
                buttonId="pg-pack-file-btn"
              />
              {uploadedDocs.length > 0 ? (
                <ul className="gl-pack-multi-files" id="pg-pack-multi-files" aria-label="已上传资料列表">
                  {uploadedDocs.map((doc) => {
                    const isErr = doc.status === "error";
                    return (
                      <li
                        key={doc.id}
                        className={`gl-pack-doc-item ${isErr ? "is-error" : ""} ${!doc.enabled && !isErr ? "is-muted" : ""}`}
                        data-doc-status={doc.status}
                      >
                        <div className="gl-pack-doc-head">
                          {!isErr ? (
                            <input
                              type="checkbox"
                              checked={doc.enabled}
                              disabled={doc.status === "parsing"}
                              aria-label={`启用资料 ${doc.fileName}`}
                              onChange={() => toggleDocEnabled(doc.id)}
                            />
                          ) : (
                            <AlertTriangle size={14} className="gl-pack-doc-err-icon" aria-hidden="true" />
                          )}
                          <span className="gl-pack-doc-ext">{doc.fileType.toUpperCase()}</span>
                          <strong className="gl-pack-doc-name" title={doc.fileName}>
                            {doc.fileName}
                          </strong>
                          <button
                            type="button"
                            className="gl-pack-doc-remove"
                            aria-label={`移除文件 ${doc.fileName}`}
                            onClick={() => removeUploadedDoc(doc.id)}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {isErr && doc.error ? (
                          <p className="gl-pack-doc-msg is-error" role="alert">
                            {doc.error}
                          </p>
                        ) : doc.statusText ? (
                          <p className="gl-pack-doc-msg">{doc.statusText}</p>
                        ) : null}
                        {doc.warning ? (
                          <p className="gl-pack-doc-msg is-warning">{doc.warning}</p>
                        ) : null}
                        {doc.tables.length > 0 ? (
                          <div className="gl-pack-sheet-chips" role="group" aria-label={`${doc.fileName} 工作表筛选`}>
                            {doc.tables.map((tbl) => {
                              const active = doc.selectedTableIds.includes(tbl.id);
                              return (
                                <button
                                  key={tbl.id}
                                  type="button"
                                  data-sheet-chip={tbl.sheetName}
                                  aria-pressed={active}
                                  disabled={!doc.enabled}
                                  className={`gl-pack-sheet-chip ${active ? "is-active" : ""}`}
                                  onClick={() => toggleDocSheet(doc.id, tbl.id)}
                                  title={`${tbl.sheetName}：${tbl.rowCount} 行 × ${tbl.colCount} 列（${tbl.mode === "table" ? "三线数据表" : "原生图表"}）`}
                                >
                                  <span>{tbl.sheetName}</span>
                                  <em>
                                    {tbl.rowCount}×{tbl.colCount} · {tbl.mode === "table" ? "三线表" : "图表"}
                                  </em>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          {tab === "sample" ? (
            <ul className="gl-pack-samples">
              {PACK_SAMPLES.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="gl-pack-sample"
                    id={`pg-pack-sample-${s.id}`}
                    onClick={() => loadSample(s.id)}
                    disabled={loading}
                  >
                    <span className="gl-pack-sample-tag">{s.tag}</span>
                    <strong>{s.label}</strong>
                    <span>
                      {s.audience} · {s.slideCount} 页
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isLongDoc && docSections.length > 1 ? (
            <div className="gl-pack-sections" id="pg-pack-section-picker">
              <div className="gl-pack-sections-head">
                <span>
                  <ListChecks size={13} aria-hidden="true" /> 长文档章节筛选（已自动略去参考文献/附录，防截断尾部结论）
                </span>
                <button
                  type="button"
                  className="gl-pack-mini-btn"
                  onClick={() => setSectionOverrides(null)}
                >
                  智能勾选
                </button>
              </div>
              <ul className="gl-pack-sections-list">
                {docSections.map((sec) => {
                  const checked = selectedSectionIds.includes(sec.id);
                  return (
                    <li key={sec.id}>
                      <label className={checked ? "is-checked" : ""}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSection(sec.id)}
                        />
                        <span className="gl-pack-sec-name">
                          {sec.heading}
                          {sec.isAppendix ? <em>附录/参考</em> : null}
                        </span>
                        <span className="gl-pack-sec-chars">{sec.charCount.toLocaleString("zh-CN")} 字</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {anchorStyle ? (
            <div className="gl-pack-anchor-banner" id="pg-pack-anchor-banner">
              <div className="gl-pack-anchor-info">
                <span className="gl-pack-anchor-dots" aria-hidden="true">
                  {anchorStyle.colors.slice(0, 5).map((c) => (
                    <i key={c.role} style={{ background: c.hex }} />
                  ))}
                </span>
                <div>
                  <strong>
                    <Palette size={12} aria-hidden="true" /> 风格参考锚点：{anchorStyle.name}
                  </strong>
                  <span>生成时将保留该参考库风格的色板与视觉气质</span>
                </div>
              </div>
              <div className="gl-pack-anchor-actions">
                {pack && pack.style.referenceSlug !== anchorStyle.referenceSlug ? (
                  <button
                    type="button"
                    className="gl-pack-mini-btn"
                    onClick={() => {
                      setPack({ ...pack, style: anchorStyle });
                      showToast(`已将参考风格「${anchorStyle.name}」套用到当前提示词包`, "success");
                    }}
                  >
                    直接套用到当前结果
                  </button>
                ) : null}
                <button
                  type="button"
                  id="pg-pack-clear-anchor-btn"
                  className="gl-pack-mini-btn"
                  onClick={() => setAnchorStyle(null)}
                >
                  清除锚点 <X size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="gl-pack-fields">
            <label className="gl-pack-field is-wide">
              <span>主题（可选）</span>
              <input
                id="pg-pack-topic"
                value={topic}
                maxLength={60}
                placeholder="留空则从资料标题自动提取"
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>
            <label className="gl-pack-field">
              <span>受众</span>
              <input
                id="pg-pack-audience"
                value={audience}
                maxLength={40}
                placeholder="如：研究生组会"
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>
            <label className="gl-pack-field">
              <span>页数</span>
              <select
                id="pg-pack-slide-count"
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
              >
                {[6, 8, 10, 12, 15, 18, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} 页
                  </option>
                ))}
              </select>
            </label>
            <label className="gl-pack-field">
              <span>语言</span>
              <select
                id="pg-pack-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as PackLanguage)}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="bilingual">中英双语</option>
              </select>
            </label>
            <label className="gl-pack-field">
              <span>风格基底</span>
              <select
                id="pg-pack-direction"
                value={directionId}
                onChange={(e) => {
                  setDirectionId(e.target.value);
                  if (e.target.value !== "auto") setAnchorStyle(null);
                }}
              >
                <option value="auto">{anchorStyle ? `使用参考锚点（${anchorStyle.name}）` : "按资料自动匹配"}</option>
                {DESIGN_DIRECTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="gl-pack-field is-wide">
              <span>用途密度（上屏字数 vs 演讲备注）</span>
              <select
                id="pg-pack-density"
                value={density}
                onChange={(e) => {
                  const next = e.target.value as PackDensity;
                  setDensity(next);
                  setPack((prev) =>
                    prev ? { ...prev, insight: { ...prev.insight, density: next } } : prev
                  );
                }}
              >
                {PACK_DENSITIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="gl-pack-engine">
            <span className={`gl-pack-engine-badge ${hasKey && !rulesOnly ? "is-llm" : ""}`} id="pg-pack-engine-badge">
              <Cpu size={13} aria-hidden="true" /> {engineLabel}
            </span>
            <button type="button" className="gl-pack-textlink" onClick={openSettingsModal}>
              <Settings2 size={13} aria-hidden="true" /> {hasKey ? "模型设置" : "接入自己的大模型"}
            </button>
            {hasKey ? (
              <label className="gl-pack-check">
                <input type="checkbox" checked={rulesOnly} onChange={(e) => setRulesOnly(e.target.checked)} />
                仅用规则引擎
              </label>
            ) : null}
          </div>

          {error ? (
            <p className="gl-pack-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<Wand2 size={18} />}
            loading={loading}
            loadingText={hasKey && !rulesOnly ? "大模型分析中（约 20–60 秒）…" : "正在分析资料…"}
            onClick={() => void generate()}
            disabled={parsing}
            id="pg-pack-generate-btn"
          >
            {pack ? "重新生成提示词包" : "生成提示词包"}
          </Button>
          <p className="gl-pack-privacy">
            资料只用于本次生成，不会保存到服务器；API Key 仅保存在本标签页。
          </p>
        </section>

        {/* ------------------------------------------------ result column */}
        <div className="gl-pack-result" ref={resultRef} aria-live="polite" aria-busy={loading}>
          {loading && !pack ? (
            <div className="gl-pack-card gl-pack-loading" role="status">
              <div className="gl-pack-skel is-title" />
              <div className="gl-pack-skel-row">
                <div className="gl-pack-skel is-chip" />
                <div className="gl-pack-skel is-chip" />
                <div className="gl-pack-skel is-chip" />
              </div>
              <div className="gl-pack-skel-grid">
                <div className="gl-pack-skel is-slide" />
                <div className="gl-pack-skel is-slide" />
                <div className="gl-pack-skel is-slide" />
              </div>
              <p>正在识别资料结构、提取数字事实并匹配设计方向…</p>
            </div>
          ) : null}

          {!pack && !loading ? <PackEmptyState onSample={loadSample} /> : null}

          {pack ? (
            <div className={`gl-pack-result-stack ${loading ? "is-refreshing" : ""}`}>
              <div className="gl-pack-insight" id="pg-pack-insight">
                <div className="gl-pack-insight-main">
                  <p className="gl-pack-eyebrow">
                    <Sparkles size={14} aria-hidden="true" /> 资料洞察
                  </p>
                  <h2 className="gl-pack-topic">{pack.insight.topic}</h2>
                </div>
                <ul className="gl-pack-chips">
                  <li>场景 · {pack.insight.scenario}</li>
                  <li>受众 · {pack.insight.audience}</li>
                  <li>用途 · {density === "reading" ? "书面汇报" : "现场演讲"}</li>
                  <li>{pack.slides.length} 页 · 约 {pack.insight.talkMinutes} 分钟</li>
                  <li>关键数据 {pack.insight.keyFacts.length} 条</li>
                  <li className={`is-engine ${pack.engine === "llm" ? "is-llm" : ""}`} id="pg-pack-result-engine">
                    {pack.engine === "llm" ? `大模型 · ${pack.model ?? ""}` : "内置规则引擎"}
                  </li>
                </ul>
              </div>

              {fallbackReason ? (
                <div className="gl-pack-notice" role="status" id="pg-pack-fallback-notice">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>
                    大模型调用未成功，已改用内置规则引擎生成（内容仍全部来自你的资料）。原因：{fallbackReason}
                  </span>
                </div>
              ) : null}

              {shortNotice ? (
                <div className="gl-pack-notice is-info" role="status" id="pg-pack-short-notice">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>
                    资料内容只够支撑 {shortNotice.got} 页（目标 {shortNotice.want} 页）。为避免空洞凑页，没有补充资料外的内容；可以补充更多资料，或在下方大纲中手动加页。
                  </span>
                </div>
              ) : null}

              <PackStyleCard pack={pack} onChange={setPack} onToast={showToast} />
              <PackPreviewStrip
                pack={pack}
                activeSlideId={activeSlideId}
                onClearActive={() => setActiveSlideId(null)}
              />
              <PackExportPanel
                pack={pack}
                tool={tool}
                language={language}
                density={density}
                onToolChange={setTool}
                onToast={showToast}
                onSendToGenerate={sendToGenerate}
              />
              <PackOutlineEditor
                pack={pack}
                onChange={setPack}
                activeSlideId={activeSlideId}
                onPreviewSlide={setActiveSlideId}
                hasByok={hasKey && !rulesOnly}
                refiningSlideId={refiningSlideId}
                undoMap={undoMap}
                onRefineSlide={(s, hint) => void handleRefineSlide(s, hint)}
                onUndoRefine={handleUndoRefine}
                onToast={showToast}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function PackEmptyState({ onSample }: { onSample: (id: string) => void }) {
  return (
    <section className="gl-pack-card gl-pack-empty" id="pg-pack-empty">
      <p className="gl-pack-eyebrow">怎么用</p>
      <h2 className="gl-pack-h2">三步拿到一份“能直接用”的 PPT 提示词</h2>
      <ol className="gl-pack-howto">
        <li>
          <span>1</span>
          <div>
            <strong>放入资料</strong>
            <p>粘贴或上传论文、课本章节、报告。我们识别章节结构与数字事实。</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>得到定制风格 + 逐页大纲</strong>
            <p>色板 HEX、字体、版式语法，以及大数字 / 图表 / 对比 / 流程等多样版式。</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>复制到你常用的 AI 工具</strong>
            <p>针对 ChatGPT、Gamma、Kimi、Claude 分别优化格式，一键复制或下载。</p>
          </div>
        </li>
      </ol>
      <p className="gl-pack-label">没有现成资料？试试示例（共 {PACK_SAMPLES.length} 份）：</p>
      <div className="gl-pack-empty-samples">
        {PACK_SAMPLES.map((s) => (
          <button key={s.id} type="button" className="gl-pack-sample is-inline" onClick={() => onSample(s.id)}>
            <span className="gl-pack-sample-tag">{s.tag}</span>
            <strong>{s.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
