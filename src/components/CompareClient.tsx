"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Columns3,
  Copy,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { compilePrompt } from "@/lib/promptCompiler";
import {
  ALL_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  TOOL_METADATA,
  type PromptItem,
  type SlideType,
} from "@/types/prompt";

interface CompareClientProps {
  allPrompts: PromptItem[];
}

export default function CompareClient({ allPrompts }: CompareClientProps) {
  const {
    compareIds,
    toggleCompare,
    replaceCompareIds,
    removeCompare,
    clearCompare,
    globalTopic,
    setGlobalTopic,
    showToast,
  } = useApp();

  const [syncSlide, setSyncSlide] = useState<SlideType>("cover");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clearedByUser, setClearedByUser] = useState(false);

  const selectedPrompts = useMemo(() => {
    if (compareIds.length === 0) {
      return clearedByUser ? [] : allPrompts.slice(0, 3);
    }
    const map = new Map(allPrompts.map((p) => [p.id, p]));
    return compareIds
      .map((id) => map.get(id))
      .filter(Boolean) as PromptItem[];
  }, [allPrompts, compareIds, clearedByUser]);

  const activeIds = useMemo(
    () => selectedPrompts.map((p) => p.id),
    [selectedPrompts]
  );

  const unselectedPrompts = useMemo(
    () => allPrompts.filter((p) => !activeIds.includes(p.id)),
    [allPrompts, activeIds]
  );

  const isSampleTopic = !globalTopic.trim();

  const handleAddStyle = (prompt: PromptItem) => {
    setClearedByUser(false);
    if (compareIds.length === 0 && !clearedByUser) {
      const next = [...activeIds.slice(0, 2), prompt.id];
      replaceCompareIds(Array.from(new Set(next)).slice(0, 3));
      showToast(`已加入对比：${prompt.title}`);
      return;
    }
    toggleCompare(prompt.id, prompt.title);
  };

  const handleRemoveStyle = (id: string) => {
    if (compareIds.length === 0) {
      const remaining = activeIds.filter((itemId) => itemId !== id);
      if (remaining.length === 0) {
        setClearedByUser(true);
        clearCompare();
      } else {
        replaceCompareIds(remaining);
      }
      return;
    }
    if (compareIds.length === 1 && compareIds[0] === id) {
      setClearedByUser(true);
    }
    removeCompare(id);
  };

  const handleClearAll = () => {
    setClearedByUser(true);
    clearCompare();
  };

  const loadPresetTrio = () => {
    setClearedByUser(false);
    replaceCompareIds(allPrompts.slice(0, 3).map((p) => p.id));
  };

  const handleCopy = async (prompt: PromptItem) => {
    const tool = prompt.recommendedTools[0] ?? "claude-html";
    const text = compilePrompt(
      prompt,
      prompt.visualSpec,
      {
        topic: globalTopic.trim() || prompt.sampleTopic,
        subtitle: prompt.sampleSubtitle,
        audience: "核心决策团队",
        slideCount: 12,
        language: "zh",
        tone: "executive",
        targetTool: tool,
      },
      syncSlide
    );
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(prompt.id);
      showToast(`已复制「${prompt.title}」提示词`, "success");
      window.setTimeout(() => setCopiedId(null), 1800);
      fetch(`/api/prompts/${prompt.id}/copy`, { method: "POST" }).catch(
        () => {}
      );
    } else {
      showToast("复制失败", "error");
    }
  };

  return (
    <main className="pg-page">
      <div className="pg-container">
        <PageHeader
          icon={<Columns3 size={22} />}
          title="风格并排对比"
          subtitle="将 2–3 套心仪风格置于同一画布下，同步切换全部 12 种商业页型并填入统一主题，直观比对信息层级、配色方案与适配工具。"
          actions={
            <div className="pg-subpage-actions">
              {selectedPrompts.length < 3 && unselectedPrompts.length > 0 && (
                <>
                  <select
                    id="pg-compare-add-select"
                    className="pg-select"
                    aria-label="添加风格到对比"
                    value=""
                    onChange={(e) => {
                      const chosen = unselectedPrompts.find(
                        (p) => p.id === e.target.value
                      );
                      if (chosen) handleAddStyle(chosen);
                    }}
                  >
                    <option value="" disabled>
                      + 快速添加风格 ({selectedPrompts.length}/3)
                    </option>
                    {unselectedPrompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary"
                    onClick={() => setPickerOpen((v) => !v)}
                    id="pg-compare-add-btn"
                  >
                    <Plus size={15} />
                    <span>画廊挑选</span>
                  </button>
                </>
              )}
              {selectedPrompts.length > 0 && (
                <button
                  type="button"
                  className="pg-btn pg-btn-ghost"
                  onClick={handleClearAll}
                >
                  <Trash2 size={14} />
                  <span>清空</span>
                </button>
              )}
            </div>
          }
        />

        {/* Sync Controls Bar (All 12 Slide Types) */}
        <section className="pg-compare-toolbar">
          <div
            className="pg-compare-sync-tabs"
            role="tablist"
            aria-label="同步切换全部对比页型"
          >
            <span className="pg-filter-label">同步预览页型（12 种）：</span>
            {ALL_SLIDE_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={syncSlide === st}
                className={`pg-mini-pill ${syncSlide === st ? "is-active" : ""}`}
                onClick={() => setSyncSlide(st)}
              >
                {SLIDE_TYPE_LABELS[st].label}
              </button>
            ))}
          </div>

          <div className="pg-compare-topic-wrap">
            <input
              type="text"
              className="pg-input-inline"
              placeholder="输入统一主题，同步预览对比差异..."
              value={globalTopic}
              onChange={(e) => setGlobalTopic(e.target.value)}
              id="pg-compare-topic-input"
            />
            {isSampleTopic && (
              <span
                className="pg-tag pg-tag-scenario"
                style={{ marginLeft: 8, whiteSpace: "nowrap" }}
              >
                示例预览
              </span>
            )}
          </div>
        </section>

        {/* Inline Style Picker Drawer */}
        {(pickerOpen || selectedPrompts.length === 0) && (
          <section className="pg-panel pg-picker-panel">
            <div className="pg-panel-head">
              <h2>
                {selectedPrompts.length === 0
                  ? "选择 2–3 套风格开始并排对比"
                  : "继续选择要加入对比的风格"}
              </h2>
              <div className="pg-btn-group">
                {selectedPrompts.length === 0 && (
                  <button
                    type="button"
                    className="pg-btn pg-btn-primary pg-btn-sm"
                    onClick={loadPresetTrio}
                    id="pg-compare-preset-btn"
                  >
                    一键载入经典三套对比
                  </button>
                )}
                {selectedPrompts.length > 0 && (
                  <button
                    type="button"
                    className="pg-icon-btn"
                    onClick={() => setPickerOpen(false)}
                    aria-label="收起选择面板"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="pg-picker-grid">
              {unselectedPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pg-picker-card"
                  onClick={() => handleAddStyle(p)}
                >
                  <div className="pg-picker-swatch-bar">
                    <span style={{ background: p.visualSpec.palette.bg }} />
                    <span style={{ background: p.visualSpec.palette.text }} />
                    <span style={{ background: p.visualSpec.palette.accent }} />
                  </div>
                  <div className="pg-picker-info">
                    <strong>{p.title}</strong>
                    <span>
                      {p.scenario} · {p.styleCategory}
                    </span>
                  </div>
                  <Plus size={15} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Comparison Grid & Design Spec Matrix */}
        {selectedPrompts.length > 0 && (
          <div
            className="pg-compare-columns"
            style={{
              gridTemplateColumns: `repeat(${selectedPrompts.length}, minmax(0, 1fr))`,
            }}
          >
            {selectedPrompts.map((p) => {
              const genHref = globalTopic.trim()
                ? `/generate?style=${encodeURIComponent(
                    p.slug
                  )}&topic=${encodeURIComponent(globalTopic.trim())}`
                : `/generate?style=${encodeURIComponent(p.slug)}`;

              return (
                <article key={p.id} className="pg-compare-col">
                  <div className="pg-compare-col-head">
                    <div>
                      <Link
                        href={`/studio/${p.slug}`}
                        className="pg-compare-col-title"
                      >
                        {p.title}
                      </Link>
                      <div className="pg-compare-col-sub">
                        {p.scenario} · {p.styleCategory}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pg-icon-btn"
                      onClick={() => handleRemoveStyle(p.id)}
                      title="移出对比"
                      aria-label={`移出 ${p.title}`}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="pg-compare-canvas-box">
                    <SlideCanvas
                      spec={p.visualSpec}
                      slideType={syncSlide}
                      topic={globalTopic.trim() || p.sampleTopic}
                      subtitle={p.sampleSubtitle}
                      englishTitle={p.englishTitle}
                      scenario={p.scenario}
                    />
                  </div>

                  <dl className="pg-spec-list">
                    <div className="pg-spec-row">
                      <dt>配色系统</dt>
                      <dd>
                        <div className="pg-compare-swatches">
                          {[
                            { label: "BG", hex: p.visualSpec.palette.bg },
                            { label: "INK", hex: p.visualSpec.palette.text },
                            { label: "ACCENT", hex: p.visualSpec.palette.accent },
                          ].map((s) => (
                            <span key={s.label} className="pg-hex-chip">
                              <i style={{ background: s.hex }} />
                              <code>{s.hex}</code>
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>

                    <div className="pg-spec-row">
                      <dt>字体规范</dt>
                      <dd>
                        {p.visualSpec.typography.headingFontLabel} /{" "}
                        {p.visualSpec.typography.bodyFontLabel}
                      </dd>
                    </div>

                    <div className="pg-spec-row">
                      <dt>版式密度 &amp; 圆角</dt>
                      <dd>
                        {p.visualSpec.layout.density === "airy"
                          ? "高留白呼吸感"
                          : p.visualSpec.layout.density === "dense"
                          ? "高信息密度"
                          : "均衡结构"}{" "}
                        · 圆角 {p.visualSpec.layout.cornerRadius}px
                      </dd>
                    </div>

                    <div className="pg-spec-row">
                      <dt>推荐 AI 工具</dt>
                      <dd className="pg-tool-chip-list">
                        {p.recommendedTools.map((t) => (
                          <span key={t} className="pg-tag">
                            {TOOL_METADATA[t].shortName}
                          </span>
                        ))}
                      </dd>
                    </div>

                    <div className="pg-spec-row">
                      <dt>核心美学提示词</dt>
                      <dd className="pg-spec-prose">{p.promptAnatomy.style}</dd>
                    </div>
                  </dl>

                  <div className="pg-compare-col-actions">
                    <button
                      type="button"
                      className="pg-btn pg-btn-ghost pg-btn-sm"
                      onClick={() => handleCopy(p)}
                      title="复制提示词"
                    >
                      {copiedId === p.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>{copiedId === p.id ? "已复制" : "复制"}</span>
                    </button>
                    <Link
                      href={genHref}
                      className="pg-btn pg-btn-secondary pg-btn-sm pg-btn-flex"
                    >
                      <Sparkles size={13} />
                      <span>生成 PPT</span>
                    </Link>
                    <Link
                      href={`/studio/${p.slug}`}
                      className="pg-btn pg-btn-primary pg-btn-sm pg-btn-flex"
                    >
                      <span>工作室</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
