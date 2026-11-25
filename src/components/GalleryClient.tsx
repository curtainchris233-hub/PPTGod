"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Compass,
  FileUp,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import AiAmbientAccent from "@/components/AiAmbientAccent";
import DocIntakeWorkbench, {
  type DocIntakeParsedState,
} from "@/components/DocIntakeWorkbench";
import PromptCard from "@/components/PromptCard";
import StyleMatcherModal from "@/components/StyleMatcherModal";
import { useApp } from "@/context/AppContext";
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import {
  COLOR_FAMILY_LABELS,
  DOMAIN_TABS,
  SCENARIO_OPTIONS,
  STYLE_CATEGORY_OPTIONS,
  TOOL_METADATA,
  type ColorFamily,
  type DomainTabId,
  type PromptItem,
  type TargetTool,
} from "@/types/prompt";

const TOPIC_PRESETS = [
  "2026 AI Agent 企业级落地路线图",
  "Q4 商业增长与毛利重构复盘",
  "高中物理 · 电磁感应公开课",
  "2026 国家自然科学基金面上项目答辩",
  "多模态大模型稀疏推理论文答辩",
  "在地茶饮品牌全渠道视觉焕新",
];

interface GalleryClientProps {
  initialPrompts: PromptItem[];
}

export default function GalleryClient({ initialPrompts }: GalleryClientProps) {
  const { user, syncVersion, globalTopic, setGlobalTopic, showToast } =
    useApp();

  const [prompts, setPrompts] = useState<PromptItem[]>(initialPrompts);
  const [domainTab, setDomainTab] = useState<DomainTabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scenario, setScenario] = useState<string>("全部场景");
  const [styleCategory, setStyleCategory] = useState<string>("全部风格");
  const [colorFamily, setColorFamily] = useState<ColorFamily | "all">("all");
  const [targetTool, setTargetTool] = useState<TargetTool | "all">("all");
  const [sortBy, setSortBy] = useState<"popular" | "copies" | "newest">(
    "popular"
  );
  const [matcherOpen, setMatcherOpen] = useState(false);

  // v7 Drop-a-Doc Intake Hub state
  const heroDocInputRef = useRef<HTMLInputElement | null>(null);
  const [heroDocDragging, setHeroDocDragging] = useState(false);
  const [heroParsingDoc, setHeroParsingDoc] = useState(false);
  const [docIntakeOpen, setDocIntakeOpen] = useState(false);
  const [heroParsedDoc, setHeroParsedDoc] =
    useState<DocIntakeParsedState | null>(null);
  const [intakeSessionKey, setIntakeSessionKey] = useState(0);

  // Re-sync liked/favorited state when auth or cloud favorite sync completes
  useEffect(() => {
    let cancelled = false;
    fetch("/api/prompts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.prompts)) {
          setPrompts(data.prompts);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, syncVersion]);

  const activeDomainDef = useMemo(
    () => DOMAIN_TABS.find((t) => t.id === domainTab) ?? DOMAIN_TABS[0],
    [domainTab]
  );

  const domainCounts = useMemo(() => {
    const counts: Record<DomainTabId, number> = {
      all: prompts.length,
      "business-tech": 0,
      teaching: 0,
      research: 0,
      workplace: 0,
      lifestyle: 0,
    };
    for (const tab of DOMAIN_TABS) {
      if (tab.id === "all") continue;
      counts[tab.id] = prompts.filter((p) =>
        tab.scenarios.includes(p.scenario)
      ).length;
    }
    return counts;
  }, [prompts]);

  const visibleScenarios = useMemo(() => {
    if (domainTab === "all") return [...SCENARIO_OPTIONS];
    return ["全部场景", ...activeDomainDef.scenarios];
  }, [domainTab, activeDomainDef]);

  const handleSelectDomain = (nextDomain: DomainTabId) => {
    setDomainTab(nextDomain);
    if (nextDomain !== "all" && scenario !== "全部场景") {
      const def = DOMAIN_TABS.find((t) => t.id === nextDomain);
      if (def && !def.scenarios.includes(scenario)) {
        setScenario("全部场景");
      }
    }
  };

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = prompts.filter((p) => {
      if (
        domainTab !== "all" &&
        !activeDomainDef.scenarios.includes(p.scenario)
      ) {
        return false;
      }
      if (scenario !== "全部场景" && p.scenario !== scenario) return false;
      if (styleCategory !== "全部风格" && p.styleCategory !== styleCategory)
        return false;
      if (colorFamily !== "all" && p.colorFamily !== colorFamily) return false;
      if (targetTool !== "all" && !p.recommendedTools.includes(targetTool))
        return false;
      if (q) {
        const hay = [
          p.title,
          p.englishTitle,
          p.summary,
          p.scenario,
          p.styleCategory,
          ...p.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortBy === "copies") {
        return b.copiesCount - a.copiesCount || b.likesCount - a.likesCount;
      }
      return b.likesCount - a.likesCount || b.copiesCount - a.copiesCount;
    });
  }, [
    prompts,
    domainTab,
    activeDomainDef,
    searchQuery,
    scenario,
    styleCategory,
    colorFamily,
    targetTool,
    sortBy,
  ]);

  const hasActiveFilters =
    domainTab !== "all" ||
    searchQuery.trim() !== "" ||
    scenario !== "全部场景" ||
    styleCategory !== "全部风格" ||
    colorFamily !== "all" ||
    targetTool !== "all";

  const resetFilters = () => {
    setDomainTab("all");
    setSearchQuery("");
    setScenario("全部场景");
    setStyleCategory("全部风格");
    setColorFamily("all");
    setTargetTool("all");
  };

  const handleUpdatePrompt = (updated: PromptItem) => {
    setPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleHeroDocUpload = async (file: File) => {
    if (heroParsingDoc) return;
    setHeroParsingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "文档解析失败，请检查文件格式", "error");
        return;
      }

      const analysis =
        data.analysis ||
        analyzeDocumentAndRecommendStyles({
          text: String(data.text || ""),
          fileName: data.fileName || file.name,
          suggestedTopic: data.suggestedTopic,
          suggestedSubtitle: data.suggestedSubtitle,
          styles: prompts,
        });

      const parsedState: DocIntakeParsedState = {
        fileName: data.fileName || file.name,
        fileType: data.fileType || "txt",
        charCount: Number(data.charCount) || String(data.text || "").length,
        text: String(data.text || ""),
        suggestedTopic: data.suggestedTopic || file.name,
        suggestedSubtitle:
          data.suggestedSubtitle || "基于源文档自动提炼的结构化演示方案",
        isScannedPdf: Boolean(data.isScannedPdf),
        warning: data.warning,
        parsedOutline: Array.isArray(data.parsedOutline)
          ? data.parsedOutline
          : undefined,
        analysis,
      };

      if (parsedState.suggestedTopic && !parsedState.isScannedPdf) {
        setGlobalTopic(parsedState.suggestedTopic);
      }
      setHeroParsedDoc(parsedState);
      setIntakeSessionKey((k) => k + 1);
      setDocIntakeOpen(true);
      showToast(
        `已解析「${parsedState.fileName}」· 识别为「${analysis.detectedScenario}」并生成 Top 3 推荐`,
        "success"
      );
    } catch {
      showToast("文档解析网络异常，请稍后重试", "error");
    } finally {
      setHeroParsingDoc(false);
    }
  };

  const quickGenerateHref = globalTopic.trim()
    ? `/generate?topic=${encodeURIComponent(globalTopic.trim())}`
    : "/generate";

  return (
    <main className="pg-page">
      {/* Compact Editorial Hero + Live Topic Stage Bar */}
      <section className="pg-hero">
        <AiAmbientAccent variant="hero-neural" />
        <div className="pg-container">
          <div className="pg-hero-grid">
            <div className="pg-hero-copy">
              <p className="pg-kicker">
                VISUAL PPT PROMPT SPECIMENS · {prompts.length} 套全领域可交互设计系统
              </p>
              <h1 className="pg-hero-title">
                先看见 PPT 视觉效果，
                <br />
                再带走精准提示词
              </h1>
              <p className="pg-hero-lead">
                覆盖商业科技、教师课堂、科研基金、项目政务与生活纪实全场景，每套提示词均以真实 16:9 画布渲染 12 种页型。一键编译适配
                Claude HTML、Gamma/Kimi、NotebookLM、即梦生图、Slidev 与 Python-PPTX，或在线直接导出可编辑
                .pptx。
              </p>

              <div className="pg-hero-actions">
                <button
                  type="button"
                  className="pg-btn pg-btn-primary"
                  onClick={() => setMatcherOpen(true)}
                  id="pg-open-matcher-btn"
                >
                  <Compass size={16} />
                  <span>30 秒智能选词顾问</span>
                </button>
                <Link
                  href={quickGenerateHref}
                  className="pg-btn pg-btn-secondary"
                  id="pg-hero-generate-btn"
                >
                  <Sparkles size={15} />
                  <span>站内直接生成 PPT (.pptx)</span>
                </Link>
              </div>
            </div>

            {/* Live Global Topic Injector + Drop-a-Doc Intake Bar (v7) */}
            <div className="pg-live-topic-panel">
              <AiAmbientAccent variant="panel-corner" />
              <div className="pg-live-topic-head">
                <span className="pg-live-topic-label">
                  <Wand2 size={14} />
                  <span>实时套用你的 PPT 主题预览画廊</span>
                </span>
                {globalTopic && (
                  <button
                    type="button"
                    className="pg-text-btn"
                    onClick={() => setGlobalTopic("")}
                  >
                    恢复示例主题
                  </button>
                )}
              </div>
              <div className="pg-live-topic-input-wrap">
                <input
                  id="pg-global-topic-input"
                  type="text"
                  className="pg-live-topic-input"
                  placeholder="输入你的课件/基金/汇报/旅行标题，下方所有画布同步刷新..."
                  value={globalTopic}
                  onChange={(e) => setGlobalTopic(e.target.value)}
                />
              </div>
              <div className="pg-topic-presets">
                <span className="pg-preset-hint">试试示例：</span>
                {TOPIC_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`pg-preset-chip ${
                      globalTopic === preset ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setGlobalTopic(globalTopic === preset ? "" : preset)
                    }
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* v7 Drop-a-Doc Quick Intake Bar */}
              <div
                id="pg-hero-doc-dropzone"
                className={`pg-hero-doc-dropzone ${
                  heroDocDragging ? "is-drag-over" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHeroDocDragging(true);
                }}
                onDragLeave={() => setHeroDocDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHeroDocDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleHeroDocUpload(file);
                }}
              >
                <input
                  ref={heroDocInputRef}
                  id="pg-hero-doc-input"
                  type="file"
                  accept=".pdf,.docx,.pptx,.md,.txt"
                  className="pg-hero-doc-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleHeroDocUpload(file);
                    e.target.value = "";
                  }}
                />
                <div className="pg-hero-doc-copy">
                  <FileUp size={16} className="pg-hero-doc-icon" />
                  <div>
                    <div className="pg-hero-doc-title">
                      丢入 PDF / Word / TXT · 推风格 · 出词 · 生成 PPT
                    </div>
                    <div className="pg-hero-doc-sub">
                      拖拽或上传资料即刻匹配 Top 3 视觉系统，也可粘贴文本直接试跑
                    </div>
                  </div>
                </div>
                <div className="pg-hero-doc-btns">
                  <button
                    type="button"
                    id="pg-hero-doc-upload-btn"
                    className="pg-btn pg-btn-ink pg-btn-xs"
                    disabled={heroParsingDoc}
                    onClick={() => heroDocInputRef.current?.click()}
                  >
                    <Upload size={12} />
                    <span>{heroParsingDoc ? "解析中..." : "上传资料"}</span>
                  </button>
                  <button
                    type="button"
                    id="pg-open-doc-intake-btn"
                    className="pg-btn pg-btn-secondary pg-btn-xs"
                    onClick={() => setDocIntakeOpen(true)}
                  >
                    <span>打开工作台</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Dimensional Filter Control Bar */}
      <section className="pg-filters-section" aria-label="多维度筛选提示词">
        <div className="pg-container">
          <div className="pg-filter-shell">
            {/* Full-Domain Audience Tabs + Inline Search Box (Compact Above-the-Fold) */}
            <div className="pg-domain-bar">
              <div
                className="pg-domain-tabs"
                role="tablist"
                aria-label="按人群领域浏览"
                id="pg-domain-tabs"
              >
                {DOMAIN_TABS.map((tab) => {
                  const active = domainTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`pg-domain-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      title={tab.desc}
                      className={`pg-domain-tab ${active ? "is-active" : ""}`}
                      onClick={() => handleSelectDomain(tab.id)}
                    >
                      <span className="pg-domain-tab-label">{tab.label}</span>
                      <span className="pg-domain-tab-count">
                        {domainCounts[tab.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pg-search-box">
                <Search size={15} className="pg-search-icon" />
                <input
                  id="pg-gallery-search"
                  type="search"
                  placeholder="搜索风格名、关键词、色系..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="pg-filter-row-top">
              <div
                className="pg-scenario-pills pg-scenario-pills--compact"
                role="group"
                aria-label="按使用场景筛选"
              >
                {visibleScenarios.map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    className={`pg-pill ${scenario === sc ? "is-active" : ""}`}
                    onClick={() => setScenario(sc)}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>

            <div className="pg-filter-row-sub">
              <div className="pg-filter-group">
                <span className="pg-filter-label">
                  <SlidersHorizontal size={13} />
                  <span>视觉风格</span>
                </span>
                <select
                  id="pg-filter-style"
                  className="pg-select"
                  value={styleCategory}
                  onChange={(e) => setStyleCategory(e.target.value)}
                >
                  {STYLE_CATEGORY_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pg-filter-group">
                <span className="pg-filter-label">色系调性</span>
                <div className="pg-color-pills">
                  {(
                    [
                      { id: "all", dot: null },
                      { id: "light", dot: "#F6F5F0" },
                      { id: "dark", dot: "#0F141A" },
                      { id: "warm", dot: "#F4EDE3" },
                      { id: "vivid", dot: "#FF5A1F" },
                      { id: "earth", dot: "#526D62" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`pg-mini-pill ${
                        colorFamily === item.id ? "is-active" : ""
                      }`}
                      onClick={() => setColorFamily(item.id)}
                    >
                      {item.dot && (
                        <span
                          className="pg-color-dot"
                          style={{ background: item.dot }}
                        />
                      )}
                      <span>{COLOR_FAMILY_LABELS[item.id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pg-filter-group">
                <span className="pg-filter-label">适配工具</span>
                <select
                  id="pg-filter-tool"
                  className="pg-select"
                  value={targetTool}
                  onChange={(e) =>
                    setTargetTool(e.target.value as TargetTool | "all")
                  }
                >
                  <option value="all">全部 6 类 AI PPT 工具</option>
                  {(Object.keys(TOOL_METADATA) as TargetTool[]).map((t) => (
                    <option key={t} value={t}>
                      {TOOL_METADATA[t].shortName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pg-filter-group pg-filter-sort">
                <span className="pg-filter-label">排序</span>
                <select
                  id="pg-filter-sort"
                  className="pg-select"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "popular" | "copies" | "newest"
                    )
                  }
                >
                  <option value="popular">按点赞热门</option>
                  <option value="copies">按复制次数</option>
                  <option value="newest">按最新发布</option>
                </select>
              </div>
            </div>

            <div className="pg-filter-meta">
              <span>
                共筛选出 <strong>{filteredPrompts.length}</strong> 套 PPT 视觉提示词
                {globalTopic && (
                  <em className="pg-active-topic-indicator">
                    {" "}
                    · 当前实时预览主题：「{globalTopic}」
                  </em>
                )}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="pg-text-btn"
                  onClick={resetFilters}
                  id="pg-reset-filters-btn"
                >
                  <RotateCcw size={13} />
                  <span>重置筛选条件</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Specimen Grid */}
      <section className="pg-gallery-section">
        <div className="pg-container">
          {filteredPrompts.length > 0 ? (
            <div className="pg-gallery-grid">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  liveTopic={globalTopic}
                  onUpdatePrompt={handleUpdatePrompt}
                />
              ))}
            </div>
          ) : (
            <div className="pg-empty-state">
              <Sparkles size={28} strokeWidth={1.5} />
              <h2>没有找到完全匹配的视觉风格</h2>
              <p>
                你可以放宽筛选条件，或者直接在「发布风格」中亲手调配并保存一套专属提示词。
              </p>
              <div className="pg-empty-actions">
                <button
                  type="button"
                  className="pg-btn pg-btn-secondary"
                  onClick={resetFilters}
                >
                  重置全部筛选
                </button>
                <Link href="/create" className="pg-btn pg-btn-primary">
                  去创建这套风格
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <StyleMatcherModal
        open={matcherOpen}
        onClose={() => setMatcherOpen(false)}
        prompts={prompts}
        liveTopic={globalTopic}
      />

      <DocIntakeWorkbench
        key={intakeSessionKey}
        open={docIntakeOpen}
        onClose={() => setDocIntakeOpen(false)}
        prompts={prompts}
        initialParsed={heroParsedDoc}
        onApplyTopic={(t) => setGlobalTopic(t)}
      />
    </main>
  );
}
