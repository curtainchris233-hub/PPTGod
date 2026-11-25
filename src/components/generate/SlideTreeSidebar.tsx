"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import {
  ALL_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  type DeckSlideItem,
  type SlideType,
  type VisualSpec,
} from "@/types/prompt";

interface SlideTreeSidebarProps {
  slides: DeckSlideItem[];
  safeIndex: number;
  deckSpec: VisualSpec;
  title: string;
  subtitle: string;
  audience: string;
  englishTitle: string;
  scenario: string;
  newSlideType: SlideType;
  onChangeNewSlideType: (t: SlideType) => void;
  onSelectSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onMoveSlide: (idx: number, dir: -1 | 1) => void;
  onDeleteSlide: (idx: number) => void;
  onDropReorder: (fromIdx: number, toIdx: number) => void;
  onAddSlide: () => void;
}

export default function SlideTreeSidebar({
  slides,
  safeIndex,
  deckSpec,
  title,
  subtitle,
  audience,
  englishTitle,
  scenario,
  newSlideType,
  onChangeNewSlideType,
  onSelectSlide,
  onDuplicateSlide,
  onMoveSlide,
  onDeleteSlide,
  onDropReorder,
  onAddSlide,
}: SlideTreeSidebarProps) {
  const [treeView, setTreeView] = useState<"slides" | "outline">("slides");
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <aside
      className="pg-gen-sidebar gl-slide-tree"
      data-slide-tree="true"
      aria-label="幻灯片页面列表"
    >
      <div
        className="gl-slide-tree-tabs"
        role="tablist"
        aria-label="页面导航视图切换"
      >
        <button
          type="button"
          role="tab"
          aria-selected={treeView === "outline"}
          className={`gl-slide-tree-tab ${
            treeView === "outline" ? "is-active" : ""
          }`}
          onClick={() => setTreeView("outline")}
        >
          大纲
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={treeView === "slides"}
          className={`gl-slide-tree-tab ${
            treeView === "slides" ? "is-active" : ""
          }`}
          onClick={() => setTreeView("slides")}
        >
          幻灯片
        </button>
      </div>

      <div className="pg-gen-tree-list gl-slide-tree-list">
        {slides.map((sl, idx) => {
          const isActive = idx === safeIndex;
          return (
            <div
              key={sl.id}
              draggable
              onDragStart={(e) => {
                setDragFromIdx(idx);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIdx !== idx) setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from =
                  dragFromIdx !== null
                    ? dragFromIdx
                    : Number(e.dataTransfer.getData("text/plain"));
                if (Number.isInteger(from)) {
                  onDropReorder(from, idx);
                }
                setDragFromIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDragFromIdx(null);
                setDragOverIdx(null);
              }}
              className={`pg-gen-slide-card gl-slide-tree-item ${
                treeView === "outline" ? "is-outline" : ""
              } ${isActive ? "is-active" : ""} ${
                dragFromIdx === idx ? "is-dragging" : ""
              } ${
                dragOverIdx === idx && dragFromIdx !== idx ? "is-drag-over" : ""
              }`}
              onClick={() => onSelectSlide(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSlide(idx);
                }
              }}
            >
              <div className="pg-gen-slide-card-top">
                <span className="pg-gen-slide-label">
                  <span
                    className={`gl-slide-tree-num ${
                      isActive ? "is-active" : ""
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <GripVertical size={11} className="pg-drag-handle" />
                  <span className="gl-slide-tree-type">
                    {SLIDE_TYPE_LABELS[sl.slideType].label}
                  </span>
                </span>
                <div
                  className="pg-gen-slide-card-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    onClick={() => onDuplicateSlide(idx)}
                    title="复制当前页"
                    aria-label="复制当前页"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    disabled={idx === 0}
                    onClick={() => onMoveSlide(idx, -1)}
                    title="上移页面"
                    aria-label="上移页面"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    disabled={idx === slides.length - 1}
                    onClick={() => onMoveSlide(idx, 1)}
                    title="下移页面"
                    aria-label="下移页面"
                  >
                    <ArrowDown size={11} />
                  </button>
                  <button
                    type="button"
                    className="pg-gen-mini-icon"
                    disabled={slides.length <= 1}
                    onClick={() => onDeleteSlide(idx)}
                    title="删除此页"
                    aria-label="删除页面"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {treeView === "outline" ? (
                <div className="gl-slide-outline-body">
                  <strong className="gl-slide-outline-title">
                    {sl.title || `第 ${idx + 1} 页`}
                  </strong>
                  {sl.subtitle && (
                    <span className="gl-slide-outline-sub">{sl.subtitle}</span>
                  )}
                </div>
              ) : (
                <>
                  <div className="gl-slide-tree-title" title={sl.title}>
                    {sl.title || `第 ${idx + 1} 页`}
                  </div>
                  <div className="pg-gen-thumb-box" aria-hidden="true">
                    <SlideCanvas
                      spec={deckSpec}
                      slideType={sl.slideType}
                      topic={title}
                      subtitle={subtitle}
                      audience={audience}
                      slideData={sl}
                      pageIndex={idx}
                      totalPages={slides.length}
                      englishTitle={englishTitle}
                      scenario={scenario}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="pg-gen-add-row gl-slide-tree-footer">
        <select
          className="gl-ed-select"
          value={newSlideType}
          onChange={(e) => onChangeNewSlideType(e.target.value as SlideType)}
          aria-label="新增幻灯片页型"
        >
          {ALL_SLIDE_TYPES.map((st) => (
            <option key={st} value={st}>
              {SLIDE_TYPE_LABELS[st].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="gl-btn gl-btn--secondary gl-btn--sm gl-slide-add-btn"
          onClick={onAddSlide}
          id="pg-gen-add-slide-btn"
        >
          <Plus size={14} aria-hidden="true" />
          <span>新建幻灯片</span>
        </button>
      </div>
    </aside>
  );
}
