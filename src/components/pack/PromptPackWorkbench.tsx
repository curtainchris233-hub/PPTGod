"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Cpu,
  FileText,
  Settings2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Stepper, UploadDropzone, type StepperStep, type UploadFileItem } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";
import { readByokPrefs, subscribeByokPrefs, type ByokLocalPrefs } from "@/lib/byokLocalStore";
import { saveDocIntakeHandoff } from "@/lib/docIntakeHandoff";
import { PACK_SAMPLES } from "@/lib/packSamples";
import {
  DESIGN_DIRECTIONS,
  PACK_DRAFT_KEY,
  consumePackHandoff,
  isPromptPack,
  packSlideToCanvas,
  type PackLanguage,
  type PackTool,
  type PromptPack,
} from "@/lib/promptPack";
import { PackExportPanel, PackOutlineEditor, PackPreviewStrip, PackStyleCard } from "./PackResultPanels";
import "@/styles/pack.css";

type InputTab = "paste" | "upload" | "sample";
const MAX_CHARS = 16000;
const MIN_CHARS = 20;

interface Draft {
  pack: PromptPack;
  tool: PackTool;
  language: PackLanguage;
  fallbackReason?: string;
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(PACK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (!parsed || !isPromptPack(parsed.pack)) return null;
    return {
      pack: parsed.pack,
      tool: (parsed.tool as PackTool) || "chatgpt",
      language: (parsed.language as PackLanguage) || "zh",
      fallbackReason: parsed.fallbackReason,
    };
  } catch {
    return null;
  }
}

