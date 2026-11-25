"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  Compass,
  GraduationCap,
  Images,
  LayoutGrid,
  Microscope,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import DocIntakeWorkbench, {
  type DocIntakeParsedState,
} from "@/components/DocIntakeWorkbench";
import PageHeader from "@/components/layout/PageHeader";
import StyleCard from "@/components/presentation/StyleCard";
import StyleDetailDrawer from "@/components/presentation/StyleDetailDrawer";
import StyleMatcherModal from "@/components/StyleMatcherModal";
import { Button, EmptyState } from "@/components/ui";
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
import "@/styles/gallery.css";

const TOPIC_PRESETS = [
  "2026 AI Agent 落地路线",
  "Q4 增长与毛利复盘",
  "高中物理 · 电磁感应公开课",
  "国家自然科学基金答辩",
];

const DOMAIN_ICONS: Record<DomainTabId, React.ReactNode> = {
  all: <LayoutGrid size={14} aria-hidden="true" />,
  "business-tech": <Briefcase size={14} aria-hidden="true" />,
  teaching: <GraduationCap size={14} aria-hidden="true" />,
  research: <Microscope size={14} aria-hidden="true" />,
  workplace: <Building2 size={14} aria-hidden="true" />,
  lifestyle: <Palette size={14} aria-hidden="true" />,
};

const VALID_DOMAINS = new Set<string>(DOMAIN_TABS.map((t) => t.id));
const VALID_SCENARIOS = new Set<string>(SCENARIO_OPTIONS);
const VALID_STYLES = new Set<string>(STYLE_CATEGORY_OPTIONS);
const VALID_COLORS = new Set<string>(["all", "light", "dark", "warm", "vivid", "earth"]);
const VALID_TOOLS = new Set<string>(["all", ...Object.keys(TOOL_METADATA)]);
const VALID_SORTS = new Set<string>(["popular", "copies", "newest"]);

export interface GalleryInitialFilters {
  q?: string;
  domain?: string;
  scenario?: string;
  style?: string;
  color?: string;
  tool?: string;
  sort?: string;
}

interface GalleryClientProps {
  initialPrompts: PromptItem[];
  /** Search pre-filled from `/gallery?q=` (e.g. the global top-bar search). */
  initialSearch?: string;
  /** Full URL-hydrated filter state from `/gallery?...`. */
  initialFilters?: GalleryInitialFilters;
}

