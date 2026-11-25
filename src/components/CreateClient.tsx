"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitFork, Globe, Lock, Pencil, Sparkles, Wand2 } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import {
  ALL_SLIDE_TYPES,
  COLOR_FAMILY_LABELS,
  SCENARIO_OPTIONS,
  SLIDE_TYPE_LABELS,
  STYLE_CATEGORY_OPTIONS,
  TOOL_METADATA,
  type ColorFamily,
  type DecorativeMotif,
  type LayoutArchetype,
  type PromptAnatomy,
  type PromptItem,
  type SlideType,
  type TargetTool,
  type TypographyMood,
  type VisualSpec,
} from "@/types/prompt";
import "@/styles/community.css";

const ARCHETYPE_OPTIONS: { id: LayoutArchetype; label: string }[] = [
  { id: "swiss-grid", label: "瑞士非对称网格" },
  { id: "consulting-mbb", label: "麦肯锡咨询架构" },
  { id: "keynote-center", label: "发布会居中剧场" },
  { id: "soft-bento", label: "柔光圆角 Bento" },
  { id: "financial-terminal", label: "华尔街金融终端" },
  { id: "clinical-clean", label: "生命科学洁净" },
  { id: "editorial-asymmetric", label: "杂志画报编辑部" },
  { id: "neo-chinese", label: "宋韵新中式留白" },
  { id: "retro-bauhaus", label: "包豪斯几何建构" },
  { id: "academic-paper", label: "学术顶刊答辩" },
  { id: "warm-humanist", label: "暖调人文卡片" },
  { id: "tech-blueprint", label: "极客工程蓝图" },
  { id: "brutalist-poster", label: "酸性野兽派海报" },
  { id: "luxury-minimal", label: "北欧静奢画廊" },
  { id: "executive-emerald", label: "投行深翠年报" },
];

const MOTIF_OPTIONS: { id: DecorativeMotif; label: string }[] = [
  { id: "hairline-rule", label: "极细分割线" },
  { id: "swiss-cross", label: "瑞士十字锚标" },
  { id: "spotlight-orb", label: "柔和舞台光晕" },
  { id: "editorial-drop", label: "画册纤细外框" },
  { id: "ink-wash", label: "东方远山墨韵" },
  { id: "bauhaus-geo", label: "包豪斯几何块" },
  { id: "corner-brackets", label: "工程四角准星" },
  { id: "hard-offset", label: "野兽派硬投影" },
  { id: "ribbon-accent", label: "顶部彩带条" },
  { id: "bento-dots", label: "Bento 三色圆点" },
  { id: "none", label: "无装饰" },
];

const PALETTE_STARTERS: {
  name: string;
  colorFamily: ColorFamily;
  palette: VisualSpec["palette"];
}[] = [
  {
    name: "京都抹茶宣纸",
    colorFamily: "earth",
    palette: {
      bg: "#F3F2EB",
      surface: "#FAF9F5",
      text: "#1F2620",
      muted: "#626E63",
      accent: "#3D6B4F",
      accentSoft: "#E4EFE7",
      border: "#D5D9D1",
      chartColors: ["#3D6B4F", "#8A6D46", "#626E63", "#BAC5B8"],
    },
  },
  {
    name: "深海工业蓝图",
    colorFamily: "dark",
    palette: {
      bg: "#0C1524",
      surface: "#142136",
      text: "#F1F5F9",
      muted: "#94A7C2",
      accent: "#F59E0B",
      accentSoft: "rgba(245, 158, 11, 0.16)",
      border: "rgba(148, 167, 194, 0.22)",
      chartColors: ["#F59E0B", "#38BDF8", "#94A7C2", "#334E73"],
    },
  },
  {
    name: "米兰陶红画册",
    colorFamily: "warm",
    palette: {
      bg: "#F8F2EA",
      surface: "#FFFFFF",
      text: "#241914",
      muted: "#74625A",
      accent: "#B83B28",
      accentSoft: "#FCEAE6",
      border: "#E3D6C7",
      chartColors: ["#B83B28", "#2E4F4F", "#C48A47", "#A39187"],
    },
  },
  {
    name: "冰岛极简冷灰",
    colorFamily: "light",
    palette: {
      bg: "#F2F4F7",
      surface: "#FFFFFF",
      text: "#101828",
      muted: "#667085",
      accent: "#1D4ED8",
      accentSoft: "#E8F0FE",
      border: "#D9DFE8",
      chartColors: ["#1D4ED8", "#0F766E", "#667085", "#CBD5E1"],
    },
  },
];

