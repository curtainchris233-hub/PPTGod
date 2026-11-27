"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ClipboardList,
  Columns2,
  Copy,
  Heart,
  Sparkles,
  ThumbsUp,
  Wand2,
} from "lucide-react";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { Button, Drawer } from "@/components/ui";
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

const DENSITY_LABELS: Record<"airy" | "balanced" | "dense", string> = {
  airy: "高留白呼吸感",
  balanced: "均衡结构",
  dense: "高信息密度",
};

interface StyleDetailDrawerProps {
  prompt: PromptItem | null;
  liveTopic: string;
  onLiveTopicChange: (topic: string) => void;
  onClose: () => void;
  onUpdatePrompt?: (updated: PromptItem) => void;
}

export default function StyleDetailDrawer({
  prompt,
  liveTopic,
  onLiveTopicChange,
  onClose,
  onUpdatePrompt,
}: StyleDetailDrawerProps) {
  const {
    user,
    openAuthModal,
    compareIds,
    toggleCompare,
    localFavoriteIds,
    toggleLocalFavorite,
    showToast,
  } = useApp();

  const [slideType, setSlideType] = useState<SlideType>("cover");
  const [copied, setCopied] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [favPending, setFavPending] = useState(false);

  if (!prompt) {
    return (
      <Drawer open={false} onClose={onClose} title="" side="right" size="lg">
        {null}
      </Drawer>
    );
  }

  const isCompared = compareIds.includes(prompt.id);
  const isFavorited = user
    ? Boolean(prompt.favoritedByMe)
    : localFavoriteIds.includes(prompt.id);
  const effectiveTopic = liveTopic.trim() || prompt.sampleTopic;
  const generateHref = liveTopic.trim()
    ? `/generate?style=${encodeURIComponent(prompt.slug)}&topic=${encodeURIComponent(
        liveTopic.trim()
      )}`
    : `/generate?style=${encodeURIComponent(prompt.slug)}`;

  const paletteSwatches = [
    { label: "画布底色", hex: prompt.visualSpec.palette.bg },
    { label: "主文字", hex: prompt.visualSpec.palette.text },
    { label: "主题强调", hex: prompt.visualSpec.palette.accent },
    { label: "卡片表面", hex: prompt.visualSpec.palette.surface },
    ...prompt.visualSpec.palette.chartColors.slice(1, 3).map((hex, i) => ({
      label: `图表色 ${i + 2}`,
      hex,
    })),
  ];

  const handleCopyHex = async (hex: string) => {
    const ok = await copyTextToClipboard(hex);
    showToast(
      ok ? `已复制色值 ${hex.toUpperCase()}` : `色值：${hex.toUpperCase()}`,
      ok ? "success" : "default"
    );
  };

  const handleCopyPrompt = async () => {
    const defaultTool = prompt.recommendedTools[0] ?? "claude-html";
    const compiled = compilePrompt(
      prompt,
      prompt.visualSpec,
      {
        topic: effectiveTopic,
        subtitle: prompt.sampleSubtitle,
        audience: "核心决策团队",
        slideCount: 12,
        language: "zh",
        tone: "executive",
        targetTool: defaultTool,
      },
      slideType
    );
    const ok = await copyTextToClipboard(compiled);
    if (ok) {
      setCopied(true);
      showToast(
        `已复制「${prompt.title}」的 ${TOOL_METADATA[defaultTool].shortName} 提示词`,
        "success"
      );
      window.setTimeout(() => setCopied(false), 1800);

      fetch(`/api/prompts/${prompt.id}/copy`, { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.copiesCount === "number") {
            onUpdatePrompt?.({ ...prompt, copiesCount: data.copiesCount });
          }
        })
        .catch(() => {});
    } else {
      showToast("复制失败，请前往提示词工作室复制", "error");
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      const added = toggleLocalFavorite(prompt.id);
      showToast(
        added ? "已暂存到本地收藏夹（登录可云端同步）" : "已从本地收藏移除",
        added ? "success" : "default"
      );
      return;
    }
    if (favPending) return;
    setFavPending(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/favorite`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        onUpdatePrompt?.({
          ...prompt,
          favoritedByMe: data.favorited,
          savesCount: data.savesCount,
        });
        showToast(
          data.favorited ? "已收藏至云端收藏夹" : "已取消收藏",
          data.favorited ? "success" : "default"
        );
      }
    } finally {
      setFavPending(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      showToast("请先登录后点赞支持创作者");
      openAuthModal("login");
      return;
    }
    if (likePending) return;
    setLikePending(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        onUpdatePrompt?.({
          ...prompt,
          likedByMe: data.liked,
          likesCount: data.likesCount,
        });
      }
    } finally {
      setLikePending(false);
    }
  };

  return (
    <Drawer
      open={Boolean(prompt)}
      onClose={onClose}
      side="right"
      size="lg"
      id="gl-style-detail-drawer"
      title={prompt.title}
      description={`${prompt.scenario} · ${prompt.styleCategory} · ${prompt.englishTitle}`}
      footer={
        <div className="gl-sdrawer-footer">
          <div className="gl-sdrawer-footer-secondary">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Columns2 size={14} />}
              onClick={() => toggleCompare(prompt.id, prompt.title)}
            >
              {isCompared ? "已加入对比" : "加入对比"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyPrompt}
            >
              {copied ? "已复制" : "复制提示词"}
            </Button>
            <Link
              href={`/studio/${prompt.slug}`}
              className="gl-btn gl-btn--ghost gl-btn--sm"
              onClick={onClose}
            >
              <span>提示词工作室</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="gl-sdrawer-footer-secondary">
            <Link
              href={`/pack?style=${encodeURIComponent(prompt.slug)}`}
              id="gl-sdrawer-to-pack-btn"
              className="gl-btn gl-btn--secondary gl-btn--md"
              onClick={onClose}
            >
              <ClipboardList size={15} aria-hidden="true" />
              <span>以此风格做提示词包</span>
            </Link>
            <Link
              href={generateHref}
              className="gl-btn gl-btn--primary gl-btn--md"
              onClick={onClose}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>使用此风格</span>
            </Link>
          </div>
        </div>
      }
    >
      <div className="gl-sdrawer-content">
        {/* Live 16:9 Slide Preview */}
        <div className="gl-sdrawer-stage">
          <SlidePreviewFrame
            spec={prompt.visualSpec}
            slideType={slideType}
            topic={effectiveTopic}
            subtitle={prompt.sampleSubtitle}
            englishTitle={prompt.englishTitle}
            scenario={prompt.scenario}
            radius="md"
          />

          <div
            className="gl-sdrawer-slide-tabs"
            role="tablist"
            aria-label="切换预览页型"
          >
            {ALL_SLIDE_TYPES.map((st) => {
              const active = slideType === st;
              return (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`gl-sdrawer-slide-tab ${active ? "is-active" : ""}`}
                  onClick={() => setSlideType(st)}
                >
                  {SLIDE_TYPE_LABELS[st].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live topic sync input */}
        <div className="gl-sdrawer-topic-row">
          <Wand2 size={14} aria-hidden="true" className="gl-sdrawer-topic-icon" />
          <input
            type="text"
            className="gl-sdrawer-topic-input"
            aria-label="输入主题实时预览该风格"
            placeholder="输入你的演示主题，实时预览该风格效果…"
            value={liveTopic}
            onChange={(e) => onLiveTopicChange(e.target.value)}
          />
          {liveTopic && (
            <button
              type="button"
              className="gl-sdrawer-topic-clear"
              onClick={() => onLiveTopicChange("")}
            >
              清空
            </button>
          )}
        </div>

        {/* Summary & Social row */}
        <div className="gl-sdrawer-summary-card">
          <p className="gl-sdrawer-summary">{prompt.summary}</p>
          <div className="gl-sdrawer-social">
            <Link
              href={`/creator/${prompt.author.username}`}
              className="gl-sdrawer-author"
              onClick={onClose}
            >
              创作者：{prompt.author.displayName}
            </Link>
            <div className="gl-sdrawer-social-btns">
              <button
                type="button"
                className={`gl-sdrawer-chip-btn ${prompt.likedByMe ? "is-active" : ""}`}
                onClick={handleLike}
              >
                <ThumbsUp size={13} aria-hidden="true" />
                <span>点赞 {prompt.likesCount}</span>
              </button>
              <button
                type="button"
                className={`gl-sdrawer-chip-btn ${isFavorited ? "is-favorited" : ""}`}
                onClick={handleFavorite}
              >
                <Heart
                  size={13}
                  fill={isFavorited ? "currentColor" : "none"}
                  aria-hidden="true"
                />
                <span>{isFavorited ? "已收藏" : "收藏"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Palette hex swatches */}
        <section className="gl-sdrawer-section">
          <h3 className="gl-sdrawer-section-title">配色方案</h3>
          <div className="gl-sdrawer-swatches">
            {paletteSwatches.map((sw, idx) => (
              <button
                key={`${sw.label}-${idx}`}
                type="button"
                className="gl-sdrawer-swatch"
                onClick={() => handleCopyHex(sw.hex)}
                title={`点击复制 ${sw.hex.toUpperCase()}`}
              >
                <span
                  className="gl-sdrawer-swatch-color"
                  style={{ background: sw.hex }}
                />
                <span className="gl-sdrawer-swatch-meta">
                  <strong>{sw.label}</strong>
                  <code>{sw.hex.toUpperCase()}</code>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Typography & Layout specs */}
        <section className="gl-sdrawer-section">
          <h3 className="gl-sdrawer-section-title">字体与版式规范</h3>
          <dl className="gl-sdrawer-spec-grid">
            <div className="gl-sdrawer-spec-item">
              <dt>标题字体</dt>
              <dd>{prompt.visualSpec.typography.headingFontLabel}</dd>
            </div>
            <div className="gl-sdrawer-spec-item">
              <dt>正文字体</dt>
              <dd>{prompt.visualSpec.typography.bodyFontLabel}</dd>
            </div>
            <div className="gl-sdrawer-spec-item">
              <dt>信息密度 & 圆角</dt>
              <dd>
                {DENSITY_LABELS[prompt.visualSpec.layout.density]} ·{" "}
                {prompt.visualSpec.layout.cornerRadius}px
              </dd>
            </div>
            <div className="gl-sdrawer-spec-item">
              <dt>适用场景</dt>
              <dd>
                {prompt.scenario} · {prompt.styleCategory}
              </dd>
            </div>
          </dl>
        </section>

        {/* Recommended AI Tools */}
        {prompt.recommendedTools.length > 0 && (
          <section className="gl-sdrawer-section">
            <h3 className="gl-sdrawer-section-title">推荐适配工具</h3>
            <div className="gl-sdrawer-tool-pills">
              {prompt.recommendedTools.map((t) => (
                <span key={t} className="gl-style-tag">
                  {TOOL_METADATA[t]?.shortName ?? t}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
