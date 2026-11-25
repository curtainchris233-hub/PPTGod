"use client";

import Link from "next/link";
import { ArrowRight, Columns3, Palette } from "lucide-react";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import type { PromptItem } from "@/types/prompt";

export interface ComparePick {
  key: string;
  index: string;
  label: string;
  fit: string;
  tone: "blue" | "green" | "violet";
  style: PromptItem;
}

const SAMPLE_TOPIC = "智能时代的工作效率升级";
const SAMPLE_SUBTITLE = "用 AI 重塑团队生产力";

interface StyleComparePanelProps {
  picks: ComparePick[];
  topic: string;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  /** Loads the three picks into the shared compare tray before navigating. */
  onOpenCompare: () => void;
}

export function StyleComparePanel({
  picks,
  topic,
  selectedSlug,
  onSelect,
  onOpenCompare,
}: StyleComparePanelProps) {
  const cleanTopic = topic.trim();
  const isSample = !cleanTopic;

  return (
    <section
      className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-compare"
      aria-labelledby="gl-dash-compare-title"
    >
      <div className="gl-panel-header">
        <div className="gl-panel-title-group">
          <span className="gl-panel-icon" aria-hidden="true">
            <Columns3 size={18} />
          </span>
          <div className="gl-panel-heading-stack">
            <h2 className="gl-panel-title" id="gl-dash-compare-title">
              同一内容 · 不同风格效果对比
            </h2>
            <p className="gl-panel-subtitle">
              {isSample
                ? "用示例主题预览；在上方输入主题后，三张画布同步换成你的内容"
                : `正在用「${cleanTopic}」预览，选中的风格将用于生成`}
            </p>
          </div>
        </div>
        <div className="gl-panel-actions">
          <Link
            href="/compare"
            className="gl-dash-link"
            id="gl-dash-more-compare"
            onClick={onOpenCompare}
          >
            更多对比
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div
        className="gl-dash-compare-grid"
        role="radiogroup"
        aria-label="选择生成使用的风格"
      >
        {picks.map((pick) => {
          const selected = pick.style.slug === selectedSlug;
          return (
            <label
              key={pick.key}
              className={`gl-dash-compare-card ${selected ? "is-selected" : ""}`}
              data-tone={pick.tone}
              data-style-slug={pick.style.slug}
            >
              <input
                type="radio"
                name="gl-dash-compare-style"
                className="gl-sr-only"
                value={pick.style.slug}
                checked={selected}
                onChange={() => onSelect(pick.style.slug)}
              />
              <SlidePreviewFrame
                spec={pick.style.visualSpec}
                slideType="cover"
                topic={cleanTopic || SAMPLE_TOPIC}
                subtitle={cleanTopic ? "" : SAMPLE_SUBTITLE}
                scenario={pick.style.scenario}
                englishTitle={pick.style.englishTitle}
                selected={selected}
                isSample={isSample}
                sampleLabel="示例"
                topLeftBadge={
                  <span className="gl-dash-pick-badge" data-tone={pick.tone}>
                    {pick.index} {pick.label}
                  </span>
                }
                radius="md"
              />
              <span className="gl-dash-compare-meta">
                <span className="gl-dash-radio" aria-hidden="true" />
                <span className="gl-dash-compare-text">
                  <strong>{pick.label}</strong>
                  <span>
                    {pick.style.title.split(" · ")[0]} · {pick.fit}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

interface RecommendedStylesPanelProps {
  styles: PromptItem[];
}

export function RecommendedStylesPanel({ styles }: RecommendedStylesPanelProps) {
  return (
    <section
      className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-recommend"
      aria-labelledby="gl-dash-recommend-title"
    >
      <div className="gl-panel-header">
        <div className="gl-panel-title-group">
          <span className="gl-panel-icon" aria-hidden="true">
            <Palette size={18} />
          </span>
          <h2 className="gl-panel-title" id="gl-dash-recommend-title">
            推荐风格
          </h2>
        </div>
        <div className="gl-panel-actions">
          <Link href="/gallery" className="gl-dash-link" id="gl-dash-more-styles">
            更多风格
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <ul className="gl-dash-recommend-grid">
        {styles.map((style) => (
          <li key={style.id}>
            <Link
              href={`/studio/${style.slug}`}
              className="gl-dash-recommend-item"
              aria-label={`查看风格详情：${style.title}`}
              data-style-slug={style.slug}
            >
              <SlidePreviewFrame
                spec={style.visualSpec}
                slideType="cover"
                topic={style.sampleTopic}
                subtitle={style.sampleSubtitle}
                scenario={style.scenario}
                englishTitle={style.englishTitle}
                radius="sm"
                className="gl-dash-recommend-thumb"
              />
              <span className="gl-dash-recommend-name">
                {style.title.split(" · ")[0]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