interface CreateClientProps {
  mode: "create" | "fork" | "edit";
  sourcePrompt: PromptItem | null;
  editForbidden: boolean;
}

export default function CreateClient({
  mode,
  sourcePrompt,
  editForbidden,
}: CreateClientProps) {
  const router = useRouter();
  const { user, openAuthModal, showToast, refreshAuth } = useApp();

  const [previewSlide, setPreviewSlide] = useState<SlideType>("cover");
  const [title, setTitle] = useState(() => {
    if (mode === "edit" && sourcePrompt) return sourcePrompt.title;
    if (mode === "fork" && sourcePrompt) return `${sourcePrompt.title} · 改编版`;
    return "京都抹茶宣纸 · 静谧提案";
  });
  const [englishTitle, setEnglishTitle] = useState(() => {
    if (sourcePrompt) {
      return mode === "fork"
        ? `${sourcePrompt.englishTitle} Remix`
        : sourcePrompt.englishTitle;
    }
    return "Kyoto Matcha Paper";
  });
  const [summary, setSummary] = useState(
    sourcePrompt?.summary ||
      "以自然抹茶绿与温润宣纸米白构建宁静高级感，适合设计方案、品牌策展与年度叙事汇报。"
  );
  const [scenario, setScenario] = useState(sourcePrompt?.scenario || "品牌提案");
  const [styleCategory, setStyleCategory] = useState(
    sourcePrompt?.styleCategory || "极简主义"
  );
  const [colorFamily, setColorFamily] = useState<ColorFamily>(
    sourcePrompt?.colorFamily || "earth"
  );
  const [tagsInput, setTagsInput] = useState(
    sourcePrompt?.tags?.join(", ") || "自然配色, 极简留白, 品牌提案"
  );
  const [recommendedTools, setRecommendedTools] = useState<TargetTool[]>(
    sourcePrompt?.recommendedTools?.length
      ? sourcePrompt.recommendedTools
      : ["claude-html", "gamma-kimi", "ai-image"]
  );
  const [sampleTopic, setSampleTopic] = useState(
    sourcePrompt?.sampleTopic || "可持续材料与当代消费空间设计提案"
  );
  const [sampleSubtitle, setSampleSubtitle] = useState(
    sourcePrompt?.sampleSubtitle ||
      "让产品理念在克制留白中自然生长 · 2026 创意策划"
  );
  const [customNotes, setCustomNotes] = useState(
    sourcePrompt?.customNotes ||
      "建议每页保持 40% 以上留白，图表控制在 2 种主色以内。"
  );
  const [isPublic, setIsPublic] = useState<boolean>(
    mode === "edit" && sourcePrompt ? sourcePrompt.isPublic : true
  );

  const [visualSpec, setVisualSpec] = useState<VisualSpec>(
    sourcePrompt?.visualSpec || {
      palette: PALETTE_STARTERS[0].palette,
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Medium",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 600,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "editorial-asymmetric",
        density: "airy",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    }
  );

  const [promptAnatomy, setPromptAnatomy] = useState<PromptAnatomy>(
    sourcePrompt?.promptAnatomy || {
      style:
        "克制自然的当代东方极简风格，柔和纸本肌理搭配精细分割线，传递沉静可信的品牌审美品位。",
      palette:
        "底色采用宣纸微暖灰白（#F3F2EB），正文深森墨黑（#1F2620），以京都抹茶深绿（#3D6B4F）作为核心视觉强调色。",
      typography:
        "主标题采用优雅宋体衬线体建立书刊级气质，正文与数据图表搭配干净无衬线体保障清晰阅读。",
      layout:
        "非对称双栏留白构图，安全边距充沛，卡片圆角保持 4px 利落收敛，确保页面呼吸感。",
      content:
        "每页围绕单一结论展开，图表配色克制、标注具体数值，杜绝杂乱图标和无关装饰。",
    }
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleTool = (tool: TargetTool) => {
    setRecommendedTools((prev) =>
      prev.includes(tool)
        ? prev.length > 1
          ? prev.filter((t) => t !== tool)
          : prev
        : [...prev, tool]
    );
  };

  const autoSynthesizeAnatomy = () => {
    const { palette, typography, layout } = visualSpec;
    const archLabel =
      ARCHETYPE_OPTIONS.find((a) => a.id === layout.archetype)?.label ??
      layout.archetype;
    const densityText =
      layout.density === "airy"
        ? "高留白呼吸感（留白 >= 45%）"
        : layout.density === "dense"
        ? "高信息密度专业分栏"
        : "清晰均衡的结构节奏";

    setPromptAnatomy({
      style: `${title}（${englishTitle}）视觉体系：采用「${archLabel}」构成范式，整体追求高质感平面设计水准，去除廉价特效与视觉噪音。`,
      palette: `主画布底色 ${palette.bg}，表面模块 ${palette.surface}，主体文字 ${palette.text}，唯一核心强调色 ${palette.accent}，图表配色序列 ${palette.chartColors.join(" / ")}。`,
      typography: `主标题参考 ${typography.headingFontLabel}（字重 ${typography.titleWeight}），正文参考 ${typography.bodyFontLabel}，建立鲜明标题与正文级差。`,
      layout: `遵循 16:9 精准网格，${densityText}，容器圆角控制在 ${layout.cornerRadius}px，确保跨页版式高度统一。`,
      content: `针对「${scenario}」场景优化：每页标题结论先行，数据图表使用简洁 SVG/扁平矢量并明确标出关键增长数值。`,
    });
    showToast("已根据当前画布参数自动生成 5 维提示词拆解", "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("请先登录后再保存或发布风格");
      openAuthModal("login");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const isEdit = mode === "edit" && sourcePrompt;
      const endpoint = isEdit
        ? `/api/prompts/${sourcePrompt.id}`
        : "/api/prompts";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          englishTitle,
          summary,
          scenario,
          styleCategory,
          colorFamily,
          recommendedTools,
          tags,
          visualSpec,
          promptAnatomy,
          customNotes,
          sampleTopic,
          sampleSubtitle,
          isPublic,
          ...(mode === "fork" && sourcePrompt
            ? { remixedFromId: sourcePrompt.id }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败，请检查表单");
        return;
      }

      refreshAuth();
      showToast(
        isEdit
          ? `已保存对「${data.prompt.title}」的修改！`
          : isPublic
          ? `已公开发布「${data.prompt.title}」到社区画廊！`
          : `已将「${data.prompt.title}」保存为私有草稿（仅自己可见）！`,
        "success"
      );
      router.push(`/studio/${data.prompt.slug}`);
      router.refresh();
    } catch {
      setError("网络请求异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pg-page">
      <div className="pg-container">
        <header className="pg-subpage-header">
          <div>
            <p className="pg-kicker">
              {mode === "edit"
                ? "EDIT PROMPT STYLE"
                : mode === "fork"
                ? "REMIX PROMPT STUDIO"
                : "COMMUNITY PROMPT BUILDER"}
            </p>
            <h1 className="pg-subpage-title">
              {mode === "edit"
                ? `编辑模板 · ${sourcePrompt?.title}`
                : mode === "fork"
                ? `基于「${sourcePrompt?.title}」Remix 二创`
                : "创作并发布你的 PPT 视觉提示词"}
            </h1>
            <p className="pg-subpage-lead">
              调配配色体系、字体气质、版式网格与 5 维提示词拆解，左侧 16:9 画布实时预览全部 12 种商业页型，并可自由设置公开分享或仅自己可见。
            </p>
          </div>
          {!user && (
            <button
              type="button"
              className="pg-btn pg-btn-primary"
              onClick={() => openAuthModal("login")}
            >
              <Lock size={15} />
              <span>登录后即可发布</span>
            </button>
          )}
        </header>

        {editForbidden && (
          <div className="pg-form-error" style={{ marginBottom: "18px" }}>
            你没有权限编辑该模板（或模板不存在），已为你切换至全新创作模式。
          </div>
        )}

        {mode === "fork" && sourcePrompt && (
          <div className="pg-remix-banner" id="pg-create-remix-banner">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <GitFork size={15} />
              <span>
                正在基于{" "}
                <Link
                  href={`/studio/${sourcePrompt.slug}`}
                  style={{ textDecoration: "underline" }}
                >
                  {sourcePrompt.title}
                </Link>{" "}
                （by {sourcePrompt.author.displayName}）进行二创改编，发布后将自动保留改编溯源。
              </span>
            </span>
          </div>
        )}

        <div className="pg-create-layout">
          {/* LEFT: Live Sticky 16:9 Preview (12 Slide Types) */}
          <div className="pg-create-preview-col">
            <div className="pg-workbench-sticky">
              <div className="pg-stage-frame">
                <div className="pg-stage-toolbar">
                  <span className="pg-mono-pill">LIVE 16:9 · 12 SLIDES</span>
                  <div className="pg-btn-group">
                    {ALL_SLIDE_TYPES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`pg-mini-pill ${
                          previewSlide === st ? "is-active" : ""
                        }`}
                        onClick={() => setPreviewSlide(st)}
                      >
                        {SLIDE_TYPE_LABELS[st].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pg-stage-canvas-wrap">
                  <SlideCanvas
                    spec={visualSpec}
                    slideType={previewSlide}
                    topic={sampleTopic || title}
                    subtitle={sampleSubtitle}
                    englishTitle={englishTitle}
                    scenario={scenario}
                  />
                </div>
              </div>

              <div className="pg-panel" style={{ marginTop: "16px" }}>
                <div className="pg-panel-head">
                  <h2>一键灵感色板起点</h2>
                </div>
                <div className="pg-starter-grid">
                  {PALETTE_STARTERS.map((st) => (
                    <button
                      key={st.name}
                      type="button"
                      className="pg-starter-btn"
                      onClick={() => {
                        setColorFamily(st.colorFamily);
                        setVisualSpec((prev) => ({
                          ...prev,
                          palette: st.palette,
                        }));
                      }}
                    >
                      <div className="pg-starter-dots">
                        <span style={{ background: st.palette.bg }} />
                        <span style={{ background: st.palette.text }} />
                        <span style={{ background: st.palette.accent }} />
                      </div>
                      <span>{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Structured Form */}
          <form onSubmit={handleSubmit} className="pg-create-form-col">
            {/* Visibility Setting */}
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2>可见性权限设置</h2>
              </div>
              <div className="pg-visibility-cards" role="radiogroup" aria-label="风格可见性">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPublic}
                  className={`pg-visibility-card ${isPublic ? "is-active" : ""}`}
                  onClick={() => setIsPublic(true)}
                  id="pg-create-visibility-public"
                >
                  <span className="pg-visibility-card-head">
                    <Globe size={15} />
                    <span>公开分享到社区（默认）</span>
                  </span>
                  <p>展示在视觉画廊、并排对比库与你的创作者主页，供所有人预览与点赞。</p>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isPublic}
                  className={`pg-visibility-card ${!isPublic ? "is-active" : ""}`}
                  onClick={() => setIsPublic(false)}
                  id="pg-create-visibility-private"
                >
                  <span className="pg-visibility-card-head">
                    <Lock size={15} />
                    <span>仅自己可见（私有）</span>
                  </span>
                  <p>隐藏于公共画廊之外，仅你本人在「我的空间」和工作室中可查看、编辑与使用。</p>
                </button>
              </div>
            </section>

            {/* Step 1: Metadata */}
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2>1. 基础信息与适用场景</h2>
              </div>
              <div className="pg-form">
                <div className="pg-form-2col">
                  <div className="pg-field">
                    <label htmlFor="create-title">风格中文名称 *</label>
                    <input
                      id="create-title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="pg-field">
                    <label htmlFor="create-en">英文副名</label>
                    <input
                      id="create-en"
                      type="text"
                      value={englishTitle}
                      onChange={(e) => setEnglishTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pg-field">
                  <label htmlFor="create-summary">视觉亮点简介 *</label>
                  <textarea
                    id="create-summary"
                    rows={2}
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                <div className="pg-form-3col">
                  <div className="pg-field">
                    <label htmlFor="create-scenario">适用场景</label>
                    <select
                      id="create-scenario"
                      className="pg-select pg-select-full"
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                    >
                      {SCENARIO_OPTIONS.filter((s) => s !== "全部场景").map(
                        (sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="pg-field">
                    <label htmlFor="create-style">视觉分类</label>
                    <select
                      id="create-style"
                      className="pg-select pg-select-full"
                      value={styleCategory}
                      onChange={(e) => setStyleCategory(e.target.value)}
                    >
                      {STYLE_CATEGORY_OPTIONS.filter((s) => s !== "全部风格").map(
                        (st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="pg-field">
                    <label htmlFor="create-color-family">色系调性</label>
                    <select
                      id="create-color-family"
                      className="pg-select pg-select-full"
                      value={colorFamily}
                      onChange={(e) =>
                        setColorFamily(e.target.value as ColorFamily)
                      }
                    >
                      {(["light", "dark", "warm", "vivid", "earth"] as const).map(
                        (cf) => (
                          <option key={cf} value={cf}>
                            {COLOR_FAMILY_LABELS[cf]}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="pg-form-2col">
                  <div className="pg-field">
                    <label htmlFor="create-sample-topic">画廊示例标题</label>
                    <input
                      id="create-sample-topic"
                      type="text"
                      value={sampleTopic}
                      onChange={(e) => setSampleTopic(e.target.value)}
                    />
                  </div>
                  <div className="pg-field">
                    <label htmlFor="create-sample-subtitle">画廊示例副标题</label>
                    <input
                      id="create-sample-subtitle"
                      type="text"
                      value={sampleSubtitle}
                      onChange={(e) => setSampleSubtitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pg-field">
                  <label htmlFor="create-tags">标签（逗号分隔）</label>
                  <input
                    id="create-tags"
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>

                <div className="pg-field">
                  <label>推荐适配 AI 工具（支持全部 6 大生态）</label>
                  <div className="pg-btn-group">
                    {(Object.keys(TOOL_METADATA) as TargetTool[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`pg-mini-pill ${
                          recommendedTools.includes(t) ? "is-active" : ""
                        }`}
                        onClick={() => toggleTool(t)}
                      >
                        {TOOL_METADATA[t].shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Step 2: Visual Spec Controls */}
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2>2. 视觉系统配置（同步驱动左侧 16:9 画布）</h2>
              </div>
              <div className="pg-form">
                <div className="pg-form-3col">
                  <div className="pg-field">
                    <label htmlFor="create-arch">版式原型（15 种）</label>
                    <select
                      id="create-arch"
                      className="pg-select pg-select-full"
                      value={visualSpec.layout.archetype}
                      onChange={(e) =>
                        setVisualSpec((prev) => ({
                          ...prev,
                          layout: {
                            ...prev.layout,
                            archetype: e.target.value as LayoutArchetype,
                          },
                        }))
                      }
                    >
                      {ARCHETYPE_OPTIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-field">
                    <label htmlFor="create-motif">装饰元素（11 种）</label>
                    <select
                      id="create-motif"
                      className="pg-select pg-select-full"
                      value={visualSpec.layout.decorativeMotif}
                      onChange={(e) =>
                        setVisualSpec((prev) => ({
                          ...prev,
                          layout: {
                            ...prev.layout,
                            decorativeMotif: e.target.value as DecorativeMotif,
                          },
                        }))
                      }
                    >
                      {MOTIF_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-field">
                    <label htmlFor="create-typo">字体气质</label>
                    <select
                      id="create-typo"
                      className="pg-select pg-select-full"
                      value={visualSpec.typography.mood}
                      onChange={(e) =>
                        setVisualSpec((prev) => ({
                          ...prev,
                          typography: {
                            ...prev.typography,
                            mood: e.target.value as TypographyMood,
                          },
                        }))
                      }
                    >
                      <option value="swiss">瑞士几何无衬线</option>
                      <option value="editorial">杂志衬线体</option>
                      <option value="chinese">东方宋韵衬线</option>
                      <option value="consulting">商业咨询标准</option>
                      <option value="tech">科技极客无衬线</option>
                      <option value="academic">学术论文衬线</option>
                      <option value="brutalist">野兽派超粗黑体</option>
                      <option value="humanist">温润人文黑体</option>
                    </select>
                  </div>
                </div>

                <div className="pg-color-grid">
                  {(
                    [
                      { key: "bg", label: "画布底色" },
                      { key: "surface", label: "卡片表面" },
                      { key: "text", label: "主文字色" },
                      { key: "muted", label: "次文字色" },
                      { key: "accent", label: "核心强调色" },
                      { key: "border", label: "分割边框色" },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="pg-color-field">
                      <span>{item.label}</span>
                      <div className="pg-color-input-row">
                        <input
                          type="color"
                          value={
                            visualSpec.palette[item.key].startsWith("#")
                              ? visualSpec.palette[item.key]
                              : "#888888"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setVisualSpec((prev) => ({
                              ...prev,
                              palette: {
                                ...prev.palette,
                                [item.key]: val,
                                ...(item.key === "accent"
                                  ? {
                                      chartColors: [
                                        val,
                                        prev.palette.chartColors[1],
                                        prev.palette.chartColors[2],
                                        prev.palette.chartColors[3],
                                      ] as [string, string, string, string],
                                    }
                                  : {}),
                              },
                            }));
                          }}
                        />
                        <code>{visualSpec.palette[item.key]}</code>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pg-form-2col">
                  <div className="pg-field">
                    <label>留白与信息密度</label>
                    <div className="pg-btn-group">
                      {(
                        [
                          { id: "airy", label: "高留白" },
                          { id: "balanced", label: "均衡" },
                          { id: "dense", label: "高密度" },
                        ] as const
                      ).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className={`pg-mini-pill ${
                            visualSpec.layout.density === d.id
                              ? "is-active"
                              : ""
                          }`}
                          onClick={() =>
                            setVisualSpec((prev) => ({
                              ...prev,
                              layout: { ...prev.layout, density: d.id },
                            }))
                          }
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pg-field">
                    <label>
                      卡片圆角 ({visualSpec.layout.cornerRadius}px)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={2}
                      value={visualSpec.layout.cornerRadius}
                      onChange={(e) =>
                        setVisualSpec((prev) => ({
                          ...prev,
                          layout: {
                            ...prev.layout,
                            cornerRadius: Number(e.target.value),
                          },
                        }))
                      }
                      className="pg-range"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Step 3: 5-Dimension Prompt Anatomy */}
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2>3. 提示词 5 维结构描述</h2>
                <button
                  type="button"
                  className="pg-btn pg-btn-secondary pg-btn-xs"
                  onClick={autoSynthesizeAnatomy}
                >
                  <Wand2 size={13} />
                  <span>按视觉参数一键生成文案</span>
                </button>
              </div>
              <div className="pg-form">
                {(
                  [
                    { key: "style", label: "美学风格与氛围" },
                    { key: "palette", label: "色彩系统规范" },
                    { key: "typography", label: "字体与层级尺度" },
                    { key: "layout", label: "版式网格与留白" },
                    { key: "content", label: "叙事与图表约束" },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className="pg-field">
                    <label htmlFor={`anatomy-${field.key}`}>{field.label}</label>
                    <textarea
                      id={`anatomy-${field.key}`}
                      rows={2}
                      required
                      value={promptAnatomy[field.key]}
                      onChange={(e) =>
                        setPromptAnatomy((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="pg-field">
                  <label htmlFor="create-notes">创作者使用建议（选填）</label>
                  <input
                    id="create-notes"
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {error && <div className="pg-form-error">{error}</div>}

            <div className="pg-create-submit-row">
              <button
                type="submit"
                className="pg-btn pg-btn-primary pg-btn-lg"
                disabled={submitting}
                id="pg-create-publish-btn"
              >
                {mode === "edit" ? <Pencil size={16} /> : <Sparkles size={16} />}
                <span>
                  {submitting
                    ? "正在保存..."
                    : !user
                    ? "登录并提交此风格"
                    : mode === "edit"
                    ? "保存模板修改"
                    : isPublic
                    ? mode === "fork"
                      ? "发布二创风格到社区"
                      : "立即公开发布到 PPTGod 画廊"
                    : "保存为仅自己可见（私有）"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
