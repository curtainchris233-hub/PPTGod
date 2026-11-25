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
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <aside className="pg-gen-sidebar">
      <div className="pg-panel-head" style={{ marginBottom: "4px" }}>
        <h2>页面胶片（{slides.length} 页 · 可拖拽排序）</h2>
      </div>

      <div className="pg-gen-tree-list">
        {slides.map((sl, idx) => (
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
            className={`pg-gen-slide-card ${
              idx === safeIndex ? "is-active" : ""
            } ${dragFromIdx === idx ? "is-dragging" : ""} ${
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
                <GripVertical size={12} className="pg-drag-handle" />
                <span>
                  P{String(idx + 1).padStart(2, "0")} ·{" "}
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
                  title="复制此页"
                  aria-label="复制页面"
                >
                  <Copy size={11} />
                </button>
                <button
                  type="button"
                  className="pg-gen-mini-icon"
                  disabled={idx === 0}
                  onClick={() => onMoveSlide(idx, -1)}
                  title="上移"
                  aria-label="上移页面"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  className="pg-gen-mini-icon"
                  disabled={idx === slides.length - 1}
                  onClick={() => onMoveSlide(idx, 1)}
                  title="下移"
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
          </div>
        ))}
      </div>

      <div className="pg-gen-add-row">
        <select
          className="pg-select"
          style={{ flex: 1, minWidth: 0 }}
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
          className="pg-btn pg-btn-ink pg-btn-xs"
          onClick={onAddSlide}
          id="pg-gen-add-slide-btn"
        >
          <Plus size={13} />
          <span>新增页面</span>
        </button>
      </div>
    </aside>
  );
}
