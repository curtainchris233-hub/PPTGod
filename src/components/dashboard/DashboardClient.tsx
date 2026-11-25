"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudUpload } from "lucide-react";
import DocIntakeWorkbench, {
  type DocIntakeParsedState,
} from "@/components/DocIntakeWorkbench";
import PageHeader from "@/components/layout/PageHeader";
import { UploadDropzone } from "@/components/ui";
import type { UploadFileItem } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import type { PromptItem, SavedDeck } from "@/types/prompt";
import CreatePanel from "./CreatePanel";
import {
  RecommendedStylesPanel,
  StyleComparePanel,
  type ComparePick,
} from "./StyleShowcase";
import { QuickToolsPanel, RecentProjectsPanel } from "./WorkspacePanels";
import "@/styles/dashboard.css";

/** Preferred real catalog slugs per comparison lane (first available wins). */
const LANE_DEFS: { lane: Omit<ComparePick, "style">; slugs: string[] }[] = [
  {
    lane: { key: "business", index: "01", label: "商务专业", fit: "稳重高效，适合企业汇报", tone: "blue" },
    slugs: ["mckinsey-executive-insight", "swiss-international-grid", "private-equity-emerald"],
  },
  {
    lane: { key: "academic", index: "02", label: "清新学术", fit: "简洁清爽，适合教育与研究", tone: "green" },
    slugs: ["nature-okabe-ito-evidence", "academic-symposium-latex", "clinical-biotech-clarity"],
  },
  {
    lane: { key: "tech", index: "03", label: "创意科技", fit: "现代灵动，适合产品与创新", tone: "violet" },
    slugs: ["keynote-obsidian-stage", "engineering-blueprint-mono", "industrial-cybernetics-orange"],
  },
];

function pickComparisons(prompts: PromptItem[]): ComparePick[] {
  const used = new Set<string>();
  const picks: ComparePick[] = [];
  for (const def of LANE_DEFS) {
    const style =
      def.slugs.map((s) => prompts.find((p) => p.slug === s)).find(Boolean) ??
      prompts.find((p) => !used.has(p.slug));
    if (style && !used.has(style.slug)) {
      used.add(style.slug);
      picks.push({ ...def.lane, style });
    }
  }
  return picks;
}

function pickRecommended(prompts: PromptItem[], exclude: Set<string>): PromptItem[] {
  const seenScenario = new Set<string>();
  const result: PromptItem[] = [];
  for (const p of prompts) {
    if (exclude.has(p.slug) || seenScenario.has(p.scenario)) continue;
    seenScenario.add(p.scenario);
    result.push(p);
    if (result.length === 6) break;
  }
  return result;
}

interface DashboardClientProps {
  prompts: PromptItem[];
}

