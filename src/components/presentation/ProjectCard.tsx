"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  Type,
} from "lucide-react";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import type { SavedDeck } from "@/types/prompt";

function formatProjectTime(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "刚刚编辑";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "昨天";
  if (diffDay < 7) return `${diffDay} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export interface ProjectCardProps {
  deck: SavedDeck;
  viewMode: "grid" | "list";
  now: number;
  copiedDeckId: string | null;
  exportingDeckId: string | null;
  duplicatingDeckId: string | null;
  onRequestRename: (deck: SavedDeck) => void;
  onToggleVisibility: (deck: SavedDeck) => void;
  onCopyLink: (deck: SavedDeck) => void;
  onDuplicate: (deck: SavedDeck) => void;
  onExportPptx: (deck: SavedDeck) => void;
  onRequestDelete: (deck: SavedDeck) => void;
}

export default function ProjectCard({
  deck,
  viewMode,
  now,
  copiedDeckId,
  exportingDeckId,
  duplicatingDeckId,
  onRequestRename,
  onToggleVisibility,
  onCopyLink,
  onDuplicate,
  onExportPptx,
  onRequestDelete,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const cover = deck.slides[0];
  const styleShort = deck.promptTitle.split(" · ")[0] || deck.promptTitle;
  const menuId = `gl-project-menu-${deck.id}`;
  const isExporting = exportingDeckId === deck.id;
  const isDuplicating = duplicatingDeckId === deck.id;

  const menuEl = (
    <div className="gl-project-menu-wrap" ref={menuWrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="gl-project-more-btn"
        aria-label={`更多操作：${deck.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {menuOpen && (
        <div className="gl-project-menu" role="menu" id={menuId}>
          <Link
            role="menuitem"
            href={`/generate?deck=${deck.id}`}
            className="gl-project-menu-item"
            onClick={() => setMenuOpen(false)}
          >
            <Pencil size={14} aria-hidden="true" />
            <span>继续编辑</span>
          </Link>

          <Link
            role="menuitem"
            href={`/deck/${deck.id}`}
            className="gl-project-menu-item"
            onClick={() => setMenuOpen(false)}
          >
            <Play size={14} aria-hidden="true" />
            <span>演播与排练</span>
          </Link>

          <button
            type="button"
            role="menuitem"
            className="gl-project-menu-item"
            onClick={() => {
              setMenuOpen(false);
              onRequestRename(deck);
            }}
          >
            <Type size={14} aria-hidden="true" />
            <span>重命名</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="gl-project-menu-item"
            disabled={isDuplicating}
            onClick={() => {
              setMenuOpen(false);
              onDuplicate(deck);
            }}
          >
            <Copy size={14} aria-hidden="true" />
            <span>{isDuplicating ? "正在复制…" : "复制副本"}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="gl-project-menu-item"
            onClick={() => {
              setMenuOpen(false);
              onToggleVisibility(deck);
            }}
          >
            {deck.isPublic ? (
              <Lock size={14} aria-hidden="true" />
            ) : (
              <Globe size={14} aria-hidden="true" />
            )}
            <span>{deck.isPublic ? "设为私有" : "设为公开"}</span>
          </button>

          {deck.isPublic && (
            <button
              type="button"
              role="menuitem"
              className="gl-project-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onCopyLink(deck);
              }}
            >
              {copiedDeckId === deck.id ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Link2 size={14} aria-hidden="true" />
              )}
              <span>{copiedDeckId === deck.id ? "已复制链接" : "复制分享链接"}</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            className="gl-project-menu-item"
            disabled={isExporting}
            onClick={() => {
              setMenuOpen(false);
              onExportPptx(deck);
            }}
          >
            <Download size={14} aria-hidden="true" />
            <span>{isExporting ? "导出中…" : "导出 PPTX"}</span>
          </button>

          <div className="gl-project-menu-sep" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="gl-project-menu-item gl-project-menu-item--danger"
            onClick={() => {
              setMenuOpen(false);
              onRequestDelete(deck);
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>删除项目</span>
          </button>
        </div>
      )}
    </div>
  );

  const statusBadge = (
    <span
      className={`gl-project-status ${
        deck.isPublic ? "is-public" : "is-private"
      }`}
    >
      {deck.isPublic ? (
        <Globe size={11} aria-hidden="true" />
      ) : (
        <Lock size={11} aria-hidden="true" />
      )}
      <span>{deck.isPublic ? "公开分享" : "仅自己可见"}</span>
    </span>
  );

  if (viewMode === "list") {
    return (
      <article
        className="gl-project-card gl-project-card--list"
        data-project-card={deck.id}
      >
        <Link
          href={`/generate?deck=${deck.id}`}
          className="gl-project-list-thumb"
          aria-label={`编辑演示文稿：${deck.title}`}
        >
          <SlidePreviewFrame
            spec={deck.visualSpec}
            slideType={cover?.slideType ?? "cover"}
            topic={cover?.title || deck.title}
            subtitle={cover?.subtitle || deck.subtitle}
            audience={deck.audience}
            slideData={cover}
            pageIndex={0}
            totalPages={deck.slides.length}
            radius="sm"
          />
        </Link>

        <div className="gl-project-list-main">
          <div className="gl-project-list-title-row">
            <Link href={`/generate?deck=${deck.id}`} className="gl-project-title">
              {deck.title}
            </Link>
            {statusBadge}
          </div>
          <div className="gl-project-tags">
            <span className="gl-project-tag">{deck.slides.length} 页</span>
            <span className="gl-project-tag">{styleShort}</span>
            {deck.audience && (
              <span className="gl-project-tag">{deck.audience}</span>
            )}
          </div>
        </div>

        <div className="gl-project-list-meta">
          <span className="gl-project-time">
            <FileText size={13} aria-hidden="true" />
            <span>{formatProjectTime(deck.updatedAt, now)}</span>
          </span>
        </div>

        <div className="gl-project-list-actions">
          <Link
            href={`/generate?deck=${deck.id}`}
            className="gl-btn gl-btn--secondary gl-btn--sm"
          >
            编辑
          </Link>
          <Link
            href={`/deck/${deck.id}`}
            className="gl-btn gl-btn--ghost gl-btn--sm"
          >
            演播
          </Link>
          {menuEl}
        </div>
      </article>
    );
  }

  return (
    <article className="gl-project-card" data-project-card={deck.id}>
      <div className="gl-project-card-top">
        {statusBadge}
        {menuEl}
      </div>

      <Link
        href={`/generate?deck=${deck.id}`}
        className="gl-project-thumb-link"
        aria-label={`编辑演示文稿：${deck.title}`}
      >
        <SlidePreviewFrame
          spec={deck.visualSpec}
          slideType={cover?.slideType ?? "cover"}
          topic={cover?.title || deck.title}
          subtitle={cover?.subtitle || deck.subtitle}
          audience={deck.audience}
          slideData={cover}
          pageIndex={0}
          totalPages={deck.slides.length}
          radius="md"
          interactive
        />
      </Link>

      <div className="gl-project-body">
        <Link
          href={`/generate?deck=${deck.id}`}
          className="gl-project-title"
          title={deck.title}
        >
          {deck.title}
        </Link>

        <div className="gl-project-tags">
          <span className="gl-project-tag">{deck.slides.length} 页</span>
          <span className="gl-project-tag">{styleShort}</span>
          {deck.audience && (
            <span className="gl-project-tag">{deck.audience}</span>
          )}
        </div>

        <div className="gl-project-footer">
          <span className="gl-project-time">
            <span className="gl-project-ppt-badge" aria-hidden="true">
              P
            </span>
            <span>最近编辑 · {formatProjectTime(deck.updatedAt, now)}</span>
          </span>

          <div className="gl-project-quick">
            <Link
              href={`/deck/${deck.id}`}
              className="gl-project-quick-btn"
              title="演播与排练"
              aria-label={`演播：${deck.title}`}
            >
              <Play size={13} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="gl-project-quick-btn"
              title="导出 .pptx"
              aria-label={`导出 PPTX：${deck.title}`}
              disabled={isExporting}
              onClick={() => onExportPptx(deck)}
            >
              <Download size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
