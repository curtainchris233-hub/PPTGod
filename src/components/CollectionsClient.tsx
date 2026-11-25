"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  FileSpreadsheet,
  FolderKanban,
  Globe,
  Heart,
  Link2,
  Lock,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import PromptCard from "@/components/PromptCard";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import type { PromptItem, SavedDeck } from "@/types/prompt";
import "@/styles/community.css";

const PROFILE_COLORS = [
  "#C84B31",
  "#0F766E",
  "#1D4ED8",
  "#9D174D",
  "#B45309",
  "#3F6212",
  "#1E3A5F",
];

interface CollectionsClientProps {
  initialPrompts: PromptItem[];
  initialDecks: SavedDeck[];
  initialTab?: "favorites" | "decks" | "mine" | "liked";
}

export default function CollectionsClient({
  initialPrompts,
  initialDecks,
  initialTab = "favorites",
}: CollectionsClientProps) {
  const { user, syncVersion, openAuthModal, localFavoriteIds, setAuthData, showToast } =
    useApp();

  const [tab, setTab] = useState<"favorites" | "decks" | "mine" | "liked">(
    initialTab
  );
  const [mineFilter, setMineFilter] = useState<"all" | "public" | "private">(
    "all"
  );

  const [publicPrompts, setPublicPrompts] = useState<PromptItem[]>(
    initialPrompts.filter((p) => p.isPublic)
  );
  const [myPrompts, setMyPrompts] = useState<PromptItem[]>(
    user ? initialPrompts.filter((p) => p.authorId === user.id) : []
  );
  const [decks, setDecks] = useState<SavedDeck[]>(initialDecks);
  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);
  const [exportingDeckId, setExportingDeckId] = useState<string | null>(null);

  // Edit Profile Modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profName, setProfName] = useState(user?.displayName || "");
  const [profBio, setProfBio] = useState(user?.bio || "");
  const [profColor, setProfColor] = useState(user?.avatarColor || "#C84B31");
  const [profSaving, setProfSaving] = useState(false);
  const [profError, setProfError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/prompts", { cache: "no-store" }).then((r) => r.json()),
      user
        ? fetch("/api/prompts?scope=mine", { cache: "no-store" }).then((r) =>
            r.json()
          )
        : Promise.resolve({ prompts: [] }),
      user
        ? fetch("/api/decks", { cache: "no-store" }).then((r) => r.json())
        : Promise.resolve({ decks: [] }),
    ])
      .then(([pubRes, mineRes, deckRes]) => {
        if (cancelled) return;
        if (Array.isArray(pubRes.prompts)) setPublicPrompts(pubRes.prompts);
        if (Array.isArray(mineRes.prompts)) setMyPrompts(mineRes.prompts);
        if (Array.isArray(deckRes.decks)) setDecks(deckRes.decks);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, syncVersion]);

  const combinedPrompts = useMemo(() => {
    const map = new Map<string, PromptItem>();
    for (const p of publicPrompts) map.set(p.id, p);
    for (const p of myPrompts) map.set(p.id, p);
    return Array.from(map.values());
  }, [publicPrompts, myPrompts]);

  const favoritePrompts = useMemo(() => {
    if (user) {
      return combinedPrompts.filter((p) => p.favoritedByMe);
    }
    return publicPrompts.filter((p) => localFavoriteIds.includes(p.id));
  }, [combinedPrompts, publicPrompts, user, localFavoriteIds]);

  const filteredMyPrompts = useMemo(() => {
    if (mineFilter === "public") return myPrompts.filter((p) => p.isPublic);
    if (mineFilter === "private") return myPrompts.filter((p) => !p.isPublic);
    return myPrompts;
  }, [myPrompts, mineFilter]);

  const likedPrompts = useMemo(() => {
    if (!user) return [];
    return combinedPrompts.filter((p) => p.likedByMe);
  }, [combinedPrompts, user]);

  const handleUpdatePrompt = (updated: PromptItem) => {
    setPublicPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setMyPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleDeletePrompt = (id: string) => {
    setPublicPrompts((prev) => prev.filter((item) => item.id !== id));
    setMyPrompts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleDeckVisibility = async (deck: SavedDeck) => {
    const nextPublic = !deck.isPublic;
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: nextPublic }),
    });
    if (res.ok) {
      const data = await res.json();
      setDecks((prev) =>
        prev.map((d) => (d.id === deck.id ? data.deck : d))
      );
      showToast(
        nextPublic ? "已开启公开分享链接" : "已切换为仅自己可见（私有）",
        "success"
      );
    }
  };

  const handleCopyDeckLink = async (deckId: string) => {
    const url = `${window.location.origin}/deck/${deckId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedDeckId(deckId);
      showToast("已复制纯净演播分享链接 (/deck)", "success");
      window.setTimeout(() => setCopiedDeckId(null), 1800);
    } catch {
      showToast("复制失败", "error");
    }
  };

  const handleExportDeckPptx = async (deck: SavedDeck) => {
    if (exportingDeckId) return;
    setExportingDeckId(deck.id);
    try {
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deck.title,
          subtitle: deck.subtitle,
          audience: deck.audience,
          styleName: deck.promptTitle,
          visualSpec: deck.visualSpec,
          slides: deck.slides,
        }),
      });
      if (!res.ok) {
        showToast("导出 .pptx 失败", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.promptSlug || "pptgod"}-deck.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("已导出原生 .pptx 文件", "success");
    } finally {
      setExportingDeckId(null);
    }
  };

  const handleDeleteDeck = async (deck: SavedDeck) => {
    if (!window.confirm(`确认删除云端文稿「${deck.title}」吗？`)) return;
    const res = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    if (res.ok) {
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
      showToast("已删除该文稿");
    }
  };

  const openProfileModal = () => {
    if (!user) return;
    setProfName(user.displayName);
    setProfBio(user.bio);
    setProfColor(user.avatarColor);
    setProfError("");
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfError("");
    setProfSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profName,
          bio: profBio,
          avatarColor: profColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfError(data.error || "更新资料失败");
        return;
      }
      setAuthData(data.user, data.stats);
      showToast("个人资料已更新！", "success");
      setProfileModalOpen(false);
    } catch {
      setProfError("网络请求异常，请重试");
    } finally {
      setProfSaving(false);
    }
  };

  return (
    <main className="pg-page">
      <div className="pg-container">
        <header className="pg-subpage-header">
          <div>
            <p className="pg-kicker">PERSONAL WORKSPACE</p>
            <h1 className="pg-subpage-title">
              {user ? `${user.displayName} 的创作空间` : "我的收藏与文稿空间"}
            </h1>
            <p className="pg-subpage-lead">
              {user
                ? user.bio ||
                  "集中管理云端收藏风格、在线生成的 PPT 文稿、公开发布与私有草稿。"
                : "当前以访客模式展示本地收藏；登录后会自动将本地收藏合并至云端，并解锁云端文稿与作品管理。"}
            </p>
          </div>
          <div className="pg-subpage-actions">
            {user ? (
              <>
                <button
                  type="button"
                  className="pg-btn pg-btn-secondary"
                  onClick={openProfileModal}
                  id="pg-edit-profile-btn"
                >
                  <Pencil size={14} />
                  <span>编辑个人资料</span>
                </button>
                <Link
                  href={`/creator/${user.username}`}
                  className="pg-btn pg-btn-secondary"
                >
                  <UserIcon size={14} />
                  <span>公开主页</span>
                </Link>
              </>
            ) : (
              <button
                type="button"
                className="pg-btn pg-btn-secondary"
                onClick={() => openAuthModal("login")}
              >
                <UserIcon size={15} />
                <span>登录同步云端</span>
              </button>
            )}
            <Link href="/create" className="pg-btn pg-btn-primary">
              <Plus size={15} />
              <span>发布新风格</span>
            </Link>
          </div>
        </header>

        {/* 4-Tab Bar */}
        <div className="pg-collection-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "favorites"}
            className={`pg-pill ${tab === "favorites" ? "is-active" : ""}`}
            onClick={() => setTab("favorites")}
            id="pg-tab-favorites"
          >
            <Bookmark size={14} />
            <span>
              已收藏风格 ({favoritePrompts.length}
              {!user ? " · 本地" : ""})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "decks"}
            className={`pg-pill ${tab === "decks" ? "is-active" : ""}`}
            onClick={() => setTab("decks")}
            id="pg-tab-decks"
          >
            <FolderKanban size={14} />
            <span>我保存的 PPT 文稿 ({decks.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            className={`pg-pill ${tab === "mine" ? "is-active" : ""}`}
            onClick={() => setTab("mine")}
            id="pg-tab-mine"
          >
            <Sparkles size={14} />
            <span>我发布的风格 ({myPrompts.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "liked"}
            className={`pg-pill ${tab === "liked" ? "is-active" : ""}`}
            onClick={() => setTab("liked")}
            id="pg-tab-liked"
          >
            <Heart size={14} />
            <span>我点赞的 ({likedPrompts.length})</span>
          </button>
        </div>

        {/* TAB 2: Saved Cloud PPT Decks */}
        {tab === "decks" ? (
          decks.length > 0 ? (
            <div className="pg-decks-grid">
              {decks.map((deck) => (
                <article key={deck.id} className="pg-deck-card">
                  <div className="pg-deck-thumb-wrap">
                    <Link
                      href={`/generate?deck=${deck.id}`}
                      className="pg-deck-thumb"
                      style={{ display: "block" }}
                    >
                      <SlideCanvas
                        spec={deck.visualSpec}
                        slideType={deck.slides[0]?.slideType || "cover"}
                        topic={deck.title}
                        subtitle={deck.subtitle}
                        audience={deck.audience}
                        slideData={deck.slides[0]}
                        pageIndex={0}
                        totalPages={deck.slides.length}
                      />
                    </Link>
                  </div>
                  <div className="pg-deck-body">
                    <h3 className="pg-deck-title">{deck.title}</h3>
                    <div className="pg-deck-meta">
                      <span
                        className={`pg-tag ${
                          deck.isPublic ? "pg-tag-scenario" : "pg-tag-private"
                        }`}
                      >
                        {deck.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                        <span>{deck.isPublic ? "公开分享" : "仅自己可见"}</span>
                      </span>
                      <span className="pg-tag">{deck.slides.length} 页</span>
                      <span>母版：{deck.promptTitle}</span>
                    </div>

                    <div className="pg-deck-actions">
                      <Link
                        href={`/generate?deck=${deck.id}`}
                        className="pg-btn pg-btn-ink pg-btn-xs"
                      >
                        <Pencil size={12} />
                        <span>继续编辑</span>
                      </Link>
                      <Link
                        href={`/deck/${deck.id}`}
                        className="pg-btn pg-btn-secondary pg-btn-xs"
                      >
                        <Play size={12} />
                        <span>演播</span>
                      </Link>
                      <button
                        type="button"
                        className="pg-btn pg-btn-secondary pg-btn-xs"
                        onClick={() => handleToggleDeckVisibility(deck)}
                      >
                        {deck.isPublic ? <Lock size={12} /> : <Globe size={12} />}
                        <span>{deck.isPublic ? "设为私有" : "开启分享"}</span>
                      </button>
                      {deck.isPublic && (
                        <button
                          type="button"
                          className="pg-btn pg-btn-secondary pg-btn-xs"
                          onClick={() => handleCopyDeckLink(deck.id)}
                        >
                          {copiedDeckId === deck.id ? (
                            <Check size={12} />
                          ) : (
                            <Link2 size={12} />
                          )}
                          <span>{copiedDeckId === deck.id ? "已复制" : "链接"}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="pg-btn pg-btn-secondary pg-btn-xs"
                        disabled={exportingDeckId === deck.id}
                        onClick={() => handleExportDeckPptx(deck)}
                      >
                        <FileSpreadsheet size={12} />
                        <span>.pptx</span>
                      </button>
                      <button
                        type="button"
                        className="pg-stat-btn pg-stat-btn-danger"
                        onClick={() => handleDeleteDeck(deck)}
                        title="删除文稿"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="pg-empty-state">
              <FolderKanban size={28} strokeWidth={1.5} />
              <h2>
                {user ? "还没有保存过云端 PPT 文稿" : "登录后可云端保存生成的 PPT"}
              </h2>
              <p>
                前往在线生成工坊，粘贴你的主题或文档一键生成整套幻灯片，随时保存并导出原生
                .pptx。
              </p>
              <div className="pg-empty-actions">
                {!user && (
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary"
                    onClick={() => openAuthModal("login")}
                  >
                    立即登录
                  </button>
                )}
                <Link href="/generate" className="pg-btn pg-btn-primary">
                  前往在线生成 PPT 工坊
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            {/* Visibility filter pills for My Published Styles */}
            {tab === "mine" && user && (
              <div className="pg-mine-filter-bar" role="group" aria-label="按可见性筛选我的风格">
                <span className="pg-filter-label">可见性筛选：</span>
                {(
                  [
                    { id: "all", label: `全部 (${myPrompts.length})` },
                    {
                      id: "public",
                      label: `公开 (${myPrompts.filter((p) => p.isPublic).length})`,
                    },
                    {
                      id: "private",
                      label: `仅自己可见 (${myPrompts.filter((p) => !p.isPublic).length})`,
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`pg-mini-pill ${
                      mineFilter === f.id ? "is-active" : ""
                    }`}
                    onClick={() => setMineFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const list =
                tab === "favorites"
                  ? favoritePrompts
                  : tab === "mine"
                  ? filteredMyPrompts
                  : likedPrompts;

              if (list.length > 0) {
                return (
                  <div className="pg-gallery-grid">
                    {list.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        onUpdatePrompt={handleUpdatePrompt}
                        onDeletePrompt={handleDeletePrompt}
                        showDelete={tab === "mine"}
                        showEdit={tab === "mine"}
                      />
                    ))}
                  </div>
                );
              }

              return (
                <div className="pg-empty-state">
                  <Bookmark size={28} strokeWidth={1.5} />
                  <h2>
                    {tab === "favorites"
                      ? "还没有收藏任何 PPT 风格"
                      : tab === "mine"
                      ? user
                        ? "当前筛选下暂无原创风格"
                        : "登录后查看并管理你发布的风格"
                      : user
                      ? "还没有点赞过提示词"
                      : "登录后查看你的点赞记录"}
                  </h2>
                  <p>
                    {tab === "mine"
                      ? "使用可视化编辑器创作一套可交互的 16:9 风格模板，支持公开分享或私密保存。"
                      : "去视觉画廊浏览 18+ 套精选设计系统，点击收藏按钮随时留存备用。"}
                  </p>
                  <div className="pg-empty-actions">
                    {!user && tab !== "favorites" ? (
                      <button
                        type="button"
                        className="pg-btn pg-btn-primary"
                        onClick={() => openAuthModal("login")}
                      >
                        立即登录 / 体验演示账号
                      </button>
                    ) : tab === "mine" ? (
                      <Link href="/create" className="pg-btn pg-btn-primary">
                        去创作第一套风格
                      </Link>
                    ) : (
                      <Link href="/" className="pg-btn pg-btn-primary">
                        前往视觉画廊挑选
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Edit User Profile Modal */}
      {profileModalOpen && user && (
        <div
          className="pg-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pg-profile-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileModalOpen(false);
          }}
        >
          <div className="pg-modal">
            <div className="pg-modal-head">
              <div>
                <h2 id="pg-profile-modal-title" className="pg-modal-title">
                  编辑创作者个人资料
                </h2>
                <p className="pg-modal-sub">
                  资料将公开展示在你的创作者主页与发布作品名片上
                </p>
              </div>
              <button
                type="button"
                className="pg-icon-btn"
                onClick={() => setProfileModalOpen(false)}
                aria-label="关闭窗口"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="pg-form">
              <div className="pg-field">
                <label htmlFor="pg-profile-name">创作者昵称</label>
                <input
                  id="pg-profile-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                />
              </div>

              <div className="pg-field">
                <label htmlFor="pg-profile-bio">个人简介</label>
                <textarea
                  id="pg-profile-bio"
                  rows={2}
                  maxLength={140}
                  value={profBio}
                  onChange={(e) => setProfBio(e.target.value)}
                />
              </div>

              <div className="pg-field">
                <label>头像主题色</label>
                <div className="pg-accent-row">
                  {PROFILE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`pg-accent-dot ${
                        profColor.toLowerCase() === hex.toLowerCase()
                          ? "is-active"
                          : ""
                      }`}
                      style={{ background: hex }}
                      onClick={() => setProfColor(hex)}
                      aria-label={`选择头像色 ${hex}`}
                    />
                  ))}
                </div>
              </div>

              {profError && <div className="pg-form-error">{profError}</div>}

              <button
                type="submit"
                className="pg-btn pg-btn-primary pg-btn-full"
                disabled={profSaving}
                id="pg-profile-save-btn"
              >
                {profSaving ? "保存中..." : "保存个人资料"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
