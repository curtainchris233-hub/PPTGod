"use client";

import React, { useState } from "react";
import { Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { VisualSpec } from "@/types/prompt";

const BRAND_ACCENT_SWATCHES = [
  "#C84B31",
  "#1652B8",
  "#0F766E",
  "#1B4D3E",
  "#7C3AED",
  "#B45309",
  "#E11D48",
  "#0284C7",
  "#D97706",
];

interface DeckSpecTweakerProps {
  deckSpec: VisualSpec;
  baseSpec: VisualSpec;
  handoffApplied: boolean;
  onChangeSpec: (next: VisualSpec) => void;
  onResetSpec: () => void;
}

export default function DeckSpecTweaker({
  deckSpec,
  baseSpec,
  handoffApplied,
  onChangeSpec,
  onResetSpec,
}: DeckSpecTweakerProps) {
  const [open, setOpen] = useState(false);

  const isCustomized =
    JSON.stringify(deckSpec) !== JSON.stringify(baseSpec);

  const setAccent = (hex: string) => {
    onChangeSpec({
      ...deckSpec,
      palette: {
        ...deckSpec.palette,
        accent: hex,
        chartColors: [
          hex,
          deckSpec.palette.chartColors[1],
          deckSpec.palette.chartColors[2],
          deckSpec.palette.chartColors[3],
        ],
      },
    });
  };

  return (
    <div className="pg-tweaker-bar">
      <div className="pg-tweaker-bar-head">
        <button
          type="button"
          id="pg-deck-tweaker-toggle"
          className={`pg-btn pg-btn-ghost pg-btn-xs ${open ? "is-open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={13} />
          <span>品牌视觉微调（强调色 / 底色 / 圆角 / 留白）</span>
        </button>

        <div className="pg-tweaker-bar-badges">
          <span
            className="pg-tweaker-chip-dot"
            style={{ background: deckSpec.palette.accent }}
            title={`当前强调色 ${deckSpec.palette.accent}`}
          />
          <code className="pg-tweaker-hex">{deckSpec.palette.accent}</code>
          <span className="pg-tweaker-meta">
            R{deckSpec.layout.cornerRadius}px · {deckSpec.layout.density}
          </span>
          {handoffApplied && (
            <span className="pg-tag pg-tag-scenario" id="pg-handoff-badge">
              已承接工作室定制配色
            </span>
          )}
          {isCustomized && (
            <button
              type="button"
              id="pg-deck-spec-reset-btn"
              className="pg-btn pg-btn-ghost pg-btn-xs"
              onClick={onResetSpec}
              title="恢复当前母版默认色板与版式参数"
            >
              <RotateCcw size={12} />
              <span>恢复默认</span>
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="pg-tweaker-panel" id="pg-deck-tweaker-panel">
          <div className="pg-tweaker-group">
            <label className="pg-tweaker-label" htmlFor="pg-deck-accent-input">
              <Palette size={12} />
              <span>品牌强调色</span>
            </label>
            <div className="pg-tweaker-swatches">
              {BRAND_ACCENT_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`pg-tweaker-swatch ${
                    deckSpec.palette.accent.toLowerCase() === hex.toLowerCase()
                      ? "is-active"
                      : ""
                  }`}
                  style={{ background: hex }}
                  onClick={() => setAccent(hex)}
                  aria-label={`选择品牌强调色 ${hex}`}
                  title={hex}
                />
              ))}
              <input
                id="pg-deck-accent-input"
                type="color"
                className="pg-tweaker-color-picker"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(deckSpec.palette.accent)
                    ? deckSpec.palette.accent
                    : "#C84B31"
                }
                onChange={(e) => setAccent(e.target.value)}
                aria-label="自定义品牌强调色"
              />
            </div>
          </div>

          <div className="pg-tweaker-group">
            <label className="pg-tweaker-label" htmlFor="pg-deck-bg-input">
              <span>画布底色 / 卡片表面</span>
            </label>
            <div className="pg-tweaker-color-pair">
              <label className="pg-tweaker-mini-color">
                <span>底色</span>
                <input
                  id="pg-deck-bg-input"
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(deckSpec.palette.bg)
                      ? deckSpec.palette.bg
                      : "#FFFFFF"
                  }
                  onChange={(e) =>
                    onChangeSpec({
                      ...deckSpec,
                      palette: { ...deckSpec.palette, bg: e.target.value },
                    })
                  }
                />
              </label>
              <label className="pg-tweaker-mini-color">
                <span>卡片</span>
                <input
                  id="pg-deck-surface-input"
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(deckSpec.palette.surface)
                      ? deckSpec.palette.surface
                      : "#F7F7F7"
                  }
                  onChange={(e) =>
                    onChangeSpec({
                      ...deckSpec,
                      palette: { ...deckSpec.palette, surface: e.target.value },
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className="pg-tweaker-group">
            <label className="pg-tweaker-label" htmlFor="pg-deck-radius-slider">
              <span>卡片圆角 ({deckSpec.layout.cornerRadius}px)</span>
            </label>
            <input
              id="pg-deck-radius-slider"
              type="range"
              min={0}
              max={24}
              step={2}
              className="pg-range"
              value={deckSpec.layout.cornerRadius}
              onChange={(e) =>
                onChangeSpec({
                  ...deckSpec,
                  layout: {
                    ...deckSpec.layout,
                    cornerRadius: Number(e.target.value),
                  },
                })
              }
            />
          </div>

          <div className="pg-tweaker-group">
            <span className="pg-tweaker-label">版面留白密度</span>
            <div
              className="pg-segmented"
              style={{
                width: "100%",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >
              {(
                [
                  ["airy", "高留白"],
                  ["balanced", "均衡"],
                  ["dense", "高密度"],
                ] as const
              ).map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  className={`pg-seg-btn ${
                    deckSpec.layout.density === d ? "is-active" : ""
                  }`}
                  onClick={() =>
                    onChangeSpec({
                      ...deckSpec,
                      layout: { ...deckSpec.layout, density: d },
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
