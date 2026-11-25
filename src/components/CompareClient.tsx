"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Copy,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
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
    removeCompare,
    clearCompare,
    globalTopic,
    setGlobalTopic,
    showToast,
  } = useApp();

  const [syncSlide, setSyncSlide] = useState<SlideType>("cover");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedPrompts = useMemo(() => {
    const map = new Map(allPrompts.map((p) => [p.id, p]));
    return compareIds
      .map((id) => map.get(id))
      .filter(Boolean) as PromptItem[];
  }, [allPrompts, compareIds]);

  const unselectedPrompts = useMemo(
    () => allPrompts.filter((p) => !compareIds.includes(p.id)),
    [allPrompts, compareIds]
  );

  const loadPresetTrio = () => {
    clearCompare();
    const defaults = allPrompts.slice(0, 3);
    defaults.forEach((p) => toggleCompare(p.id));
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
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(prompt.id);
      showToast(`已复制「${prompt.title}」提示词`, "success");
      window.setTimeout(() => setCopiedId(null), 1800);
      fetch(`/api/prompts/${prompt.id}/copy`, { method: "POST" }).catch(
        () => {}
      );
    } catch {
      showToast("复制失败", "error");
    }
  };

  return (
    <main className="pg-page">
      <div className="pg-container">
        <header className="pg-subpage-header">
          <div>
            <p className="pg-kicker">SIDE-BY-SIDE VISUAL BENCHMARK</p>
            <h1 className="pg-subpage-title">PPT 风格并排对比台</h1>
            <p className="pg-subpage-lead">
              将 2~3 套心仪风格置于同一画布下，同步切换全部 12 种商业页型并填入你的主题，直观比对信息层级、色系张力与适配工具。
            </p>
          </div>
          <div className="pg-subpage-actions">
            {selectedPrompts.length < 3 && (
              <button
                type="button"
                className="pg-btn pg-btn-secondary"
                onClick={() => setPickerOpen((v) => !v)}
                id="pg-compare-add-btn"
              >
                <Plus size={15} />
                <span>添加对比风格 ({selectedPrompts.length}/3)</span>
              </button>
            )}
            {selectedPrompts.length > 0 && (
              <button
                type="button"
                className="pg-btn pg-btn-ghost"
                onClick={clearCompare}
              >
                <Trash2 size={14} />
                <span>清空</span>
              </button>
            )}
          </div>
        </header>

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
                  onClick={() => toggleCompare(p.id, p.title)}
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
                      onClick={() => removeCompare(p.id)}
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
