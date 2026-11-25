"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { UserPublic, UserStats } from "@/types/prompt";

interface ToastState {
  id: number;
  message: string;
  tone: "default" | "success" | "error";
}

interface AppContextValue {
  user: UserPublic | null;
  stats: UserStats | null;
  authLoading: boolean;
  syncVersion: number;
  refreshAuth: () => Promise<void>;
  setAuthData: (user: UserPublic | null, stats: UserStats | null) => void;
  logout: () => Promise<void>;

  authModalOpen: boolean;
  authModalTab: "login" | "register";
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;

  compareIds: string[];
  toggleCompare: (id: string, title?: string) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;

  localFavoriteIds: string[];
  toggleLocalFavorite: (id: string) => boolean;

  globalTopic: string;
  setGlobalTopic: (topic: string) => void;

  toast: ToastState | null;
  showToast: (message: string, tone?: "default" | "success" | "error") => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const COMPARE_KEY = "pptgod_compare_ids_v1";
const LOCAL_FAV_KEY = "pptgod_guest_favs_v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncVersion, setSyncVersion] = useState(0);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">(
    "login"
  );

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [localFavoriteIds, setLocalFavoriteIds] = useState<string[]>([]);
  const localFavRef = useRef<string[]>([]);
  const syncingRef = useRef(false);

  const [globalTopic, setGlobalTopic] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, tone: "default" | "success" | "error" = "default") => {
      const id = Date.now();
      setToast({ id, message, tone });
      window.setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 2800);
    },
    []
  );

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        setStats(data.stats ?? null);
      }
    } catch {
      // ignore network errors silently
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setUser(data.user ?? null);
          setStats(data.stats ?? null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const savedCompare = localStorage.getItem(COMPARE_KEY);
        if (savedCompare) {
          const parsed = JSON.parse(savedCompare);
          if (Array.isArray(parsed)) setCompareIds(parsed.slice(0, 3));
        }
        const savedFavs = localStorage.getItem(LOCAL_FAV_KEY);
        if (savedFavs) {
          const parsed = JSON.parse(savedFavs);
          if (Array.isArray(parsed)) {
            localFavRef.current = parsed;
            setLocalFavoriteIds(parsed);
          }
        }
      } catch {
        // ignore storage errors
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Automatically merge guest localStorage favorites into cloud account upon login
  useEffect(() => {
    if (!user || localFavoriteIds.length === 0 || syncingRef.current) return;
    syncingRef.current = true;
    const idsToSync = [...localFavoriteIds];

    fetch("/api/prompts/sync-favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptIds: idsToSync }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          localFavRef.current = [];
          setLocalFavoriteIds([]);
          try {
            localStorage.removeItem(LOCAL_FAV_KEY);
          } catch {}
          setSyncVersion((v) => v + 1);
          refreshAuth();
          if (data.synced > 0) {
            showToast(
              `已自动将 ${data.synced} 条本地收藏同步至你的云端账号`,
              "success"
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        syncingRef.current = false;
      });
  }, [user, localFavoriteIds, refreshAuth, showToast]);

  const setAuthData = useCallback(
    (nextUser: UserPublic | null, nextStats: UserStats | null) => {
      setUser(nextUser);
      setStats(nextStats);
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStats(null);
    setSyncVersion((v) => v + 1);
    showToast("已退出登录");
  }, [showToast]);

  const openAuthModal = useCallback((tab: "login" | "register" = "login") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const toggleCompare = useCallback(
    (id: string, title?: string) => {
      setCompareIds((prev) => {
        if (prev.includes(id)) {
          const next = prev.filter((item) => item !== id);
          try {
            localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
          } catch {}
          showToast(title ? `已移出对比：${title}` : "已移出风格对比");
          return next;
        }
        if (prev.length >= 3) {
          showToast("最多同时对比 3 套 PPT 风格，请先移除一套", "error");
          return prev;
        }
        const next = [...prev, id];
        try {
          localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
        } catch {}
        showToast(
          title
            ? `已加入对比（${next.length}/3）：${title}`
            : `已加入对比（${next.length}/3）`,
          "success"
        );
        return next;
      });
    },
    [showToast]
  );

  const removeCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = prev.filter((item) => item !== id);
      try {
        localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    try {
      localStorage.removeItem(COMPARE_KEY);
    } catch {}
  }, []);

  const toggleLocalFavorite = useCallback((id: string): boolean => {
    const current = localFavRef.current;
    const exists = current.includes(id);
    const next = exists
      ? current.filter((item) => item !== id)
      : [id, ...current];
    localFavRef.current = next;
    setLocalFavoriteIds(next);
    try {
      localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(next));
    } catch {}
    return !exists;
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        stats,
        authLoading,
        syncVersion,
        refreshAuth,
        setAuthData,
        logout,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        compareIds,
        toggleCompare,
        removeCompare,
        clearCompare,
        localFavoriteIds,
        toggleLocalFavorite,
        globalTopic,
        setGlobalTopic,
        toast,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div
          className={`pg-toast pg-toast--${toast.tone}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