export default function PromptPackWorkbench() {
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
  const [directionId, setDirectionId] = useState("auto");
  const [rulesOnly, setRulesOnly] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([]);
  const [parsing, setParsing] = useState(false);

  const [pack, setPack] = useState<PromptPack | null>(null);
  const [tool, setTool] = useState<PackTool>("chatgpt");
  const [fallbackReason, setFallbackReason] = useState<string | undefined>();
  const [shortNotice, setShortNotice] = useState<{ got: number; want: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byok, setByok] = useState<ByokLocalPrefs | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const sync = () => setByok(readByokPrefs());
    Promise.resolve().then(sync);
    return subscribeByokPrefs(sync);
  }, []);

  const hasKey = Boolean(byok?.apiKey);
  const engineLabel = rulesOnly
    ? "内置规则引擎"
    : hasKey
      ? `BYOK · ${byok?.modelName || "自定义模型"}`
      : "内置规则引擎（免 Key）";

  const generate = useCallback(
    async (override?: { text: string; fileName: string; topic?: string; audience?: string; slideCount?: number }) => {
      const src = (override?.text ?? text).trim();
      if (src.length < MIN_CHARS) {
        setError(`资料内容太少（至少 ${MIN_CHARS} 个字）。可以粘贴论文摘要、课本章节、会议纪要或报告正文。`);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      const prefs = readByokPrefs();
      try {
        const res = await fetch("/api/prompt-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            text: src.slice(0, MAX_CHARS),
            fileName: override?.fileName ?? fileName,
            topic: override?.topic ?? topic,
            audience: override?.audience ?? audience,
            slideCount: override?.slideCount ?? slideCount,
            language,
            directionId,
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
    [text, fileName, topic, audience, slideCount, language, directionId, rulesOnly]
  );

  // Mount: homepage handoff → auto-generate; otherwise restore last draft.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const handoff = consumePackHandoff();
      if (handoff) {
        setText(handoff.text);
        setFileName(handoff.fileName);
        if (handoff.topic) setTopic(handoff.topic);
        if (handoff.audience) setAudience(handoff.audience);
        if (handoff.slideCount) setSlideCount(handoff.slideCount);
        void generate(handoff);
        return;
      }
      const draft = readDraft();
      if (draft) {
        setPack(draft.pack);
        setTool(draft.tool);
        setLanguage(draft.language);
        setFallbackReason(draft.fallbackReason);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the latest pack (never includes the BYOK key).
  useEffect(() => {
    if (!pack) return;
    try {
      window.localStorage.setItem(PACK_DRAFT_KEY, JSON.stringify({ pack, tool, language, fallbackReason }));
    } catch {
      // quota / private mode — ignore
    }
  }, [pack, tool, language, fallbackReason]);

  const loadSample = (id: string) => {
    const s = PACK_SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setText(s.text);
    setFileName(s.fileName);
    setAudience(s.audience);
    setSlideCount(s.slideCount);
    setTopic("");
    setTab("paste");
    void generate({ text: s.text, fileName: s.fileName, audience: s.audience, slideCount: s.slideCount, topic: "" });
  };

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || parsing) return;
    const id = `${file.name}-${file.size}-${Date.now()}`;
    setUploadFiles([{ id, name: file.name, size: file.size, status: "parsing", statusText: "正在提取文字…" }]);
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || "文档解析失败，请检查文件格式";
        setUploadFiles([{ id, name: file.name, size: file.size, status: "error", error: msg }]);
        return;
      }
      const extracted = String(data.text || "");
      setText(extracted.slice(0, MAX_CHARS));
      setFileName(data.fileName || file.name);
      if (data.suggestedTopic) setTopic(String(data.suggestedTopic).slice(0, 60));
      setUploadFiles([
        {
          id,
          name: data.fileName || file.name,
          size: file.size,
          status: "success",
          statusText: `已提取 ${extracted.length.toLocaleString("zh-CN")} 字${extracted.length > MAX_CHARS ? `（使用前 ${MAX_CHARS} 字）` : ""}`,
          warning: data.warning,
        },
      ]);
    } catch {
      setUploadFiles([{ id, name: file.name, size: file.size, status: "error", error: "网络异常，请重试" }]);
    } finally {
      setParsing(false);
    }
  };

  const sendToGenerate = () => {
    if (!pack) return;
    saveDocIntakeHandoff({
      fileName: pack.insight.fileName || fileName || "提示词包资料.txt",
      fileType: "txt",
      charCount: text.length || pack.insight.charCount,
      text: text || pack.slides.map((s) => [s.title, ...s.points].join("\n")).join("\n\n"),
      topic: pack.insight.topic,
      subtitle: pack.insight.subtitle,
      audience: pack.insight.audience,
      slideCount: Math.min(20, pack.slides.length),
      styleSlug: "",
      autoGenerate: false,
      parsedOutline: pack.slides.slice(0, 20).map((s, i) => ({
        id: `outline_${i + 1}`,
        slideType: packSlideToCanvas(s, pack.insight).slideType,
        sectionTag: String(i + 1).padStart(2, "0"),
        title: s.title,
        summary: [...s.points, ...s.data.map((d) => `${d.label} ${d.value}`)].join("；").slice(0, 160),
      })),
    });
    router.push("/generate?intake=1");
  };

  const steps: StepperStep[] = useMemo(() => {
    const hasText = text.trim().length >= MIN_CHARS;
    return [
      { id: "source", title: "资料", status: pack || hasText ? "completed" : "active" },
      { id: "style", title: "风格", status: pack ? "completed" : hasText ? "active" : "upcoming" },
      { id: "outline", title: "逐页大纲", status: pack ? "completed" : "upcoming" },
      { id: "export", title: "复制到 AI 工具", status: pack ? "active" : "upcoming" },
    ];
  }, [pack, text]);

  const charCount = text.length;

  return (
    <main className="gl-pack" id="pg-pack-page">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="提示词包工作台"
        subtitle="把论文、课本、报告变成可直接粘贴到 ChatGPT / Gamma / Kimi / Claude 的 PPT 提示词：定制风格 + 逐页大纲，数据只取自你的资料"
        compact
      />

      <Stepper steps={steps} orientation="horizontal" ariaLabel="提示词包生成步骤" className="gl-pack-stepper" />

      <div className="gl-pack-layout">
        {/* ------------------------------------------------ input column */}
        <section className="gl-pack-card gl-pack-input" aria-labelledby="pg-pack-input-title">
          <header className="gl-pack-card-head is-compact">
            <h2 className="gl-pack-h2" id="pg-pack-input-title">
              资料输入
            </h2>
            <span className="gl-pack-count" aria-live="polite">
              {charCount.toLocaleString("zh-CN")} / {MAX_CHARS.toLocaleString("zh-CN")} 字
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
              maxLength={MAX_CHARS}
              placeholder={"粘贴论文摘要、课本章节、读书笔记、会议纪要或经营报告…\n\n小技巧：保留原文的小标题（如「一、背景」「## 方法」），大纲会更贴合资料结构。"}
              onChange={(e) => setText(e.target.value)}
            />
          ) : null}

          {tab === "upload" ? (
            <UploadDropzone
              variant="compact"
              files={uploadFiles}
              onFilesAccepted={handleFiles}
              onRemoveFile={() => setUploadFiles([])}
              uploading={parsing}
              title="拖入 PDF / Word / PPTX / Markdown"
              hint="单个文件 ≤ 10MB，只提取文字，不保存文件"
              buttonLabel="选择文件"
              inputId="pg-pack-file-input"
              buttonId="pg-pack-file-btn"
            />
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
              <select id="pg-pack-direction" value={directionId} onChange={(e) => setDirectionId(e.target.value)}>
                <option value="auto">按资料自动匹配</option>
                {DESIGN_DIRECTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
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
              <PackPreviewStrip pack={pack} />
              <PackExportPanel
                pack={pack}
                tool={tool}
                language={language}
                onToolChange={setTool}
                onToast={showToast}
                onSendToGenerate={sendToGenerate}
              />
              <PackOutlineEditor pack={pack} onChange={setPack} />
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
      <p className="gl-pack-label">没有现成资料？试试示例：</p>
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