export default function DashboardClient({ prompts }: DashboardClientProps) {
  const {
    user,
    authLoading,
    syncVersion,
    globalTopic,
    setGlobalTopic,
    openAuthModal,
    replaceCompareIds,
    showToast,
  } = useApp();

  const comparePicks = useMemo(() => pickComparisons(prompts), [prompts]);
  const recommended = useMemo(
    () => pickRecommended(prompts, new Set(comparePicks.map((p) => p.style.slug))),
    [prompts, comparePicks]
  );

  const [styleSlug, setStyleSlug] = useState(
    comparePicks[0]?.style.slug ?? prompts[0]?.slug ?? ""
  );
  // One shared lock so the topic CTA and the upload panel can never double-submit.
  const [busy, setBusy] = useState(false);

  // Upload → real /api/parse-document → existing DocIntakeWorkbench recommendation flow
  const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeParsed, setIntakeParsed] = useState<DocIntakeParsedState | null>(null);
  const [intakeKey, setIntakeKey] = useState(0);

  // Recent projects (real /api/decks, signed-in only)
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [decksReload, setDecksReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/decks", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setDecksError(data.error || "服务暂时不可用，请稍后重试");
          return;
        }
        const list: SavedDeck[] = Array.isArray(data.decks) ? data.decks : [];
        list.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setDecks(list);
        setDecksError(null);
        setNow(Date.now());
      })
      .catch(() => {
        if (!cancelled) setDecksError("网络异常，请检查连接后重试");
      })
      .finally(() => {
        if (!cancelled) setDecksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, syncVersion, decksReload]);

  const handleRetryDecks = useCallback(() => {
    setDecksLoading(true);
    setDecksError(null);
    setDecksReload((n) => n + 1);
  }, []);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || busy) return;
    const id = `${file.name}-${file.size}-${Date.now()}`;
    setUploadError(null);
    setUploadFiles([
      { id, name: file.name, size: file.size, status: "parsing", statusText: "正在解析…" },
    ]);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "文档解析失败，请检查文件格式后重试";
        setUploadFiles([{ id, name: file.name, size: file.size, status: "error", error: message }]);
        return;
      }
      const text = String(data.text || "");
      const analysis =
        data.analysis ||
        analyzeDocumentAndRecommendStyles({
          text,
          fileName: data.fileName || file.name,
          suggestedTopic: data.suggestedTopic,
          suggestedSubtitle: data.suggestedSubtitle,
          styles: prompts,
        });
      const parsed: DocIntakeParsedState = {
        fileName: data.fileName || file.name,
        fileType: data.fileType || "txt",
        charCount: Number(data.charCount) || text.length,
        text,
        suggestedTopic: data.suggestedTopic || file.name,
        suggestedSubtitle: data.suggestedSubtitle || "基于源文档自动提炼的结构化演示方案",
        isScannedPdf: Boolean(data.isScannedPdf),
        warning: data.warning,
        parsedOutline: Array.isArray(data.parsedOutline) ? data.parsedOutline : undefined,
        analysis,
      };
      setUploadFiles([
        {
          id,
          name: parsed.fileName,
          size: file.size,
          status: "success",
          statusText: `已提取 ${parsed.charCount.toLocaleString("zh-CN")} 字 · ${analysis.detectedScenario}`,
          warning: parsed.warning,
        },
      ]);
      if (parsed.suggestedTopic && !parsed.isScannedPdf) {
        setGlobalTopic(parsed.suggestedTopic);
      }
      setIntakeParsed(parsed);
      setIntakeKey((k) => k + 1);
      setIntakeOpen(true);
    } catch {
      const message = "网络异常，文件未上传成功，请重试";
      setUploadError(message);
      setUploadFiles([{ id, name: file.name, size: file.size, status: "error", error: message }]);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const isGuest = !authLoading && !user;
  const recentLoading = authLoading || (Boolean(user) && decksLoading);

  return (
    <main className="gl-dash" id="gl-dashboard">
      <PageHeader
        className="gl-dash-hero"
        title={
          <>
            你好，开始用 <span className="gl-page-header-highlight">AI 创作</span>
            你的演示文稿吧
          </>
        }
        subtitle="从一个主题、一个文档，或一段想法，快速生成高质量的 PPT"
      />

      <div className="gl-dash-row gl-dash-row--create">
        <CreatePanel
          prompts={prompts}
          topic={globalTopic}
          onTopicChange={setGlobalTopic}
          styleSlug={styleSlug}
          onStyleChange={setStyleSlug}
          busy={busy}
          onBusyChange={setBusy}
        />
        <section
          className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-upload"
          aria-label="上传资料生成 PPT"
        >
          <UploadDropzone
            variant="dashboard"
            files={uploadFiles}
            onFilesAccepted={handleFiles}
            onRemoveFile={() => setUploadFiles([])}
            uploading={busy && uploadFiles.some((f) => f.status === "parsing")}
            disabled={busy}
            error={uploadError}
            title="上传资料，一键生成 PPT"
            hint="支持 PDF、Word (.docx)、PPT (.pptx)、Markdown、TXT · 单文件 ≤ 10 MB"
            inputId="gl-dash-doc-input"
            buttonId="gl-dash-doc-btn"
          />
          {intakeParsed && !intakeOpen && (
            <button
              type="button"
              className="gl-dash-reopen"
              onClick={() => setIntakeOpen(true)}
            >
              <CloudUpload size={14} aria-hidden="true" />
              继续查看「{intakeParsed.fileName}」的推荐
            </button>
          )}
        </section>
      </div>

      <div className="gl-dash-row gl-dash-row--styles">
        <StyleComparePanel
          picks={comparePicks}
          topic={globalTopic}
          selectedSlug={styleSlug}
          onSelect={setStyleSlug}
          onOpenCompare={() => replaceCompareIds(comparePicks.map((p) => p.style.id))}
        />
        <RecommendedStylesPanel styles={recommended} />
      </div>

      <div className="gl-dash-row gl-dash-row--workspace">
        <RecentProjectsPanel
          isGuest={isGuest}
          loading={recentLoading}
          error={decksError}
          decks={user ? decks : []}
          now={now}
          onLogin={() => openAuthModal("login")}
          onRetry={handleRetryDecks}
        />
        <QuickToolsPanel studioSlug={styleSlug || prompts[0]?.slug || ""} />
      </div>

      <DocIntakeWorkbench
        key={intakeKey}
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        prompts={prompts}
        initialParsed={intakeParsed}
        onApplyTopic={(t) => setGlobalTopic(t)}
      />
    </main>
  );
}
