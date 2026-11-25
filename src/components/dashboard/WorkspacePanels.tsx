"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FolderOpen,
  LogIn,
  MoreHorizontal,
  PencilRuler,
  Play,
  Plus,
  ShieldCheck,
  Timer,
  Wand2,
  Zap,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import type { SavedDeck } from "@/types/prompt";

export function formatRelativeTime(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚编辑";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "昨天";
  if (day < 7) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function DeckRowMenu({ deck }: { deck: SavedDeck }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuId = `gl-dash-deck-menu-${deck.id}`;

  return (
    <div className="gl-dash-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="gl-icon-btn gl-icon-btn--ghost gl-icon-btn--sm"
        aria-label={`更多操作：${deck.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="gl-dash-menu" role="menu" id={menuId}>
          <Link role="menuitem" href={`/generate?deck=${deck.id}`} className="gl-dash-menu-item">
            <PencilRuler size={14} aria-hidden="true" />
            继续编辑
          </Link>
          <Link role="menuitem" href={`/deck/${deck.id}`} className="gl-dash-menu-item">
            <Play size={14} aria-hidden="true" />
            演播与排练
          </Link>
          <Link role="menuitem" href="/collections?tab=decks" className="gl-dash-menu-item">
            <FolderOpen size={14} aria-hidden="true" />
            在我的项目中管理
          </Link>
        </div>
      )}
    </div>
  );
}

interface RecentProjectsPanelProps {
  isGuest: boolean;
  loading: boolean;
  error: string | null;
  decks: SavedDeck[];
  now: number;
  onLogin: () => void;
  onRetry: () => void;
}

export function RecentProjectsPanel({
  isGuest,
  loading,
  error,
  decks,
  now,
  onLogin,
  onRetry,
}: RecentProjectsPanelProps) {
  const recent = decks.slice(0, 3);

  let body: React.ReactNode;
  if (isGuest) {
    body = (
      <EmptyState
        compact
        icon={<LogIn size={22} />}
        title="登录后在这里继续最近的演示"
        description="保存到云端的文稿会按最近编辑时间出现在这里。"
        primaryAction={
          <Button variant="secondary" size="sm" onClick={onLogin} id="gl-dash-recent-login">
            登录
          </Button>
        }
        secondaryAction={
          <Link href="/generate" className="gl-btn gl-btn--ghost gl-btn--sm">
            新建演示
          </Link>
        }
        id="gl-dash-recent-guest"
      />
    );
  } else if (loading) {
    body = (
      <div className="gl-dash-recent-list" aria-busy="true">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    );
  } else if (error) {
    body = (
      <EmptyState
        compact
        title="最近项目加载失败"
        description={error}
        primaryAction={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            重试
          </Button>
        }
      />
    );
  } else if (recent.length === 0) {
    body = (
      <EmptyState
        compact
        icon={<Plus size={22} />}
        title="还没有保存的演示文稿"
        description="在创作工坊生成并保存后，会出现在这里。"
        primaryAction={
          <Link href="/generate" className="gl-btn gl-btn--secondary gl-btn--sm">
            新建演示
          </Link>
        }
        id="gl-dash-recent-empty"
      />
    );
  } else {
    body = (
      <ul className="gl-dash-recent-list">
        {recent.map((deck) => {
          const cover = deck.slides[0];
          return (
            <li key={deck.id} className="gl-dash-recent-item" data-deck-id={deck.id}>
              <Link href={`/generate?deck=${deck.id}`} className="gl-dash-recent-link">
                <span className="gl-dash-recent-thumb" aria-hidden="true">
                  <SlideCanvas
                    spec={deck.visualSpec}
                    slideType={cover?.slideType ?? "cover"}
                    topic={cover?.title || deck.title}
                    subtitle={cover?.subtitle || deck.subtitle}
                    slideData={cover}
                    pageIndex={0}
                    totalPages={deck.slides.length}
                  />
                </span>
                <span className="gl-dash-recent-text">
                  <strong>{deck.title}</strong>
                  <span>
                    {deck.slides.length} 页 · {formatRelativeTime(deck.updatedAt, now)}
                  </span>
                </span>
              </Link>
              <DeckRowMenu deck={deck} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section
      className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-recent"
      aria-labelledby="gl-dash-recent-title"
    >
      <div className="gl-panel-header">
        <div className="gl-panel-title-group">
          <span className="gl-panel-icon" aria-hidden="true">
            <FolderOpen size={18} />
          </span>
          <h2 className="gl-panel-title" id="gl-dash-recent-title">
            最近项目
          </h2>
        </div>
        {!isGuest && decks.length > 0 && (
          <div className="gl-panel-actions">
            <Link href="/collections?tab=decks" className="gl-dash-link" id="gl-dash-all-projects">
              查看全部
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      {body}
    </section>
  );
}

interface QuickTool {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
}

export function QuickToolsPanel({ studioSlug }: { studioSlug: string }) {
  const tools: QuickTool[] = [
    {
      key: "workshop",
      title: "进入创作工坊",
      desc: "精细编辑与排版",
      href: "/generate",
      icon: <PencilRuler size={20} />,
    },
    {
      key: "audit",
      title: "设计体检",
      desc: "100 分制检查并优化 PPT",
      href: "/generate?panel=audit",
      icon: <ShieldCheck size={20} />,
    },
    {
      key: "rehearsal",
      title: "演讲排练",
      desc: "语速节拍与倒计时",
      href: "/tools?tab=pacing",
      icon: <Timer size={20} />,
    },
    {
      key: "studio",
      title: "提示词工作室",
      desc: "生成多工具创作提示词",
      href: `/studio/${studioSlug}`,
      icon: <Wand2 size={20} />,
    },
  ];

  return (
    <section
      className="gl-panel gl-panel--default gl-panel--pad-md gl-panel--radius-lg gl-dash-tools"
      aria-labelledby="gl-dash-tools-title"
    >
      <div className="gl-panel-header">
        <div className="gl-panel-title-group">
          <span className="gl-panel-icon" aria-hidden="true">
            <Zap size={18} />
          </span>
          <h2 className="gl-panel-title" id="gl-dash-tools-title">
            快速工具
          </h2>
        </div>
      </div>
      <ul className="gl-dash-tools-grid">
        {tools.map((tool) => (
          <li key={tool.key}>
            <Link href={tool.href} className="gl-dash-tool" id={`gl-dash-tool-${tool.key}`}>
              <span className="gl-dash-tool-icon" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="gl-dash-tool-text">
                <strong>{tool.title}</strong>
                <span>{tool.desc}</span>
              </span>
              <ChevronRight size={16} className="gl-dash-tool-chevron" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
