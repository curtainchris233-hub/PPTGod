"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Languages,
  LayoutTemplate,
  PenLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button, Select, Tabs, TextInput, Textarea } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { saveDocIntakeHandoff } from "@/lib/docIntakeHandoff";
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import {
  EVIDENCE_DENSITY_LABELS,
  type EvidenceDensity,
  type PromptItem,
} from "@/types/prompt";

export type CreateTab = "ai" | "doc" | "template";

const SLIDE_COUNT_OPTIONS: SelectOption[] = [6, 8, 10, 12, 16, 20].map((n) => ({
  value: String(n),
  label: `约 ${n} 页`,
}));

/** Audience values are passed verbatim to /api/generate (`audience`). */
const AUDIENCE_OPTIONS: SelectOption[] = [
  { value: "通用听众", label: "通用" },
  { value: "核心决策层与业务团队", label: "管理层" },
  { value: "客户与合作伙伴", label: "客户" },
  { value: "学术评审与同行专家", label: "学术评审" },
  { value: "学生与课堂学员", label: "学生" },
];

const DENSITY_OPTIONS: SelectOption[] = (
  Object.keys(EVIDENCE_DENSITY_LABELS) as EvidenceDensity[]
).map((key) => ({
  value: key,
  label: `${EVIDENCE_DENSITY_LABELS[key].label} · ${EVIDENCE_DENSITY_LABELS[key].short}`,
}));

const TOPIC_MAX = 120;
const PASTE_MAX = 16000;

