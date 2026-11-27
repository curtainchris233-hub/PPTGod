"use client";

import React from "react";
import {
  Plus,
  Trash2,
} from "lucide-react";
import ImageSlotManager from "@/components/generate/ImageSlotManager";
import { remapSlideLayoutPreservingContent } from "@/lib/deckGenerator";
import {
  ALL_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  SOURCE_STATUS_LABELS,
  type DeckSlideItem,
  type LayoutArchetype,
  type SlideSourceStatus,
  type SlideType,
} from "@/types/prompt";

const QUICK_LAYOUT_CHIPS: { type: SlideType; short: string }[] = [
  { type: "image-split", short: "图文" },
  { type: "process", short: "流程" },
  { type: "data", short: "数据" },
  { type: "comparison", short: "对比" },
  { type: "timeline", short: "时间轴" },
  { type: "swot", short: "SWOT" },
];

interface SlidePropertyInspectorProps {
  currentSlide: DeckSlideItem;
  safeIndex: number;
  title: string;
  subtitle: string;
  audience: string;
  scenario: string;
  archetype: LayoutArchetype;
  generatingImg: boolean;
  imgModelName: string;
  imgPromptCopied: boolean;
  byokReady: boolean;
  onChangeImgModelName: (val: string) => void;
  onOpenByokSettings: () => void;
  onUploadSlideImage: (file: File) => void;
  onCopySlideImagePrompt: () => void;
  onGenerateAiSlideImage: () => void;
  onUpdateSlide: (patch: Partial<DeckSlideItem>, groupText?: boolean) => void;
}

