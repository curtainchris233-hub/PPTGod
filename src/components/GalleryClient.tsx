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
  "2026 AI Agent 落地路线",
  "Q4 增长与毛利复盘",
  "高中物理 · 电磁感应公开课",
  "国家自然科学基金答辩",
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
  const [advFiltersOpen, setAdvFiltersOpen] = useState(false);
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

  const advFilterCount =
    (scenario !== "全部场景" ? 1 : 0) +
    (styleCategory !== "全部风格" ? 1 : 0) +
    (colorFamily !== "all" ? 1 : 0) +
    (targetTool !== "all" ? 1 : 0) +
    (sortBy !== "popular" ? 1 : 0);

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
    setSortBy("popular");
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
      {/* Airy Minimal Editorial Hero + Unified Command Capsule */}
      <section className="pg-hero pg-hero--minimal">
        <AiAmbientAccent variant="hero-neural" />
        <div className="pg-container">
          <div className="pg-hero-grid">
            <div className="pg-hero-copy">
              <p className="pg-kicker">
                PPTGOD · {prompts.length} 套全领域视觉系统
              </p>
              <h1 className="pg-hero-title">
                先看见 PPT 视觉，
                <br />
                再带走精准提示词
              </h1>
              <p className="pg-hero-lead">
                全领域 12 种页型实时预览 · 一键出词或直出 .pptx
              </p>

              <div className="pg-hero-actions">
                <button
                  type="button"
                  className="pg-btn pg-btn-primary"
                  onClick={() => setMatcherOpen(true)}
                  id="pg-open-matcher-btn"
                >
                  <Compass size={15} />
                  <span>智能选词</span>
                </button>
                <Link
                  href={quickGenerateHref}
                  className="pg-btn pg-btn-secondary"
                  id="pg-hero-generate-btn"
                >
                  <Sparkles size={15} />
                  <span>在线生成 PPT</span>
                </Link>
              </div>
            </div>

            {/* Unified Floating Command Capsule: Live Topic + Drop-a-Doc */}
            <div className="pg-live-topic-panel pg-command-capsule">
              <AiAmbientAccent variant="panel-corner" />
              <div className="pg-live-topic-input-wrap pg-command-input-row">
                <Wand2 size={15} className="pg-command-input-icon" />
                <input
                  id="pg-global-topic-input"
                  type="text"
                  className="pg-live-topic-input pg-command-input"
                  placeholder="输入你的 PPT 主题，下方画布实时换字..."
                  value={globalTopic}
                  onChange={(e) => setGlobalTopic(e.target.value)}
                />
                {globalTopic && (
                  <button
                    type="button"
                    className="pg-text-btn pg-command-clear"
                    onClick={() => setGlobalTopic("")}
                  >
                    重置
                  </button>
                )}
              </div>

              <div className="pg-topic-presets pg-topic-presets--single">
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

              {/* Compact Drop-a-Doc Intake Strip */}
              <div
                id="pg-hero-doc-dropzone"
                className={`pg-hero-doc-dropzone pg-hero-doc-dropzone--slim ${
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
                  <FileUp size={15} className="pg-hero-doc-icon" />
                  <span className="pg-hero-doc-title">
                    丢入 PDF / Word / TXT · 推风格 · 生成 PPT
                  </span>
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
                    <span>工作台</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Single-Row Calm Filter Bar + Progressive Disclosure Drawer */}
      <section className="pg-filters-section" aria-label="多维度筛选提示词">
        <div className="pg-container">
          <div
            className={`pg-filter-shell ${
              advFiltersOpen ? "is-expanded" : "is-compact"
            }`}
          >
            {/* Row 1 (Always Visible): 6 Domain Tabs + Inline Search + Progressive Filter Toggle */}
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

              <div className="pg-filter-right-controls">
                <div className="pg-search-box">
                  <Search size={14} className="pg-search-icon" />
                  <input
                    id="pg-gallery-search"
                    type="search"
                    placeholder="搜索风格、关键词..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  id="pg-toggle-adv-filters"
                  className={`pg-filter-toggle-btn ${
                    advFiltersOpen || advFilterCount > 0 ? "is-active" : ""
                  }`}
                  aria-expanded={advFiltersOpen}
                  onClick={() => setAdvFiltersOpen((v) => !v)}
                >
                  <SlidersHorizontal size={13} />
                  <span>筛选</span>
                  {advFilterCount > 0 && (
                    <span className="pg-filter-badge">{advFilterCount}</span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="pg-icon-btn"
                    onClick={resetFilters}
                    id="pg-reset-filters-btn"
                    title="重置全部筛选"
                    aria-label="重置全部筛选"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Progressive Disclosure Drawer: Scenario, Style, Color, Tool & Sort */}
            {advFiltersOpen && (
              <div className="pg-adv-filter-drawer" id="pg-adv-filter-drawer">
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
                    <select
                      id="pg-filter-style"
                      className="pg-select"
                      aria-label="按视觉风格筛选"
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
                    <div className="pg-color-pills" role="group" aria-label="按色系调性筛选">
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
                    <select
                      id="pg-filter-tool"
                      className="pg-select"
                      aria-label="按适配 AI 工具筛选"
                      value={targetTool}
                      onChange={(e) =>
                        setTargetTool(e.target.value as TargetTool | "all")
                      }
                    >
                      <option value="all">全部工具</option>
                      {(Object.keys(TOOL_METADATA) as TargetTool[]).map((t) => (
                        <option key={t} value={t}>
                          {TOOL_METADATA[t].shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-filter-group pg-filter-sort">
                    <select
                      id="pg-filter-sort"
                      className="pg-select"
                      aria-label="排序方式"
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
              </div>
            )}

            {/* Contextual Status Line: Only shown when actively filtered or previewing custom topic */}
            {(hasActiveFilters || globalTopic) && (
              <div className="pg-filter-meta">
                <span>
                  匹配 <strong>{filteredPrompts.length}</strong> 套
                  {globalTopic && (
                    <em className="pg-active-topic-indicator">
                      {" "}
                      · 预览主题「{globalTopic}」
                    </em>
                  )}
                </span>
              </div>
            )}
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
