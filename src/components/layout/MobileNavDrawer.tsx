"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Columns2,
  HelpCircle,
  LogOut,
  Search,
  Settings,
  User as UserIcon,
  X,
} from "lucide-react";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";
import { isWorkspaceNavActive, WORKSPACE_NAV_ITEMS } from "./Sidebar";

interface MobileNavDrawerProps {
  allowDesktopDrawer?: boolean;
}

interface DrawerNavListProps {
  pathname: string;
  panel: string | null;
  tab: string | null;
  compareCount: number;
  onNavigate: () => void;
}

function DrawerNavList({
  pathname,
  panel,
  tab,
  compareCount,
  onNavigate,
}: DrawerNavListProps) {
  const isCompareActive =
    pathname === "/compare" || pathname.startsWith("/compare/");

  return (
    <nav className="gl-mobile-drawer-nav" aria-label="移动端全局导航">
      {WORKSPACE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isWorkspaceNavActive(item.key, pathname, panel, tab);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`gl-mobile-drawer-link ${active ? "is-active" : ""}`}
          >
            <Icon size={19} strokeWidth={active ? 2 : 1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <Link
        href="/compare"
        onClick={onNavigate}
        aria-current={isCompareActive ? "page" : undefined}
        className={`gl-mobile-drawer-link ${isCompareActive ? "is-active" : ""}`}
      >
        <Columns2
          size={19}
          strokeWidth={isCompareActive ? 2 : 1.8}
          aria-hidden="true"
        />
        <span>并排对比</span>
        {compareCount > 0 && (
          <span className="gl-mobile-drawer-badge">{compareCount}</span>
        )}
      </Link>
    </nav>
  );
}

function DrawerNavWithSearchParams({
  pathname,
  compareCount,
  onNavigate,
}: {
  pathname: string;
  compareCount: number;
  onNavigate: () => void;
}) {
  const searchParams = useSearchParams();
  return (
    <DrawerNavList
      pathname={pathname}
      panel={searchParams.get("panel")}
      tab={searchParams.get("tab")}
      compareCount={compareCount}
      onNavigate={onNavigate}
    />
  );
}

export default function MobileNavDrawer({
  allowDesktopDrawer = false,
}: MobileNavDrawerProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, compareIds, openAuthModal, logout } = useApp();
  const {
    mobileDrawerOpen,
    setMobileDrawerOpen,
    openHelpModal,
    openSettingsModal,
  } = useLayout();

  const [searchValue, setSearchValue] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropPressRef = useRef(false);

  const handleClose = useCallback(() => {
    setMobileDrawerOpen(false);
  }, [setMobileDrawerOpen]);

  const { isClient } = useOverlayDialog({
    open: mobileDrawerOpen,
    onClose: handleClose,
    closeOnEsc: true,
    panelRef,
  });

  useEffect(() => {
    if (!mobileDrawerOpen || allowDesktopDrawer) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileDrawerOpen(false);
      }
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [mobileDrawerOpen, allowDesktopDrawer, setMobileDrawerOpen]);

  if (!mobileDrawerOpen || !isClient) {
    return null;
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    handleClose();
    router.push(
      trimmed ? `/gallery?q=${encodeURIComponent(trimmed)}` : "/gallery"
    );
  };

  return createPortal(
    <div
      className="gl-mobile-drawer-backdrop"
      onMouseDown={(event) => {
        backdropPressRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPressRef.current && event.target === event.currentTarget) {
          handleClose();
        }
        backdropPressRef.current = false;
      }}
    >
      <div
        ref={panelRef}
        id="gl-mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="全局导航菜单"
        tabIndex={-1}
        className="gl-mobile-drawer"
      >
        <div className="gl-mobile-drawer-head">
          <Link
            href="/"
            className="gl-topbar-brand"
            onClick={handleClose}
            id="gl-drawer-brand-link"
          >
            <Image
              src="/brand/pptgod-logo.svg"
              alt=""
              width={30}
              height={30}
              unoptimized
              aria-hidden="true"
              className="gl-topbar-logo"
            />
            <span className="gl-topbar-wordmark">PPTGod</span>
          </Link>
          <button
            type="button"
            className="gl-mobile-drawer-close"
            onClick={handleClose}
            aria-label="关闭导航菜单"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <form
          role="search"
          className="gl-mobile-drawer-search"
          onSubmit={handleSearchSubmit}
          aria-label="抽屉内搜索模板与风格"
        >
          <label htmlFor="gl-drawer-search-input" className="gl-sr-only">
            搜索模板、风格或项目
          </label>
          <Search
            size={15}
            strokeWidth={2}
            className="gl-topbar-search-icon"
            aria-hidden="true"
          />
          <input
            id="gl-drawer-search-input"
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="搜索模板、风格或项目"
            className="gl-topbar-search-input"
          />
        </form>

        <div className="gl-mobile-drawer-body">
          <Suspense
            fallback={
              <DrawerNavList
                pathname={pathname}
                panel={null}
                tab={null}
                compareCount={compareIds.length}
                onNavigate={handleClose}
              />
            }
          >
            <DrawerNavWithSearchParams
              pathname={pathname}
              compareCount={compareIds.length}
              onNavigate={handleClose}
            />
          </Suspense>

          <hr className="gl-sidebar-divider" />

          <div className="gl-mobile-drawer-utils">
            <button
              type="button"
              className="gl-mobile-drawer-link"
              onClick={openHelpModal}
            >
              <HelpCircle size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>帮助中心</span>
            </button>
            <button
              type="button"
              className="gl-mobile-drawer-link"
              onClick={openSettingsModal}
            >
              <Settings size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>设置</span>
            </button>
          </div>
        </div>

        <div className="gl-mobile-drawer-foot">
          {user ? (
            <div className="gl-mobile-drawer-user">
              <Link
                href={`/creator/${user.username}`}
                id="gl-drawer-creator-link"
                className="gl-mobile-drawer-user-info"
                onClick={handleClose}
              >
                <span
                  className="gl-topbar-avatar"
                  style={{ background: user.avatarColor }}
                  aria-hidden="true"
                >
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="gl-mobile-drawer-user-text">
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </span>
              </Link>
              <button
                type="button"
                id="gl-drawer-logout-btn"
                className="gl-mobile-drawer-logout"
                onClick={() => {
                  handleClose();
                  void logout();
                }}
                aria-label="退出当前账号"
              >
                <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="gl-drawer-login-btn"
              className="gl-btn gl-btn--primary gl-btn--md gl-btn--full"
              onClick={() => {
                handleClose();
                openAuthModal("login");
              }}
            >
              <UserIcon size={16} strokeWidth={2} aria-hidden="true" />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
