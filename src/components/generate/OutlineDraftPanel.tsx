"use client";

import React from "react";
import {
  ArrowDown,
  ArrowUp,
  ListOrdered,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  ALL_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  type OutlineDraftItem,
  type SlideType,
} from "@/types/prompt";

let outlineClientSeq = 1;
function nextOutlineId(): string {
  outlineClientSeq += 1;
  return `outline_custom_${outlineClientSeq}`;
}

interface OutlineDraftPanelProps {
  outlineDraft: OutlineDraftItem[];
  generating: boolean;
  onChangeOutline: React.Dispatch<
    React.SetStateAction<OutlineDraftItem[] | null>
  >;
  onClose: () => void;
  onConfirmRender: (draft: OutlineDraftItem[]) => void;
}

export default function OutlineDraftPanel({
  outlineDraft,
  generating,
  onChangeOutline,
  onClose,
  onConfirmRender,
}: OutlineDraftPanelProps) {
  return (
    <div className="pg-outline-panel" id="pg-outline-editor">
      <div className="pg-outline-head">
        <div className="pg-outline-head-title">
          <ListOrdered size={15} style={{ color: "var(--accent)" }} />
          <span>
            第 1 步 · 可控大纲草案（共 {outlineDraft.length}{" "}
            页 · 可逐页修改标题、要点与版式）
          </span>
        </div>
        <button
          type="button"
          className="pg-btn pg-btn-ghost pg-btn-xs"
          onClick={onClose}
        >
          <X size={13} />
          <span>收起大纲</span>
        </button>
      </div>

      <div className="pg-outline-list">
        {outlineDraft.map((item, oIdx) => (
          <div key={item.id} className="pg-outline-row">
            <span className="pg-outline-num">
              P{String(oIdx + 1).padStart(2, "0")}
            </span>
            <select
              aria-label={`第 ${oIdx + 1} 页大纲版式`}
              value={item.slideType}
              onChange={(e) => {
                const nextType = e.target.value as SlideType;
                onChangeOutline((prev) =>
                  prev
                    ? prev.map((it, i) =>
                        i === oIdx ? { ...it, slideType: nextType } : it
                      )
                    : prev
                );
              }}
            >
              {ALL_SLIDE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {SLIDE_TYPE_LABELS[st].label}
                </option>
              ))}
            </select>
            <input
              type="text"
              aria-label={`第 ${oIdx + 1} 页大纲标题`}
              value={item.title}
              placeholder="本页结论标题..."
              onChange={(e) => {
                const val = e.target.value;
                onChangeOutline((prev) =>
                  prev
                    ? prev.map((it, i) =>
                        i === oIdx ? { ...it, title: val } : it
                      )
                    : prev
                );
              }}
            />
            <input
              type="text"
              aria-label={`第 ${oIdx + 1} 页大纲摘要`}
              value={item.summary}
              placeholder="本页核心论据或数据摘要..."
              onChange={(e) => {
                const val = e.target.value;
                onChangeOutline((prev) =>
                  prev
                    ? prev.map((it, i) =>
                        i === oIdx ? { ...it, summary: val } : it
                      )
                    : prev
                );
              }}
            />
            <div className="pg-outline-row-controls">
              <button
                type="button"
                className="pg-gen-mini-icon"
                disabled={oIdx === 0}
                aria-label="上移大纲项"
                onClick={() =>
                  onChangeOutline((prev) => {
                    if (!prev || oIdx === 0) return prev;
                    const next = [...prev];
                    const [m] = next.splice(oIdx, 1);
                    next.splice(oIdx - 1, 0, m);
                    return next;
                  })
                }
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                className="pg-gen-mini-icon"
                disabled={oIdx === outlineDraft.length - 1}
                aria-label="下移大纲项"
                onClick={() =>
                  onChangeOutline((prev) => {
                    if (!prev || oIdx >= prev.length - 1) return prev;
                    const next = [...prev];
                    const [m] = next.splice(oIdx, 1);
                    next.splice(oIdx + 1, 0, m);
                    return next;
                  })
                }
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                className="pg-gen-mini-icon"
                disabled={outlineDraft.length <= 1}
                aria-label="删除大纲项"
                onClick={() =>
                  onChangeOutline((prev) =>
                    prev && prev.length > 1
                      ? prev.filter((_, i) => i !== oIdx)
                      : prev
                  )
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pg-outline-footer">
        <button
          type="button"
          className="pg-btn pg-btn-secondary pg-btn-xs"
          disabled={outlineDraft.length >= 20}
          id="pg-outline-add-btn"
          onClick={() =>
            onChangeOutline((prev) => {
              if (!prev || prev.length >= 20) return prev;
              const nextNum = prev.length + 1;
              return [
                ...prev,
                {
                  id: nextOutlineId(),
                  slideType: "image-split",
                  sectionTag: `${String(nextNum).padStart(2, "0")} / VISUAL`,
                  title: `补充章节 ${nextNum}：关键洞察与方案展示`,
                  summary: "图文分栏展示补充论据、案例或核心产品视图",
                },
              ];
            })
          }
        >
          <Plus size={13} />
          <span>新增大纲页 ({outlineDraft.length}/20)</span>
        </button>

        <button
          type="button"
          className="pg-btn pg-btn-primary pg-btn-sm"
          disabled={generating}
          id="pg-outline-confirm-btn"
          onClick={() => onConfirmRender(outlineDraft)}
        >
          <Sparkles size={14} />
          <span>
            {generating
              ? "正在按大纲渲染全套幻灯片..."
              : `第 2 步：按大纲渲染 ${outlineDraft.length} 页完整幻灯片`}
          </span>
        </button>
      </div>
    </div>
  );
}
