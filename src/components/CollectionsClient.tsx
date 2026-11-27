"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  Clock,
  FolderKanban,
  Globe,
  Heart,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ProjectCard from "@/components/presentation/ProjectCard";
import StyleCard from "@/components/presentation/StyleCard";
import StyleDetailDrawer from "@/components/presentation/StyleDetailDrawer";
import { Button, Dialog, EmptyState, TextInput } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { PromptItem, SavedDeck } from "@/types/prompt";
import "@/styles/gallery.css";
import "@/styles/collections.css";

const PROFILE_COLORS = [
  "#2563EB",
  "#0369A1",
  "#0F766E",
  "#4F46E5",
  "#C84B31",
  "#14243C",
];

type WorkspaceTab =
  | "decks"
  | "recent"
  | "public"
  | "favorites"
  | "mine"
  | "liked";

type ProjectSort = "updated" | "created" | "slides" | "title";

interface CollectionsClientProps {
  initialPrompts: PromptItem[];
  initialDecks: SavedDeck[];
  initialTab?: "favorites" | "decks" | "mine" | "liked";
}

const VALID_WORKSPACE_TABS: readonly WorkspaceTab[] = [
  "decks",
  "recent",
  "public",
  "favorites",
  "mine",
  "liked",
];

export default function CollectionsClient({
  initialPrompts,
  initialDecks,
  initialTab = "decks",
}: CollectionsClientProps) {
  const searchParams = useSearchParams();
  const {
    user,
    syncVersion,
    globalTopic,
    setGlobalTopic,
    openAuthModal,
    localFavoriteIds,
    setAuthData,
    showToast,
  } = useApp();

  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<WorkspaceTab>(() => {
    if (urlTab && VALID_WORKSPACE_TABS.includes(urlTab as WorkspaceTab)) {
      return urlTab as WorkspaceTab;
    }
    return initialTab;
  });
  const [prevUrlTab, setPrevUrlTab] = useState<string | null>(urlTab);

  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    if (urlTab && VALID_WORKSPACE_TABS.includes(urlTab as WorkspaceTab)) {
      setTab(urlTab as WorkspaceTab);
    } else if (urlTab === null) {
      setTab("decks");
    }
  }

  const handleSelectTab = (next: WorkspaceTab) => {
    setTab(next);
    setPrevUrlTab(next === "decks" ? null : next);
    if (typeof window !== "undefined") {
      const nextUrl =
        next === "decks" ? "/collections" : `/collections?tab=${next}`;
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.replaceState(null, "", nextUrl);
      }
    }
  };
  const [mineFilter, setMineFilter] = useState<"all" | "public" | "private">(
    "all"
  );
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "public" | "private"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<ProjectSort>("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [now, setNow] = useState(() => Date.now());

  const [publicPrompts, setPublicPrompts] = useState<PromptItem[]>(
    initialPrompts.filter((p) => p.isPublic)
  );
  const [myPrompts, setMyPrompts] = useState<PromptItem[]>(
    user ? initialPrompts.filter((p) => p.authorId === user.id) : []
  );
  const [decks, setDecks] = useState<SavedDeck[]>(initialDecks);

  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);
  const [exportingDeckId, setExportingDeckId] = useState<string | null>(null);
  const [duplicatingDeckId, setDuplicatingDeckId] = useState<string | null>(
    null
  );

  // Style Detail Drawer for style tabs
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  // Rename Deck Dialog state
  const [renamingDeck, setRenamingDeck] = useState<SavedDeck | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState("");

  // Delete Deck Dialog state
  const [deletingDeck, setDeletingDeck] = useState<SavedDeck | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Delete Style Dialog state
  const [deletingPrompt, setDeletingPrompt] = useState<PromptItem | null>(null);
  const [deletingPromptBusy, setDeletingPromptBusy] = useState(false);

  // Edit Profile Dialog state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profName, setProfName] = useState(user?.displayName || "");
  const [profBio, setProfBio] = useState(user?.bio || "");
  const [profColor, setProfColor] = useState(user?.avatarColor || "#2563EB");
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
        setNow(Date.now());
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
    if (user) return combinedPrompts.filter((p) => p.favoritedByMe);
    return publicPrompts.filter((p) => localFavoriteIds.includes(p.id));
  }, [combinedPrompts, publicPrompts, user, localFavoriteIds]);

  const likedPrompts = useMemo(() => {
    if (!user) return [];
    return combinedPrompts.filter((p) => p.likedByMe);
  }, [combinedPrompts, user]);

  const recentDecksCount = useMemo(() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return decks.filter((d) => {
      const ts = new Date(d.updatedAt).getTime();
      return Number.isFinite(ts) && now - ts <= sevenDaysMs;
    }).length;
  }, [decks, now]);

  const publicDecksCount = useMemo(
    () => decks.filter((d) => d.isPublic).length,
    [decks]
  );

  const isDeckTab = tab === "decks" || tab === "recent" || tab === "public";

  const filteredDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const list = decks.filter((d) => {
      if (tab === "public" && !d.isPublic) return false;
      if (tab === "recent") {
        const ts = new Date(d.updatedAt).getTime();
        if (Number.isFinite(ts) && now - ts > sevenDaysMs) return false;
      }
      if (visibilityFilter === "public" && !d.isPublic) return false;
      if (visibilityFilter === "private" && d.isPublic) return false;
      if (q) {
        const hay = [d.title, d.subtitle, d.promptTitle, d.audience]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "created") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortBy === "slides") {
        return b.slides.length - a.slides.length;
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "zh-CN");
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [decks, tab, visibilityFilter, searchQuery, sortBy, now]);

  const filteredPrompts = useMemo(() => {
    const base =
      tab === "favorites"
        ? favoritePrompts
        : tab === "mine"
        ? myPrompts.filter((p) =>
            mineFilter === "public"
              ? p.isPublic
              : mineFilter === "private"
              ? !p.isPublic
              : true
          )
        : likedPrompts;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      [p.title, p.englishTitle, p.scenario, p.styleCategory, ...p.tags]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [tab, favoritePrompts, myPrompts, mineFilter, likedPrompts, searchQuery]);

  const previewPrompt = useMemo(
    () =>
      previewSlug
        ? combinedPrompts.find((p) => p.slug === previewSlug) ?? null
        : null,
    [combinedPrompts, previewSlug]
  );

  const handleUpdatePrompt = (updated: PromptItem) => {
    setPublicPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setMyPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleConfirmDeletePrompt = async () => {
    if (!deletingPrompt || deletingPromptBusy) return;
    setDeletingPromptBusy(true);
    try {
      const res = await fetch(`/api/prompts/${deletingPrompt.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPublicPrompts((prev) =>
          prev.filter((item) => item.id !== deletingPrompt.id)
        );
        setMyPrompts((prev) =>
          prev.filter((item) => item.id !== deletingPrompt.id)
        );
        showToast("已删除该风格模板");
        setDeletingPrompt(null);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "删除失败", "error");
      }
    } finally {
      setDeletingPromptBusy(false);
    }
  };

  const handleOpenRename = (deck: SavedDeck) => {
    setRenamingDeck(deck);
    setRenameTitle(deck.title);
    setRenameError("");
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDeck || renameSaving) return;
    const clean = renameTitle.trim();
    if (!clean) {
      setRenameError("项目名称不能为空");
      return;
    }
    setRenameSaving(true);
    setRenameError("");
    try {
      const res = await fetch(`/api/decks/${renamingDeck.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: clean,
          subtitle: renamingDeck.subtitle,
          audience: renamingDeck.audience,
          promptId: renamingDeck.promptId,
          promptSlug: renamingDeck.promptSlug,
          promptTitle: renamingDeck.promptTitle,
          visualSpec: renamingDeck.visualSpec,
          slides: renamingDeck.slides,
          isPublic: renamingDeck.isPublic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRenameError(data.error || "重命名失败，请稍后重试");
        return;
      }
      if (data.deck) {
        setDecks((prev) =>
          prev.map((d) => (d.id === renamingDeck.id ? data.deck : d))
        );
        setNow(Date.now());
      }
      showToast("已重命名演示文稿", "success");
      setRenamingDeck(null);
    } catch {
      setRenameError("网络异常，请重试");
    } finally {
      setRenameSaving(false);
    }
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
        nextPublic ? "已设为公开分享" : "已切换为仅自己可见",
        "success"
      );
    } else {
      showToast("更新可见性失败", "error");
    }
  };

  const handleCopyDeckLink = async (deck: SavedDeck) => {
    const url = `${window.location.origin}/deck/${deck.id}`;
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedDeckId(deck.id);
      showToast("已复制演播分享链接", "success");
      window.setTimeout(() => setCopiedDeckId(null), 1800);
    } else {
      showToast("复制失败", "error");
    }
  };

  const handleDuplicateDeck = async (deck: SavedDeck) => {
    if (duplicatingDeckId) return;
    setDuplicatingDeckId(deck.id);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${deck.title}（副本）`,
          subtitle: deck.subtitle,
          audience: deck.audience,
          promptId: deck.promptId,
          promptSlug: deck.promptSlug,
          promptTitle: deck.promptTitle,
          visualSpec: deck.visualSpec,
          slides: deck.slides,
          isPublic: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.deck) {
        showToast(data.error || "复制副本失败", "error");
        return;
      }
      setDecks((prev) => [data.deck, ...prev]);
      setNow(Date.now());
      showToast("已创建项目副本", "success");
    } catch {
      showToast("网络异常，复制副本失败", "error");
    } finally {
      setDuplicatingDeckId(null);
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

  const handleConfirmDeleteDeck = async () => {
    if (!deletingDeck || deletingBusy) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/decks/${deletingDeck.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDecks((prev) => prev.filter((d) => d.id !== deletingDeck.id));
        showToast("已删除该项目");
        setDeletingDeck(null);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "删除失败", "error");
      }
    } finally {
      setDeletingBusy(false);
    }
  };

  const openProfileModal = () => {
    if (!user) return;
    setProfName(user.displayName);
    setProfBio(user.bio);
    setProfColor(user.avatarColor || "#2563EB");
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

  const resetSearchAndFilters = () => {
    setSearchQuery("");
    setVisibilityFilter("all");
    setMineFilter("all");
  };

  const hasSearchOrFilter =
    searchQuery.trim() !== "" ||
    visibilityFilter !== "all" ||
    mineFilter !== "all";

  return (
    <main className="gl-col" id="gl-collections-page">
      <PageHeader
        className="gl-col-hero"
        icon={<FolderKanban size={22} />}
        title="我的项目"
        subtitle={
          user
            ? "管理你创建的所有演示文稿、风格收藏与发布作品，随时编辑、分享与导出"
            : "当前以访客模式展示本地收藏；登录后可云端保存演示文稿并跨设备同步"
        }
        actions={
          <div className="gl-col-hero-actions">
            {user ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  id="pg-edit-profile-btn"
                  leftIcon={<Pencil size={14} />}
                  onClick={openProfileModal}
                >
                  编辑个人资料
                </Button>
                <Link
                  href={`/creator/${user.username}`}
                  className="gl-btn gl-btn--secondary gl-btn--md"
                >
                  <UserIcon size={14} aria-hidden="true" />
                  <span>公开主页</span>
                </Link>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<UserIcon size={15} />}
                onClick={() => openAuthModal("login")}
              >
                登录同步云端
              </Button>
            )}
            <Link
              href="/generate"
              className="gl-btn gl-btn--primary gl-btn--md"
              id="gl-col-new-deck-btn"
            >
              <Plus size={15} aria-hidden="true" />
              <span>新建演示文稿</span>
            </Link>
          </div>
        }
      />

      {/* 4 Real KPI Stat Cards */}
      <section className="gl-col-stats" aria-label="项目统计概览">
        <button
          type="button"
          className={`gl-col-stat ${tab === "decks" ? "is-active" : ""}`}
          onClick={() => handleSelectTab("decks")}
        >
          <span className="gl-col-stat-icon" aria-hidden="true">
            <Layers size={20} />
          </span>
          <span className="gl-col-stat-body">
            <strong className="gl-col-stat-value">{decks.length}</strong>
            <span className="gl-col-stat-label">全部项目</span>
          </span>
        </button>

        <button
          type="button"
          className={`gl-col-stat ${tab === "recent" ? "is-active" : ""}`}
          onClick={() => handleSelectTab("recent")}
        >
          <span
            className="gl-col-stat-icon gl-col-stat-icon--recent"
            aria-hidden="true"
          >
            <Clock size={20} />
          </span>
          <span className="gl-col-stat-body">
            <strong className="gl-col-stat-value">{recentDecksCount}</strong>
            <span className="gl-col-stat-label">最近编辑</span>
          </span>
        </button>

        <button
          type="button"
          className={`gl-col-stat ${tab === "public" ? "is-active" : ""}`}
          onClick={() => handleSelectTab("public")}
        >
          <span
            className="gl-col-stat-icon gl-col-stat-icon--public"
            aria-hidden="true"
          >
            <Globe size={20} />
          </span>
          <span className="gl-col-stat-body">
            <strong className="gl-col-stat-value">{publicDecksCount}</strong>
            <span className="gl-col-stat-label">公开分享</span>
          </span>
        </button>

        <button
          type="button"
          className={`gl-col-stat ${tab === "favorites" ? "is-active" : ""}`}
          onClick={() => handleSelectTab("favorites")}
        >
          <span
            className="gl-col-stat-icon gl-col-stat-icon--fav"
            aria-hidden="true"
          >
            <Bookmark size={20} />
          </span>
          <span className="gl-col-stat-body">
            <strong className="gl-col-stat-value">
              {favoritePrompts.length}
            </strong>
            <span className="gl-col-stat-label">我收藏的</span>
          </span>
        </button>
      </section>

      {/* Honest Filter Tabs + Search + Sort + Grid/List Bar */}
      <section className="gl-col-bar" aria-label="筛选与视图切换">
        <div className="gl-col-tabs" role="tablist" aria-label="项目分类">
          <button
            type="button"
            role="tab"
            id="pg-tab-decks"
            aria-selected={tab === "decks"}
            className={`gl-col-tab ${tab === "decks" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("decks")}
          >
            <span>全部项目</span>
            <span className="gl-col-tab-count">{decks.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "recent"}
            className={`gl-col-tab ${tab === "recent" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("recent")}
          >
            <span>最近编辑</span>
            <span className="gl-col-tab-count">{recentDecksCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "public"}
            className={`gl-col-tab ${tab === "public" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("public")}
          >
            <span>公开分享</span>
            <span className="gl-col-tab-count">{publicDecksCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="pg-tab-favorites"
            aria-selected={tab === "favorites"}
            className={`gl-col-tab ${tab === "favorites" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("favorites")}
          >
            <span>我收藏的</span>
            <span className="gl-col-tab-count">{favoritePrompts.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="pg-tab-mine"
            aria-selected={tab === "mine"}
            className={`gl-col-tab ${tab === "mine" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("mine")}
          >
            <span>我发布的</span>
            <span className="gl-col-tab-count">{myPrompts.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="pg-tab-liked"
            aria-selected={tab === "liked"}
            className={`gl-col-tab ${tab === "liked" ? "is-active" : ""}`}
            onClick={() => handleSelectTab("liked")}
          >
            <span>我点赞的</span>
            <span className="gl-col-tab-count">{likedPrompts.length}</span>
          </button>
        </div>

        <div className="gl-col-controls">
          <div className="gl-col-search">
            <Search
              size={14}
              className="gl-col-search-icon"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="搜索项目名称、内容或标签"
              placeholder="搜索项目名称、内容或标签"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="gl-col-search-clear"
                aria-label="清空搜索"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          {isDeckTab && (
            <>
              <select
                className="gl-col-select"
                aria-label="按可见性筛选"
                value={visibilityFilter}
                onChange={(e) =>
                  setVisibilityFilter(
                    e.target.value as "all" | "public" | "private"
                  )
                }
              >
                <option value="all">全部可见性</option>
                <option value="public">公开分享</option>
                <option value="private">仅自己可见</option>
              </select>

              <select
                className="gl-col-select"
                name="sort"
                aria-label="排序方式"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ProjectSort)}
              >
                <option value="updated">最近编辑</option>
                <option value="created">最早创建</option>
                <option value="slides">页数最多</option>
                <option value="title">按名称排序</option>
              </select>

              <div className="gl-col-view-toggle" role="group" aria-label="视图切换">
                <button
                  type="button"
                  className={`gl-col-view-btn ${
                    viewMode === "grid" ? "is-active" : ""
                  }`}
                  aria-label="网格视图"
                  title="网格视图"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`gl-col-view-btn ${
                    viewMode === "list" ? "is-active" : ""
                  }`}
                  aria-label="列表视图"
                  title="列表视图"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                >
                  <List size={15} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Content Area */}
      {isDeckTab ? (
        filteredDecks.length > 0 ? (
          <section
            aria-label="演示文稿列表"
            className={
              viewMode === "grid"
                ? "gl-col-projects-grid"
                : "gl-col-projects-list"
            }
          >
            {filteredDecks.map((deck) => (
              <ProjectCard
                key={deck.id}
                deck={deck}
                viewMode={viewMode}
                now={now}
                copiedDeckId={copiedDeckId}
                exportingDeckId={exportingDeckId}
                duplicatingDeckId={duplicatingDeckId}
                onRequestRename={handleOpenRename}
                onToggleVisibility={handleToggleDeckVisibility}
                onCopyLink={handleCopyDeckLink}
                onDuplicate={handleDuplicateDeck}
                onExportPptx={handleExportDeckPptx}
                onRequestDelete={setDeletingDeck}
              />
            ))}
          </section>
        ) : hasSearchOrFilter ? (
          <EmptyState
            icon={<Search size={24} />}
            title="未找到匹配的演示文稿"
            description="尝试更换关键词或清除筛选条件，查看全部已保存的项目。"
            primaryAction={
              <Button
                variant="secondary"
                size="md"
                leftIcon={<RotateCcw size={14} />}
                onClick={resetSearchAndFilters}
              >
                清除筛选
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FolderKanban size={24} />}
            title={
              !user
                ? "登录后即可云端管理演示文稿"
                : tab === "public"
                ? "还没有开启公开分享的文稿"
                : "还没有保存的演示文稿"
            }
            description={
              !user
                ? "登录账号后，在创作工坊生成的演示文稿会保存在这里，支持重命名、复制、公开分享与导出 .pptx。"
                : "前往创作工坊输入主题或上传文档，生成并保存你的第一份演示文稿。"
            }
            primaryAction={
              !user ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openAuthModal("login")}
                >
                  立即登录
                </Button>
              ) : (
                <Link
                  href="/generate"
                  className="gl-btn gl-btn--primary gl-btn--md"
                >
                  <Plus size={15} aria-hidden="true" />
                  <span>新建演示文稿</span>
                </Link>
              )
            }
          />
        )
      ) : (
        <>
          {tab === "mine" && user && (
            <div className="gl-col-subbar" role="group" aria-label="按可见性筛选我的风格">
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
                  className={`gl-col-tab ${mineFilter === f.id ? "is-active" : ""}`}
                  onClick={() => setMineFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
              <Link
                href="/create"
                className="gl-btn gl-btn--secondary gl-btn--sm"
                style={{ marginLeft: "auto" }}
              >
                <Plus size={14} aria-hidden="true" />
                <span>发布新风格</span>
              </Link>
            </div>
          )}

          {filteredPrompts.length > 0 ? (
            <section className="gl-gallery-grid" aria-label="风格列表">
              {filteredPrompts.map((prompt) => (
                <div key={prompt.id}>
                  <StyleCard
                    prompt={prompt}
                    liveTopic={globalTopic}
                    onPreview={(item) => setPreviewSlug(item.slug)}
                    onUpdatePrompt={handleUpdatePrompt}
                  />
                  {tab === "mine" && user && user.id === prompt.authorId && (
                    <div className="gl-col-mine-actions">
                      <Link
                        href={`/create?edit=${encodeURIComponent(prompt.slug)}`}
                        className="gl-btn gl-btn--ghost gl-btn--sm"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        <span>编辑</span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 size={13} />}
                        onClick={() => setDeletingPrompt(prompt)}
                      >
                        删除
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          ) : hasSearchOrFilter ? (
            <EmptyState
              icon={<Search size={24} />}
              title="未找到匹配的风格"
              description="清空搜索词即可恢复展示。"
              primaryAction={
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<RotateCcw size={14} />}
                  onClick={resetSearchAndFilters}
                >
                  清除筛选
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={
                tab === "liked" ? (
                  <Heart size={24} />
                ) : tab === "mine" ? (
                  <Sparkles size={24} />
                ) : (
                  <Bookmark size={24} />
                )
              }
              title={
                tab === "favorites"
                  ? "还没有收藏任何 PPT 风格"
                  : tab === "mine"
                  ? user
                    ? "还没有发布原创风格"
                    : "登录后查看并管理你发布的风格"
                  : user
                  ? "还没有点赞过风格"
                  : "登录后查看你的点赞记录"
              }
              description={
                tab === "mine"
                  ? "使用风格创作器调配一套 16:9 视觉母版，支持公开分享或私密保存。"
                  : "前往风格画廊浏览 36+ 套视觉设计系统，随时收藏或用于生成 PPT。"
              }
              primaryAction={
                !user && tab !== "favorites" ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openAuthModal("login")}
                  >
                    立即登录
                  </Button>
                ) : tab === "mine" ? (
                  <Link
                    href="/create"
                    className="gl-btn gl-btn--primary gl-btn--md"
                  >
                    去发布新风格
                  </Link>
                ) : (
                  <Link
                    href="/gallery"
                    className="gl-btn gl-btn--primary gl-btn--md"
                  >
                    浏览风格画廊
                  </Link>
                )
              }
            />
          )}
        </>
      )}

      <StyleDetailDrawer
        key={previewPrompt?.id ?? "closed"}
        prompt={previewPrompt}
        liveTopic={globalTopic}
        onLiveTopicChange={setGlobalTopic}
        onClose={() => setPreviewSlug(null)}
        onUpdatePrompt={handleUpdatePrompt}
      />

      {/* Rename Deck Dialog */}
      <Dialog
        open={Boolean(renamingDeck)}
        onClose={() => !renameSaving && setRenamingDeck(null)}
        title="重命名演示文稿"
        description="更新后的名称会立即同步到云端项目列表与编辑器顶栏"
        size="sm"
        id="gl-rename-deck-dialog"
      >
        <form
          className="gl-col-dialog-form"
          data-rename-dialog="true"
          onSubmit={handleConfirmRename}
        >
          <TextInput
            label="项目名称"
            value={renameTitle}
            onChange={(e) => {
              setRenameTitle(e.target.value);
              if (renameError) setRenameError("");
            }}
            maxLength={120}
            required
            error={renameError || undefined}
            autoFocus
            id="gl-rename-deck-input"
          />
          <div className="gl-col-dialog-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRenamingDeck(null)}
              disabled={renameSaving}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={renameSaving}
              loadingText="保存中…"
            >
              确认保存
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Deck Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingDeck)}
        onClose={() => !deletingBusy && setDeletingDeck(null)}
        title="确认删除演示文稿？"
        description="删除后将永久移除且无法恢复，请确认是否继续操作。"
        size="sm"
        id="gl-delete-deck-dialog"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeletingDeck(null)}
              disabled={deletingBusy}
            >
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletingBusy}
              loadingText="删除中…"
              onClick={handleConfirmDeleteDeck}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--gl-text-secondary)" }}>
          将永久删除云端项目「<strong>{deletingDeck?.title}</strong>」。
        </p>
      </Dialog>

      {/* Delete Published Style Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingPrompt)}
        onClose={() => !deletingPromptBusy && setDeletingPrompt(null)}
        title="确认删除原创风格？"
        description="删除后无法恢复，相关分享链接将失效。"
        size="sm"
        id="gl-delete-prompt-dialog"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeletingPrompt(null)}
              disabled={deletingPromptBusy}
            >
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletingPromptBusy}
              loadingText="删除中…"
              onClick={handleConfirmDeletePrompt}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--gl-text-secondary)" }}>
          将永久删除你发布的模板「<strong>{deletingPrompt?.title}</strong>」。
        </p>
      </Dialog>

      {/* Edit User Profile Dialog */}
      <Dialog
        open={profileModalOpen && Boolean(user)}
        onClose={() => !profSaving && setProfileModalOpen(false)}
        title="编辑创作者个人资料"
        description="资料将展示在你的创作者主页与发布作品名片上"
        size="sm"
        id="gl-profile-dialog"
      >
        <form onSubmit={handleSaveProfile} className="gl-col-dialog-form">
          <TextInput
            id="pg-profile-name"
            label="创作者昵称"
            required
            minLength={2}
            maxLength={32}
            value={profName}
            onChange={(e) => setProfName(e.target.value)}
          />
          <TextInput
            id="pg-profile-bio"
            label="个人简介"
            maxLength={140}
            value={profBio}
            onChange={(e) => setProfBio(e.target.value)}
            placeholder="一句话介绍你的演示风格与擅长领域"
          />
          <div className="gl-field">
            <span className="gl-field-label">头像主题色</span>
            <div className="gl-swatch-row">
              {PROFILE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`gl-swatch-btn ${
                    profColor.toLowerCase() === hex.toLowerCase()
                      ? "is-selected"
                      : ""
                  }`}
                  style={{ background: hex }}
                  onClick={() => setProfColor(hex)}
                  aria-label={`选择头像色 ${hex}`}
                />
              ))}
            </div>
          </div>
          {profError && (
            <p className="gl-field-error" role="alert">
              {profError}
            </p>
          )}
          <div className="gl-col-dialog-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProfileModalOpen(false)}
              disabled={profSaving}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={profSaving}
              id="pg-profile-save-btn"
            >
              保存个人资料
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