function firstMeaningfulLine(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[#>*\-\s\d.、]+/, "").trim())
    .find((l) => l.length >= 2);
  return (line || "").slice(0, 40);
}

interface CreatePanelProps {
  prompts: PromptItem[];
  topic: string;
  onTopicChange: (topic: string) => void;
  styleSlug: string;
  onStyleChange: (slug: string) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}

export default function CreatePanel({
  prompts,
  topic,
  onTopicChange,
  styleSlug,
  onStyleChange,
  busy,
  onBusyChange,
}: CreatePanelProps) {
  const router = useRouter();
  const topicRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);

  const [tab, setTab] = useState<CreateTab>("ai");
  const [slideCount, setSlideCount] = useState("12");
  const [audience, setAudience] = useState(AUDIENCE_OPTIONS[0].value);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [density, setDensity] = useState<EvidenceDensity>("balanced");
  const [requirements, setRequirements] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const styleOptions = useMemo<SelectOption[]>(
    () => prompts.map((p) => ({ value: p.slug, label: p.title })),
    [prompts]
  );

  const selectedStyle = prompts.find((p) => p.slug === styleSlug) ?? prompts[0];

  const launchGeneration = (payload: {
    topic: string;
    text: string;
    fileName: string;
    fileType: string;
    scenarioFromText?: boolean;
  }) => {
    if (busy) return;
    onBusyChange(true);

    const analysis = payload.scenarioFromText
      ? analyzeDocumentAndRecommendStyles({
          text: payload.text,
          fileName: payload.fileName,
          suggestedTopic: payload.topic,
          suggestedSubtitle: subtitle,
          styles: prompts,
        })
      : undefined;

    saveDocIntakeHandoff({
      fileName: payload.fileName,
      fileType: payload.fileType,
      charCount: payload.text.length,
      text: payload.text,
      topic: payload.topic,
      subtitle: subtitle.trim(),
      audience,
      slideCount: Number(slideCount),
      styleSlug: selectedStyle?.slug ?? "",
      autoGenerate: true,
      evidenceDensity: density,
      analysis,
    });
    const styleParam = selectedStyle
      ? `&style=${encodeURIComponent(selectedStyle.slug)}`
      : "";
    router.push(`/generate?intake=1${styleParam}`);
  };

  const handleGenerateFromTopic = () => {
    const clean = topic.trim();
    if (!clean) {
      setError("先写一句演示主题，例如「2026 年度工作总结与规划」");
      topicRef.current?.focus();
      return;
    }
    launchGeneration({
      topic: clean,
      text: requirements.trim(),
      fileName: "",
      fileType: "prompt",
    });
  };

  const handleGenerateFromPaste = () => {
    const clean = pasteText.trim();
    if (clean.length < 20) {
      setError("资料内容太短，请至少粘贴 20 个字，或把文件拖到右侧上传区");
      pasteRef.current?.focus();
      return;
    }
    const derivedTopic = topic.trim() || firstMeaningfulLine(clean) || "资料整理汇报";
    launchGeneration({
      topic: derivedTopic,
      text: clean,
      fileName: "粘贴的资料",
      fileType: "paste",
      scenarioFromText: true,
    });
  };

  const handleCreateFromTemplate = () => {
    if (!selectedStyle || busy) return;
    onBusyChange(true);
    const topicParam = topic.trim()
      ? `&topic=${encodeURIComponent(topic.trim())}`
      : "";
    router.push(
      `/generate?style=${encodeURIComponent(selectedStyle.slug)}${topicParam}`
    );
  };

  const paramsRow = (
    <div className="gl-dash-params">
      <Select
        variant="compact"
        size="sm"
        label="页数"
        name="slideCount"
        value={slideCount}
        onChange={(e) => setSlideCount(e.target.value)}
        options={SLIDE_COUNT_OPTIONS}
        id="gl-dash-slide-count"
      />
      <Select
        variant="compact"
        size="sm"
        label="受众"
        name="audience"
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
        options={AUDIENCE_OPTIONS}
        id="gl-dash-audience"
      />
      <span
        className="gl-dash-static-param"
        title="内置排版引擎输出中文；多语言请在创作工坊中接入自有模型（BYOK）"
      >
        <Languages size={14} aria-hidden="true" />
        <span className="gl-dash-static-label">语言</span>
        <span>中文</span>
      </span>
      <button
        type="button"
        className={`gl-dash-adv-toggle ${advancedOpen ? "is-open" : ""}`}
        aria-expanded={advancedOpen}
        aria-controls="gl-dash-advanced"
        onClick={() => setAdvancedOpen((v) => !v)}
        id="gl-dash-advanced-toggle"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        高级设置
      </button>
    </div>
  );

  const advancedFields = advancedOpen && (
    <div className="gl-dash-advanced" id="gl-dash-advanced">
      <TextInput
        size="sm"
        label="副标题"
        placeholder="可选，例如「以确定性设计系统重构团队交付效率」"
        value={subtitle}
        maxLength={60}
        onChange={(e) => setSubtitle(e.target.value)}
        id="gl-dash-subtitle"
      />
      <Select
        size="sm"
        label="内容密度"
        value={density}
        onChange={(e) => setDensity(e.target.value as EvidenceDensity)}
        options={DENSITY_OPTIONS}
        id="gl-dash-density"
      />
      {tab === "ai" && (
        <Textarea
          label="补充要求"
          placeholder="可选：要覆盖的要点、关键数据或必须出现的章节"
          value={requirements}
          maxLength={2000}
          rows={2}
          onChange={(e) => setRequirements(e.target.value)}
          wrapperClassName="gl-dash-advanced-wide"
          id="gl-dash-requirements"
        />
      )}
    </div>
  );

  return (
    <section className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-create" aria-labelledby="gl-dash-create-title">
      <h2 id="gl-dash-create-title" className="gl-sr-only">
        AI 创作
      </h2>
      <Tabs
        variant="segment"
        size="md"
        ariaLabel="创作方式"
        value={tab}
        onChange={(id) => {
          setTab(id as CreateTab);
          setError(null);
        }}
        id="gl-dash-create-tabs"
        items={[
          { id: "ai", label: "AI 生成", icon: <Sparkles size={15} />, controlsId: "gl-dash-create-body" },
          { id: "doc", label: "资料转 PPT", icon: <FileText size={15} />, controlsId: "gl-dash-create-body" },
          { id: "template", label: "从模板新建", icon: <LayoutTemplate size={15} />, controlsId: "gl-dash-create-body" },
        ]}
      />

      <div className="gl-dash-create-body" id="gl-dash-create-body" role="tabpanel">
        {tab === "ai" && (
          <>
            <Textarea
              ref={topicRef}
              label="演示主题"
              hideLabel
              placeholder="描述你的演示主题，例如「Attention Is All You Need 论文精读」或「高中物理 · 牛顿第二定律公开课」"
              value={topic}
              maxLength={TOPIC_MAX}
              rows={3}
              resize="none"
              leftIcon={<PenLine size={18} />}
              error={error ?? undefined}
              onChange={(e) => {
                onTopicChange(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerateFromTopic();
                }
              }}
              wrapperClassName="gl-dash-topic"
              id="gl-dash-topic"
            />
            {advancedFields}
            <div className="gl-dash-create-footer">
              {paramsRow}
              <Button
                variant="primary"
                size="md"
                loading={busy}
                loadingText="正在打开工坊…"
                leftIcon={<Sparkles size={15} />}
                rightIcon={<ArrowRight size={15} />}
                onClick={handleGenerateFromTopic}
                id="gl-dash-generate-btn"
              >
                生成 PPT
              </Button>
            </div>
          </>
        )}

        {tab === "doc" && (
          <>
            <Textarea
              ref={pasteRef}
              label="粘贴资料正文"
              hideLabel
              placeholder="粘贴会议纪要、报告正文或大纲，系统会识别场景、提炼章节并整理成 PPT。文件请拖到右侧上传区。"
              value={pasteText}
              maxLength={PASTE_MAX}
              rows={3}
              resize="none"
              leftIcon={<FileText size={18} />}
              error={error ?? undefined}
              onChange={(e) => {
                setPasteText(e.target.value);
                if (error) setError(null);
              }}
              wrapperClassName="gl-dash-topic"
              id="gl-dash-paste"
            />
            {advancedFields}
            <div className="gl-dash-create-footer">
              {paramsRow}
              <Button
                variant="primary"
                size="md"
                loading={busy}
                loadingText="正在打开工坊…"
                leftIcon={<Sparkles size={15} />}
                rightIcon={<ArrowRight size={15} />}
                onClick={handleGenerateFromPaste}
                id="gl-dash-paste-generate-btn"
              >
                整理成 PPT
              </Button>
            </div>
          </>
        )}

        {tab === "template" && (
          <>
            <div className="gl-dash-template-grid">
              <Select
                label="模板风格"
                value={selectedStyle?.slug ?? ""}
                onChange={(e) => onStyleChange(e.target.value)}
                options={styleOptions}
                id="gl-dash-template-style"
              />
              <TextInput
                label="演示主题（可选）"
                placeholder="留空则使用模板示例内容"
                value={topic}
                maxLength={TOPIC_MAX}
                onChange={(e) => onTopicChange(e.target.value)}
                id="gl-dash-template-topic"
              />
            </div>
            <div className="gl-dash-create-footer">
              <p className="gl-dash-template-note">
                {selectedStyle
                  ? `${selectedStyle.scenario} · ${selectedStyle.summary}`
                  : "暂无可用模板"}
              </p>
              <Button
                variant="primary"
                size="md"
                loading={busy}
                loadingText="正在打开工坊…"
                rightIcon={<ArrowRight size={15} />}
                onClick={handleCreateFromTemplate}
                disabled={!selectedStyle}
                id="gl-dash-template-btn"
              >
                用此模板新建
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
