"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Columns2,
  Copy,
  Eye,
  Heart,
  Lock,
  Sparkles,
} from "lucide-react";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { useApp } from "@/context/AppContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { compilePrompt } from "@/lib/promptCompiler";
import { TOOL_METADATA, type PromptItem } from "@/types/prompt";

interface StyleCardProps {
  prompt: PromptItem;
  liveTopic?: string;
  selected?: boolean;
  onSelect?: (slug: string) => void;
  onPreview?: (prompt: PromptItem) => void;
  onUpdatePrompt?: (updated: PromptItem) => void;
}

export default function StyleCard({
  prompt,
  liveTopic,
  selected = false,
  onSelect,
  onPreview,
  onUpdatePrompt,
}: StyleCardProps) {
  const {
    user,
    compareIds,
    toggleCompare,
    localFavoriteIds,
    toggleLocalFavorite,
    showToast,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [favPending, setFavPending] = useState(false);

  const isCompared = compareIds.includes(prompt.id);
  const isFavorited = user
    ? Boolean(prompt.favoritedByMe)
    : localFavoriteIds.includes(prompt.id);
  const effectiveTopic = liveTopic?.trim() || prompt.sampleTopic;

  const generateHref = liveTopic?.trim()
    ? `/generate?style=${encodeURIComponent(prompt.slug)}&topic=${encodeURIComponent(
        liveTopic.trim()
      )}`
    : `/generate?style=${encodeURIComponent(prompt.slug)}`;

  // Display at most 3 distinct concise tags matching the Glacier Gallery card rhythm.
  const displayTags = Array.from(
    new Set([prompt.scenario, prompt.styleCategory, ...prompt.tags].filter(Boolean))
  ).slice(0, 3);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleQuickCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultTool = prompt.recommendedTools[0] ?? "claude-html";
    const text = compilePrompt(
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
      "cover"
    );

    const ok = await copyTextToClipboard(text);
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
      showToast("复制失败，请进入详情抽屉手动复制", "error");
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCompare(prompt.id, prompt.title);
  };

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(prompt.slug);
    onPreview?.(prompt);
  };

  return (
    <article
      className={`pg-card gl-style-card ${selected ? "is-selected" : ""}`}
      data-prompt-slug={prompt.slug}
      data-selected={selected ? "true" : undefined}
      onClick={() => onSelect?.(prompt.slug)}
    >
      <div className="gl-style-card-media">
        <SlidePreviewFrame
          spec={prompt.visualSpec}
          slideType="cover"
          topic={effectiveTopic}
          subtitle={prompt.sampleSubtitle}
          englishTitle={prompt.englishTitle}
          scenario={prompt.scenario}
          radius="md"
          className="gl-style-card-frame"
        />

        {selected && (
          <span className="gl-style-card-check" aria-hidden="true">
            <Check size={14} strokeWidth={2.75} />
          </span>
        )}

        {!prompt.isPublic && (
          <span className="gl-style-card-private" title="仅作者本人可见">
            <Lock size={11} aria-hidden="true" />
            <span>私有</span>
          </span>
        )}

        <div className="gl-style-card-overlay">
          <button
            type="button"
            className="gl-style-overlay-btn gl-style-overlay-btn--light"
            onClick={handleOpenPreview}
          >
            <Eye size={13} aria-hidden="true" />
            <span>预览</span>
          </button>
          <Link
            href={generateHref}
            className="gl-style-overlay-btn gl-style-overlay-btn--primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>使用风格</span>
          </Link>
        </div>
      </div>

      <div className="gl-style-card-body">
        <div className="gl-style-card-head">
          <button
            type="button"
            className="gl-style-card-title"
            onClick={handleOpenPreview}
            title={prompt.title}
          >
            {prompt.title}
          </button>

          <div className="gl-style-card-actions">
            <button
              type="button"
              className={`gl-style-icon-btn ${isCompared ? "is-active" : ""}`}
              onClick={handleCompare}
              aria-label={isCompared ? "移出对比" : "加入对比"}
              title={isCompared ? "移出风格对比" : "加入风格对比"}
            >
              <Columns2 size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`gl-style-icon-btn ${copied ? "is-active" : ""}`}
              onClick={handleQuickCopy}
              aria-label="复制提示词"
              title="快速复制提示词"
            >
              {copied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className={`gl-style-icon-btn gl-style-fav-btn ${
                isFavorited ? "is-favorited" : ""
              }`}
              onClick={handleFavorite}
              aria-label={isFavorited ? "取消收藏" : "收藏"}
              aria-pressed={isFavorited}
              title={isFavorited ? "取消收藏" : "收藏风格"}
            >
              <Heart
                size={15}
                fill={isFavorited ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div className="gl-style-card-tags">
          {displayTags.map((tag) => (
            <span key={tag} className="gl-style-tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
