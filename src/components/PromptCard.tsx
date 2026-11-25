"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Columns2,
  Copy,
  GitFork,
  Heart,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { compilePrompt } from "@/lib/promptCompiler";
import {
  ALL_SLIDE_TYPES,
  CARD_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  TOOL_METADATA,
  type PromptItem,
  type SlideType,
} from "@/types/prompt";

interface PromptCardProps {
  prompt: PromptItem;
  liveTopic?: string;
  onUpdatePrompt?: (updated: PromptItem) => void;
  onDeletePrompt?: (id: string) => void;
  showDelete?: boolean;
  showEdit?: boolean;
}

export default function PromptCard({
  prompt,
  liveTopic,
  onUpdatePrompt,
  onDeletePrompt,
  showDelete = false,
  showEdit = false,
}: PromptCardProps) {
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

  const isCompared = compareIds.includes(prompt.id);
  const isFavorited = user
    ? Boolean(prompt.favoritedByMe)
    : localFavoriteIds.includes(prompt.id);
  const effectiveTopic = liveTopic?.trim() || prompt.sampleTopic;
  const isOwner = Boolean(user && user.id === prompt.authorId);

  const generateHref = liveTopic?.trim()
    ? `/generate?style=${encodeURIComponent(prompt.slug)}&topic=${encodeURIComponent(
        liveTopic.trim()
      )}`
    : `/generate?style=${encodeURIComponent(prompt.slug)}`;

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

  const handleQuickCopy = async () => {
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
      slideType
    );

    try {
      await navigator.clipboard.writeText(text);
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
    } catch {
      showToast("复制失败，请进入工作室手动复制", "error");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确认删除自己发布的模板「${prompt.title}」吗？`)) {
      return;
    }
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("已删除该模板");
      onDeletePrompt?.(prompt.id);
    } else {
      const data = await res.json();
      showToast(data.error || "删除失败", "error");
    }
  };

  return (
    <article
      className="pg-card pg-card--minimal"
      data-prompt-slug={prompt.slug}
      title={prompt.summary}
    >
      {/* Interactive 16:9 Artboard Preview (~78% visual focus) */}
      <div className="pg-card-stage-wrap">
        <Link
          href={`/studio/${prompt.slug}`}
          className="pg-card-canvas-link"
          aria-label={`进入 ${prompt.title} 提示词工作室`}
        >
          <div className="pg-canvas-motion-slot" key={slideType}>
            <SlideCanvas
              spec={prompt.visualSpec}
              slideType={slideType}
              topic={effectiveTopic}
              subtitle={prompt.sampleSubtitle}
              englishTitle={prompt.englishTitle}
              scenario={prompt.scenario}
            />
          </div>
        </Link>

        {/* Whisper-quiet 5-page micro switcher + 7 more commercial slide types */}
        <div className="pg-card-slide-bar">
          <div
            className="pg-card-slide-tabs"
            role="tablist"
            aria-label="切换预览页型"
          >
            {CARD_SLIDE_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={slideType === st}
                className={`pg-slide-tab ${slideType === st ? "is-active" : ""}`}
                onClick={() => setSlideType(st)}
              >
                {SLIDE_TYPE_LABELS[st].label.replace(/页$/, "")}
              </button>
            ))}
          </div>

          <select
            className={`pg-slide-more-select ${
              !CARD_SLIDE_TYPES.includes(slideType) ? "is-active" : ""
            }`}
            aria-label="更多页型"
            value={CARD_SLIDE_TYPES.includes(slideType) ? "" : slideType}
            onChange={(e) => {
              const val = e.target.value as SlideType | "";
              if (val) setSlideType(val);
            }}
          >
            <option value="" disabled>
              更多 ▾
            </option>
            {ALL_SLIDE_TYPES.filter((st) => !CARD_SLIDE_TYPES.includes(st)).map(
              (st) => (
                <option key={st} value={st}>
                  {SLIDE_TYPE_LABELS[st].label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Minimal 2-Line Gallery Footer (Pitch / Framer Style) */}
      <div className="pg-card-body">
        <div className="pg-card-head">
          <Link href={`/studio/${prompt.slug}`} className="pg-card-title">
            {prompt.title}
          </Link>

          <div className="pg-swatches" title="配色系统色板">
            {[
              prompt.visualSpec.palette.bg,
              prompt.visualSpec.palette.text,
              prompt.visualSpec.palette.accent,
              prompt.visualSpec.palette.chartColors[1],
            ].map((hex, i) => (
              <span
                key={`${hex}-${i}`}
                className="pg-swatch"
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>

        <div className="pg-card-footer">
          <div className="pg-card-meta-row">
            {!prompt.isPublic && (
              <span className="pg-tag pg-tag-private" title="仅作者本人可见">
                <Lock size={10} />
                <span>私有</span>
              </span>
            )}
            <span className="pg-tag pg-tag-scenario">{prompt.scenario}</span>
            {prompt.remixedFrom && (
              <span
                className="pg-tag pg-tag-remix"
                title={`改编自 ${prompt.remixedFrom.title}`}
              >
                <GitFork size={10} />
              </span>
            )}
            <Link
              href={`/creator/${prompt.author.username}`}
              className="pg-meta-author pg-meta-author-link"
              title={
                prompt.isOfficial
                  ? `官方 · ${prompt.author.displayName}`
                  : prompt.author.displayName
              }
            >
              {prompt.author.displayName}
            </Link>
          </div>

          <div className="pg-card-actions-compact">
            <button
              type="button"
              className={`pg-stat-btn ${prompt.likedByMe ? "is-liked" : ""}`}
              onClick={handleLike}
              title="点赞"
              aria-label="点赞"
            >
              <Heart
                size={13}
                fill={prompt.likedByMe ? "currentColor" : "none"}
              />
              <span>{prompt.likesCount}</span>
            </button>

            <button
              type="button"
              className={`pg-stat-btn pg-stat-btn--icon ${
                isFavorited ? "is-saved" : ""
              }`}
              onClick={handleFavorite}
              title={isFavorited ? "取消收藏" : "收藏"}
              aria-label={isFavorited ? "取消收藏" : "收藏"}
            >
              <Bookmark
                size={13}
                fill={isFavorited ? "currentColor" : "none"}
              />
            </button>

            <button
              type="button"
              className={`pg-stat-btn pg-stat-btn--icon ${
                isCompared ? "is-compared" : ""
              }`}
              onClick={() => toggleCompare(prompt.id, prompt.title)}
              title={isCompared ? "移出风格对比" : "加入风格并排对比"}
              aria-label={isCompared ? "已对比" : "对比"}
            >
              <Columns2 size={13} />
            </button>

            <button
              type="button"
              className="pg-stat-btn pg-stat-btn--icon"
              onClick={handleQuickCopy}
              title="直接复制推荐工具提示词"
              aria-label="复制提示词"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>

            <Link
              href={generateHref}
              className="pg-stat-btn pg-stat-btn--icon"
              title="用此风格在线生成整套 PPT"
              aria-label="生成 PPT"
            >
              <Sparkles size={13} />
            </Link>

            {showEdit && isOwner && (
              <Link
                href={`/create?edit=${encodeURIComponent(prompt.slug)}`}
                className="pg-stat-btn pg-stat-btn--icon"
                title="编辑此模板"
                aria-label="编辑模板"
              >
                <Pencil size={13} />
              </Link>
            )}

            {showDelete && isOwner && (
              <button
                type="button"
                className="pg-stat-btn pg-stat-btn--icon pg-stat-btn-danger"
                onClick={handleDelete}
                title="删除此模板"
                aria-label="删除模板"
              >
                <Trash2 size={13} />
              </button>
            )}

            <Link
              href={`/studio/${prompt.slug}`}
              className="pg-btn pg-btn-ink pg-btn-xs pg-card-open-btn"
              title="进入提示词工作室定制"
            >
              <span>定制</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