export default function GalleryClient({
  initialPrompts,
  initialSearch = "",
  initialFilters,
}: GalleryClientProps) {
  const { user, syncVersion, globalTopic, setGlobalTopic, showToast } =
    useApp();

  const [prompts, setPrompts] = useState<PromptItem[]>(initialPrompts);
  const [domainTab, setDomainTab] = useState<DomainTabId>(() => {
    const d = initialFilters?.domain;
    return d && VALID_DOMAINS.has(d) ? (d as DomainTabId) : "all";
  });
  const [searchQuery, setSearchQuery] = useState(
    initialFilters?.q ?? initialSearch
  );
  const [scenario, setScenario] = useState<string>(() => {
    const s = initialFilters?.scenario;
    return s && VALID_SCENARIOS.has(s) ? s : "全部场景";
  });
  const [styleCategory, setStyleCategory] = useState<string>(() => {
    const s = initialFilters?.style;
    return s && VALID_STYLES.has(s) ? s : "全部风格";
  });
  const [colorFamily, setColorFamily] = useState<ColorFamily | "all">(() => {
    const c = initialFilters?.color;
    return c && VALID_COLORS.has(c) ? (c as ColorFamily | "all") : "all";
  });
  const [targetTool, setTargetTool] = useState<TargetTool | "all">(() => {
    const t = initialFilters?.tool;
    return t && VALID_TOOLS.has(t) ? (t as TargetTool | "all") : "all";
  });
  const [sortBy, setSortBy] = useState<"popular" | "copies" | "newest">(() => {
    const s = initialFilters?.sort;
    return s && VALID_SORTS.has(s)
      ? (s as "popular" | "copies" | "newest")
      : "popular";
  });

  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialPrompts[0]?.slug ?? ""
  );
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [matcherOpen, setMatcherOpen] = useState(false);

  // Drop-a-Doc Intake state
  const heroDocInputRef = useRef<HTMLInputElement | null>(null);
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

  // Bidirectional URL query sync (history.replaceState avoids RSC reload flicker)
  const isFirstUrlSync = useRef(true);
  useEffect(() => {
    if (isFirstUrlSync.current) {
      isFirstUrlSync.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (domainTab !== "all") params.set("domain", domainTab);
    if (scenario !== "全部场景") params.set("scenario", scenario);
    if (styleCategory !== "全部风格") params.set("style", styleCategory);
    if (colorFamily !== "all") params.set("color", colorFamily);
    if (targetTool !== "all") params.set("tool", targetTool);
    if (sortBy !== "popular") params.set("sort", sortBy);
    const trimmed = searchQuery.trim();
    if (trimmed) params.set("q", trimmed);

    const qs = params.toString();
    const nextUrl = qs ? `/gallery?${qs}` : "/gallery";
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    domainTab,
    scenario,
    styleCategory,
    colorFamily,
    targetTool,
    sortBy,
    searchQuery,
  ]);

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
    targetTool !== "all" ||
    sortBy !== "popular";

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

  const previewPrompt = useMemo(
    () => (previewSlug ? prompts.find((p) => p.slug === previewSlug) ?? null : null),
    [prompts, previewSlug]
  );

  return (
    <main className="gl-gallery" id="gl-gallery-page">
      <PageHeader
        className="gl-gallery-hero"
        icon={<Images size={22} />}
        title="风格画廊"
        subtitle={`精选 ${prompts.length} 套高品质 PPT 视觉设计系统，覆盖学术、商务、科技、教育等全领域，一键预览并应用于演示文稿。`}
        actions={
          <div className="gl-gallery-hero-actions">
            <input
              ref={heroDocInputRef}
              id="pg-hero-doc-input"
              type="file"
              accept=".pdf,.docx,.pptx,.md,.txt"
              className="gl-sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleHeroDocUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="md"
              id="pg-open-matcher-btn"
              leftIcon={<Compass size={15} />}
              onClick={() => setMatcherOpen(true)}
            >
              智能选词
            </Button>
            <Button
              variant="secondary"
              size="md"
              id="pg-open-doc-intake-btn"
              leftIcon={<Upload size={15} />}
              loading={heroParsingDoc}
              loadingText="解析中…"
              onClick={() => setDocIntakeOpen(true)}
            >
              资料转 PPT
            </Button>
          </div>
        }
      />

      {/* Filter Deck */}
      <section className="gl-gallery-controls" aria-label="筛选演示风格">
        {/* Row 1: Domain Capsules with live DB counts */}
        <div
          className="gl-gallery-capsules"
          role="tablist"
          aria-label="按场景领域分类"
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
                className={`gl-gallery-capsule ${active ? "is-active" : ""}`}
                onClick={() => handleSelectDomain(tab.id)}
              >
                {DOMAIN_ICONS[tab.id]}
                <span>{tab.id === "all" ? "全部风格" : tab.label}</span>
                <span className="gl-gallery-capsule-count">
                  {domainCounts[tab.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Facet Selects + Search + Sort */}
        <div className="gl-gallery-toolbar">
          <div className="gl-gallery-facets">
            <select
              id="pg-filter-scenario"
              className={`gl-gallery-select ${
                scenario !== "全部场景" ? "is-filtered" : ""
              }`}
              aria-label="使用场景"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {visibleScenarios.map((sc) => (
                <option key={sc} value={sc}>
                  {sc === "全部场景" ? "使用场景" : sc}
                </option>
              ))}
            </select>

            <select
              id="pg-filter-style"
              className={`gl-gallery-select ${
                styleCategory !== "全部风格" ? "is-filtered" : ""
              }`}
              aria-label="视觉风格"
              value={styleCategory}
              onChange={(e) => setStyleCategory(e.target.value)}
            >
              {STYLE_CATEGORY_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st === "全部风格" ? "视觉风格" : st}
                </option>
              ))}
            </select>

            <select
              id="pg-filter-color"
              className={`gl-gallery-select ${
                colorFamily !== "all" ? "is-filtered" : ""
              }`}
              aria-label="配色方案"
              value={colorFamily}
              onChange={(e) =>
                setColorFamily(e.target.value as ColorFamily | "all")
              }
            >
              <option value="all">配色方案</option>
              {(["light", "dark", "warm", "vivid", "earth"] as const).map(
                (id) => (
                  <option key={id} value={id}>
                    {COLOR_FAMILY_LABELS[id]}
                  </option>
                )
              )}
            </select>

            <select
              id="pg-filter-tool"
              className={`gl-gallery-select ${
                targetTool !== "all" ? "is-filtered" : ""
              }`}
              aria-label="适配工具"
              value={targetTool}
              onChange={(e) =>
                setTargetTool(e.target.value as TargetTool | "all")
              }
            >
              <option value="all">适配工具</option>
              {(Object.keys(TOOL_METADATA) as TargetTool[]).map((t) => (
                <option key={t} value={t}>
                  {TOOL_METADATA[t].shortName}
                </option>
              ))}
            </select>
          </div>

          <div className="gl-gallery-toolbar-right">
            <div className="gl-gallery-search">
              <Search
                size={15}
                className="gl-gallery-search-icon"
                aria-hidden="true"
              />
              <input
                id="pg-gallery-search"
                type="search"
                aria-label="搜索风格名称或关键词"
                placeholder="搜索风格名称、关键词"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="gl-gallery-search-clear"
                  aria-label="清空搜索"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            <select
              id="pg-filter-sort"
              className={`gl-gallery-select ${
                sortBy !== "popular" ? "is-filtered" : ""
              }`}
              aria-label="排序方式"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "popular" | "copies" | "newest")
              }
            >
              <option value="popular">按热门排序</option>
              <option value="copies">按复制次数</option>
              <option value="newest">最新上架</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                id="pg-reset-filters-btn"
                leftIcon={<RotateCcw size={13} />}
                onClick={resetFilters}
              >
                清除筛选
              </Button>
            )}
          </div>
        </div>

        {/* Slim Live-Topic Preview Strip */}
        <div className="gl-gallery-topic-bar">
          <div className="gl-gallery-topic-field">
            <Wand2
              size={14}
              className="gl-gallery-topic-icon"
              aria-hidden="true"
            />
            <input
              id="pg-global-topic-input"
              type="text"
              className="gl-gallery-topic-input"
              aria-label="输入实时预览主题"
              placeholder="输入你的演示主题，下方所有风格画布同步换字预览…"
              value={globalTopic}
              onChange={(e) => setGlobalTopic(e.target.value)}
            />
            {globalTopic && (
              <button
                type="button"
                className="gl-sdrawer-topic-clear"
                onClick={() => setGlobalTopic("")}
              >
                重置
              </button>
            )}
          </div>
          <div className="gl-gallery-topic-presets">
            {TOPIC_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`gl-gallery-preset-chip ${
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
        </div>

        {(hasActiveFilters || globalTopic) && (
          <div className="gl-gallery-meta-line">
            <span>
              共匹配 <strong>{filteredPrompts.length}</strong> 套视觉风格
              {globalTopic && <> · 实时主题「{globalTopic}」</>}
            </span>
          </div>
        )}
      </section>

      {/* 4-Column StyleCard Grid */}
      <section aria-label="风格模板列表">
        {filteredPrompts.length > 0 ? (
          <div className="gl-gallery-grid">
            {filteredPrompts.map((prompt) => (
              <StyleCard
                key={prompt.id}
                prompt={prompt}
                liveTopic={globalTopic}
                selected={selectedSlug === prompt.slug}
                onSelect={setSelectedSlug}
                onPreview={(item) => setPreviewSlug(item.slug)}
                onUpdatePrompt={handleUpdatePrompt}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles size={24} />}
            title="没有找到匹配的视觉风格"
            description="试试清空部分筛选条件，或者直接去「发布风格」定制并保存一套专属视觉母版。"
            primaryAction={
              <Button
                variant="secondary"
                size="md"
                id="pg-empty-reset-filters-btn"
                leftIcon={<RotateCcw size={14} />}
                onClick={resetFilters}
              >
                清除筛选
              </Button>
            }
            secondaryAction={
              <Link href="/create" className="gl-btn gl-btn--primary gl-btn--md">
                发布新风格
              </Link>
            }
          />
        )}
      </section>

      <StyleDetailDrawer
        key={previewPrompt?.id ?? "closed"}
        prompt={previewPrompt}
        liveTopic={globalTopic}
        onLiveTopicChange={setGlobalTopic}
        onClose={() => setPreviewSlug(null)}
        onUpdatePrompt={handleUpdatePrompt}
      />

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
