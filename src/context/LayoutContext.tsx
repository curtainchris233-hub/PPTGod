"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface LayoutContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  editorFullBleed: boolean;
  setEditorFullBleed: (enabled: boolean) => void;
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  helpModalOpen: boolean;
  openHelpModal: () => void;
  closeHelpModal: () => void;
}

const SIDEBAR_STORAGE_KEY = "pptgod_sidebar_collapsed_v1";

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  // Always start false during SSR & initial hydration to guarantee zero hydration mismatch.
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [editorFullBleed, setEditorFullBleed] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Hydrate persisted sidebar preference asynchronously (React 19 ESLint clean)
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored === "1" || stored === "true") {
          setSidebarCollapsedState(true);
        }
      } catch {
        // ignore private-mode storage errors
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const openSettingsModal = useCallback(() => {
    setHelpModalOpen(false);
    setMobileDrawerOpen(false);
    setSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setSettingsModalOpen(false);
  }, []);

  const openHelpModal = useCallback(() => {
    setSettingsModalOpen(false);
    setMobileDrawerOpen(false);
    setHelpModalOpen(true);
  }, []);

  const closeHelpModal = useCallback(() => {
    setHelpModalOpen(false);
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      mobileDrawerOpen,
      setMobileDrawerOpen,
      editorFullBleed,
      setEditorFullBleed,
      settingsModalOpen,
      openSettingsModal,
      closeSettingsModal,
      helpModalOpen,
      openHelpModal,
      closeHelpModal,
    }),
    [
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      mobileDrawerOpen,
      editorFullBleed,
      settingsModalOpen,
      openSettingsModal,
      closeSettingsModal,
      helpModalOpen,
      openHelpModal,
      closeHelpModal,
    ]
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used inside LayoutProvider");
  }
  return ctx;
}