export default function SlidePropertyInspector({
  currentSlide,
  safeIndex,
  title,
  subtitle,
  audience,
  scenario,
  archetype,
  generatingImg,
  imgModelName,
  imgPromptCopied,
  byokReady,
  onChangeImgModelName,
  onOpenByokSettings,
  onUploadSlideImage,
  onCopySlideImagePrompt,
  onGenerateAiSlideImage,
  onUpdateSlide,
}: SlidePropertyInspectorProps) {
  const applyLayoutOnly = (nextType: SlideType) => {
    const remapped = remapSlideLayoutPreservingContent(currentSlide, nextType, {
      index: safeIndex,
      topic: title,
      subtitle,
      audience,
      scenario,
      archetype,
    });
    onUpdateSlide(remapped, false);
  };

  return (
  <aside className="pg-gen-inspector">
    <div className="pg-panel-head" style={{ marginBottom: 0 }}>
      <h2>本页编辑</h2>
      <span className="pg-inspector-layout-hint" title="切换版式时自动保留当前标题、要点与备注原文">
        仅换版式不动字
      </span>
    </div>

    <div className="pg-form pg-form-compact">
      <div className="pg-field">
        <label htmlFor="pg-slide-type-select">版式（12 种）</label>
        <select
          id="pg-slide-type-select"
          className="pg-select pg-select-full"
          value={currentSlide.slideType}
          onChange={(e) => applyLayoutOnly(e.target.value as SlideType)}
        >
          {ALL_SLIDE_TYPES.map((st) => (
            <option key={st} value={st}>
              {SLIDE_TYPE_LABELS[st].label} ({SLIDE_TYPE_LABELS[st].en})
            </option>
          ))}
        </select>

        {/* Tosea-style 1-click Layout Only quick chips */}
        <div
          className="pg-layout-only-chips"
          role="group"
          aria-label="仅换版式不动字快捷切换"
        >
          {QUICK_LAYOUT_CHIPS.map((chip) => (
            <button
              key={chip.type}
              type="button"
              data-layout-chip={chip.type}
              className={`pg-mini-pill ${
                currentSlide.slideType === chip.type ? "is-active" : ""
              }`}
              onClick={() => applyLayoutOnly(chip.type)}
            >
              {chip.short}
            </button>
          ))}
        </div>
      </div>

      <div className="pg-field">
        <label htmlFor="pg-edit-section-tag">眉标</label>
        <input
          id="pg-edit-section-tag"
          type="text"
          value={currentSlide.sectionTag || ""}
          onChange={(e) =>
            onUpdateSlide({ sectionTag: e.target.value })
          }
        />
      </div>

      <div className="pg-field">
        <label htmlFor="pg-edit-slide-title">主标题</label>
        <input
          id="pg-edit-slide-title"
          type="text"
          value={currentSlide.title || ""}
          onChange={(e) =>
            onUpdateSlide({ title: e.target.value })
          }
        />
      </div>

      {/* Compact Evidence Source Status (via-ppt-rescue-maker / Tosea evidence-first) */}
      <div className="pg-form-2col">
        <div className="pg-field">
          <label htmlFor="pg-edit-source-status">来源状态</label>
          <select
            id="pg-edit-source-status"
            className="pg-select pg-select-full"
            value={currentSlide.sourceStatus || ""}
            onChange={(e) =>
              onUpdateSlide(
                {
                  sourceStatus: (e.target.value || undefined) as
                    | SlideSourceStatus
                    | undefined,
                },
                false
              )
            }
          >
            <option value="">自动（未标注）</option>
            {(Object.keys(SOURCE_STATUS_LABELS) as SlideSourceStatus[]).map(
              (st) => (
                <option key={st} value={st}>
                  {SOURCE_STATUS_LABELS[st].label}
                </option>
              )
            )}
          </select>
        </div>
        <div className="pg-field">
          <label htmlFor="pg-edit-source-note">脚注来源（可选）</label>
          <input
            id="pg-edit-source-note"
            type="text"
            placeholder="如：年报 P14 / 实测"
            value={currentSlide.sourceNote || ""}
            onChange={(e) =>
              onUpdateSlide({ sourceNote: e.target.value })
            }
          />
        </div>
      </div>

      {(currentSlide.slideType === "cover" ||
        currentSlide.slideType === "process" ||
        currentSlide.slideType === "image-split" ||
        currentSlide.slideType === "team-grid") && (
        <div className="pg-field">
          <label htmlFor="pg-edit-slide-subtitle">副标题说明</label>
          <textarea
            id="pg-edit-slide-subtitle"
            rows={2}
            value={currentSlide.subtitle || ""}
            onChange={(e) =>
              onUpdateSlide({ subtitle: e.target.value })
            }
          />
        </div>
      )}

      {/* 1. IMAGE-SPLIT 3-in-1 Image Manager + Bullets (v3) */}
      {currentSlide.slideType === "image-split" && (
        <>
          <ImageSlotManager
            currentSlide={currentSlide}
            archetype={archetype}
            generatingImg={generatingImg}
            imgModelName={imgModelName}
            imgPromptCopied={imgPromptCopied}
            byokReady={byokReady}
            onChangeImgModelName={onChangeImgModelName}
            onOpenByokSettings={onOpenByokSettings}
            onUploadSlideImage={onUploadSlideImage}
            onCopySlideImagePrompt={onCopySlideImagePrompt}
            onGenerateAiSlideImage={onGenerateAiSlideImage}
            onUpdateSlide={onUpdateSlide}
          />

          <div className="pg-gen-subcard">
            <span className="pg-gen-subcard-title">
              分栏核心要点（每行 1 条，最多 4 条）
            </span>
            <textarea
              rows={4}
              value={(currentSlide.bullets || []).join("\n")}
              placeholder="每行输入一条要点..."
              onChange={(e) =>
                onUpdateSlide({
                  bullets: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 4),
                })
              }
            />
          </div>
        </>
      )}

      {/* 2. SWOT 2x2 Matrix Editor (v3) */}
      {currentSlide.slideType === "swot" && (
        <>
          {(
            [
              { key: "strengths", label: "S · 核心优势（每行 1 条）" },
              { key: "weaknesses", label: "W · 短板待补（每行 1 条）" },
              { key: "opportunities", label: "O · 外部机遇（每行 1 条）" },
              { key: "threats", label: "T · 外部挑战（每行 1 条）" },
            ] as const
          ).map((q) => {
            const curSwot = currentSlide.swot || {
              strengths: [],
              weaknesses: [],
              opportunities: [],
              threats: [],
            };
            return (
              <div key={q.key} className="pg-gen-subcard">
                <span className="pg-gen-subcard-title">{q.label}</span>
                <textarea
                  rows={2}
                  value={(curSwot[q.key] || []).join("\n")}
                  onChange={(e) =>
                    onUpdateSlide({
                      swot: {
                        ...curSwot,
                        [q.key]: e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .slice(0, 4),
                      },
                    })
                  }
                />
              </div>
            );
          })}
        </>
      )}

      {/* 3. FUNNEL / DONUT Chart Mode + Stages Editor (v3) */}
      {currentSlide.slideType === "funnel-donut" && (
        <>
          <div className="pg-field">
            <label>可视化图表形态切换</label>
            <div className="pg-segmented">
              <button
                type="button"
                id="pg-chartmode-funnel"
                className={`pg-seg-btn ${
                  (currentSlide.chartMode || "funnel") === "funnel"
                    ? "is-active"
                    : ""
                }`}
                onClick={() =>
                  onUpdateSlide({ chartMode: "funnel" }, false)
                }
              >
                转化漏斗图
              </button>
              <button
                type="button"
                id="pg-chartmode-donut"
                className={`pg-seg-btn ${
                  currentSlide.chartMode === "donut" ? "is-active" : ""
                }`}
                onClick={() =>
                  onUpdateSlide({ chartMode: "donut" }, false)
                }
              >
                环形占比饼图
              </button>
            </div>
          </div>

          {(currentSlide.funnelStages || []).map((st, sIdx) => (
            <div key={`fn-ed-${sIdx}`} className="pg-gen-subcard">
              <div className="pg-gen-subcard-head">
                <span className="pg-gen-subcard-title">
                  层级 0{sIdx + 1}
                </span>
                {(currentSlide.funnelStages?.length || 0) > 2 && (
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    aria-label="删除层级"
                    onClick={() =>
                      onUpdateSlide(
                        {
                          funnelStages: (
                            currentSlide.funnelStages || []
                          ).filter((_, i) => i !== sIdx),
                        },
                        false
                      )
                    }
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={st.label}
                placeholder="阶段名称"
                onChange={(e) => {
                  const next = [...(currentSlide.funnelStages || [])];
                  next[sIdx] = { ...next[sIdx], label: e.target.value };
                  onUpdateSlide({ funnelStages: next });
                }}
              />
              <div className="pg-form-2col">
                <input
                  type="text"
                  value={String(st.value)}
                  placeholder="数值"
                  onChange={(e) => {
                    const next = [...(currentSlide.funnelStages || [])];
                    next[sIdx] = {
                      ...next[sIdx],
                      value: Math.max(0, Number(e.target.value) || 0),
                    };
                    onUpdateSlide({ funnelStages: next });
                  }}
                />
                <input
                  type="text"
                  value={st.unit || ""}
                  placeholder="单位（%/人/万）"
                  onChange={(e) => {
                    const next = [...(currentSlide.funnelStages || [])];
                    next[sIdx] = { ...next[sIdx], unit: e.target.value };
                    onUpdateSlide({ funnelStages: next });
                  }}
                />
              </div>
              <input
                type="text"
                value={st.note || ""}
                placeholder="转化率或结构说明"
                onChange={(e) => {
                  const next = [...(currentSlide.funnelStages || [])];
                  next[sIdx] = { ...next[sIdx], note: e.target.value };
                  onUpdateSlide({ funnelStages: next });
                }}
              />
            </div>
          ))}
          {(currentSlide.funnelStages?.length || 0) < 6 && (
            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-xs"
              onClick={() =>
                onUpdateSlide(
                  {
                    funnelStages: [
                      ...(currentSlide.funnelStages || []),
                      {
                        label: "新增阶段",
                        value: 500,
                        unit:
                          currentSlide.chartMode === "donut" ? "%" : "人",
                        note: "补充阶段转化说明",
                      },
                    ],
                  },
                  false
                )
              }
            >
              <Plus size={12} />
              <span>添加数据层级</span>
            </button>
          )}
        </>
      )}

      {/* 4. TEAM-GRID Editor (v3) */}
      {currentSlide.slideType === "team-grid" && (
        <>
          {(currentSlide.teamMembers || []).map((m, mIdx) => (
            <div key={`tm-ed-${mIdx}`} className="pg-gen-subcard">
              <div className="pg-gen-subcard-head">
                <span className="pg-gen-subcard-title">
                  成员 0{mIdx + 1}
                </span>
                {(currentSlide.teamMembers?.length || 0) > 2 && (
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    aria-label="删除成员"
                    onClick={() =>
                      onUpdateSlide(
                        {
                          teamMembers: (
                            currentSlide.teamMembers || []
                          ).filter((_, i) => i !== mIdx),
                        },
                        false
                      )
                    }
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <div className="pg-form-2col">
                <input
                  type="text"
                  value={m.name}
                  placeholder="姓名"
                  onChange={(e) => {
                    const next = [...(currentSlide.teamMembers || [])];
                    next[mIdx] = { ...next[mIdx], name: e.target.value };
                    onUpdateSlide({ teamMembers: next });
                  }}
                />
                <input
                  type="text"
                  value={m.badge || ""}
                  placeholder="标签（如 ARCH）"
                  onChange={(e) => {
                    const next = [...(currentSlide.teamMembers || [])];
                    next[mIdx] = { ...next[mIdx], badge: e.target.value };
                    onUpdateSlide({ teamMembers: next });
                  }}
                />
              </div>
              <input
                type="text"
                value={m.role}
                placeholder="职衔与职责"
                onChange={(e) => {
                  const next = [...(currentSlide.teamMembers || [])];
                  next[mIdx] = { ...next[mIdx], role: e.target.value };
                  onUpdateSlide({ teamMembers: next });
                }}
              />
              <textarea
                rows={2}
                value={m.bio}
                placeholder="核心履历与代表成果"
                onChange={(e) => {
                  const next = [...(currentSlide.teamMembers || [])];
                  next[mIdx] = { ...next[mIdx], bio: e.target.value };
                  onUpdateSlide({ teamMembers: next });
                }}
              />
            </div>
          ))}
          {(currentSlide.teamMembers?.length || 0) < 4 && (
            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-xs"
              onClick={() =>
                onUpdateSlide(
                  {
                    teamMembers: [
                      ...(currentSlide.teamMembers || []),
                      {
                        name: "新成员",
                        role: "核心骨干",
                        bio: "填写专业履历与项目亮点",
                        badge: "CORE",
                      },
                    ],
                  },
                  false
                )
              }
            >
              <Plus size={12} />
              <span>添加团队成员（最多 4 位）</span>
            </button>
          )}
        </>
      )}

      {/* Steps editor for agenda / process / timeline / closing */}
      {(currentSlide.slideType === "agenda" ||
        currentSlide.slideType === "process" ||
        currentSlide.slideType === "timeline" ||
        currentSlide.slideType === "closing") &&
        (currentSlide.steps || []).map((st, sIdx) => (
          <div key={`st-ed-${sIdx}`} className="pg-gen-subcard">
            <span className="pg-gen-subcard-title">
              模块 0{sIdx + 1}
            </span>
            <input
              type="text"
              value={st.title}
              placeholder="模块标题"
              onChange={(e) => {
                const next = [...(currentSlide.steps || [])];
                next[sIdx] = { ...next[sIdx], title: e.target.value };
                onUpdateSlide({ steps: next });
              }}
            />
            <textarea
              rows={2}
              value={st.desc}
              placeholder="精炼描述"
              onChange={(e) => {
                const next = [...(currentSlide.steps || [])];
                next[sIdx] = { ...next[sIdx], desc: e.target.value };
                onUpdateSlide({ steps: next });
              }}
            />
          </div>
        ))}

      {/* Data editor: bars + KPIs */}
      {currentSlide.slideType === "data" && (
        <>
          <div className="pg-gen-subcard">
            <span className="pg-gen-subcard-title">柱状图数据序列</span>
            {(currentSlide.bars || []).map((bar, bIdx) => (
              <div
                key={`bar-ed-${bIdx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "6px",
                }}
              >
                <input
                  type="text"
                  value={bar.label}
                  aria-label={`柱图项 ${bIdx + 1} 标签`}
                  onChange={(e) => {
                    const next = [...(currentSlide.bars || [])];
                    next[bIdx] = { ...next[bIdx], label: e.target.value };
                    onUpdateSlide({ bars: next });
                  }}
                />
                <input
                  type="text"
                  value={String(bar.v1)}
                  aria-label={`柱图项 ${bIdx + 1} 基准值`}
                  onChange={(e) => {
                    const next = [...(currentSlide.bars || [])];
                    next[bIdx] = {
                      ...next[bIdx],
                      v1: Math.max(0, Number(e.target.value) || 0),
                    };
                    onUpdateSlide({ bars: next });
                  }}
                />
                <input
                  type="text"
                  value={String(bar.v2)}
                  aria-label={`柱图项 ${bIdx + 1} 优化值`}
                  onChange={(e) => {
                    const next = [...(currentSlide.bars || [])];
                    next[bIdx] = {
                      ...next[bIdx],
                      v2: Math.max(0, Number(e.target.value) || 0),
                    };
                    onUpdateSlide({ bars: next });
                  }}
                />
              </div>
            ))}
          </div>

          {(currentSlide.kpis || []).map((kpi, kIdx) => (
            <div key={`kpi-ed-${kIdx}`} className="pg-gen-subcard">
              <span className="pg-gen-subcard-title">
                KPI 卡片 0{kIdx + 1}
              </span>
              <div className="pg-form-2col">
                <input
                  type="text"
                  value={kpi.label}
                  placeholder="指标名"
                  onChange={(e) => {
                    const next = [...(currentSlide.kpis || [])];
                    next[kIdx] = { ...next[kIdx], label: e.target.value };
                    onUpdateSlide({ kpis: next });
                  }}
                />
                <input
                  type="text"
                  value={kpi.value}
                  placeholder="核心数字"
                  onChange={(e) => {
                    const next = [...(currentSlide.kpis || [])];
                    next[kIdx] = { ...next[kIdx], value: e.target.value };
                    onUpdateSlide({ kpis: next });
                  }}
                />
              </div>
              <input
                type="text"
                value={kpi.note}
                placeholder="指标注释"
                onChange={(e) => {
                  const next = [...(currentSlide.kpis || [])];
                  next[kIdx] = { ...next[kIdx], note: e.target.value };
                  onUpdateSlide({ kpis: next });
                }}
              />
            </div>
          ))}
        </>
      )}

      {/* Comparison editor */}
      {currentSlide.slideType === "comparison" && (
        <>
          <div className="pg-gen-subcard">
            <span className="pg-gen-subcard-title">左栏 · 现状方案</span>
            <input
              type="text"
              value={currentSlide.leftTitle || ""}
              onChange={(e) =>
                onUpdateSlide({ leftTitle: e.target.value })
              }
            />
            <textarea
              rows={3}
              value={(currentSlide.leftPoints || []).join("\n")}
              placeholder="每行一条要点"
              onChange={(e) =>
                onUpdateSlide({
                  leftPoints: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className="pg-gen-subcard">
            <span className="pg-gen-subcard-title">右栏 · 推荐方案</span>
            <input
              type="text"
              value={currentSlide.rightTitle || ""}
              onChange={(e) =>
                onUpdateSlide({ rightTitle: e.target.value })
              }
            />
            <textarea
              rows={3}
              value={(currentSlide.rightPoints || []).join("\n")}
              placeholder="每行一条要点"
              onChange={(e) =>
                onUpdateSlide({
                  rightPoints: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </>
      )}

      {/* Quote editor */}
      {currentSlide.slideType === "quote" && (
        <>
          <div className="pg-field">
            <label htmlFor="pg-edit-quote-text">焦点洞察金句</label>
            <textarea
              id="pg-edit-quote-text"
              rows={3}
              value={currentSlide.quoteText || ""}
              onChange={(e) =>
                onUpdateSlide({ quoteText: e.target.value })
              }
            />
          </div>
          <div className="pg-field">
            <label htmlFor="pg-edit-quote-author">来源署名</label>
            <input
              id="pg-edit-quote-author"
              type="text"
              value={currentSlide.quoteAuthor || ""}
              onChange={(e) =>
                onUpdateSlide({ quoteAuthor: e.target.value })
              }
            />
          </div>
        </>
      )}
    </div>
  </aside>
  );
}
