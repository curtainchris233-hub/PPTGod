"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LogOut,
  Menu,
  Plus,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";

interface TopbarProps {
  showMenuOnDesktop?: boolean;
}

function TopbarSearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/gallery?q=${encodeURIComponent(trimmed)}` : "/gallery"
    );
  };

  return (
    <form
      role="search"
      className="gl-topbar-search"
      onSubmit={handleSubmit}
      aria-label="全局搜索模板与风格"
    >
      <label htmlFor="gl-topbar-search-input" className="gl-sr-only">
        搜索模板、风格或项目
      </label>
      <Search
        size={15}
        strokeWidth={2}
        className="gl-topbar-search-icon"
        aria-hidden="true"
      />
      <input
        id="gl-topbar-search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索模板、风格或项目"
        className="gl-topbar-search-input"
      />
      {query && (
        <button
          type="button"
          className="gl-topbar-search-clear"
          aria-label="清空搜索关键词"
          onClick={() => setQuery("")}
        >
          <X size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

function TopbarSearchWithParams() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const qParam = pathname === "/gallery" ? searchParams.get("q") ?? "" : "";
  return <TopbarSearchInput key={qParam} initialQuery={qParam} />;
}

export default function Topbar({ showMenuOnDesktop = false }: TopbarProps) {
  const pathname = usePathname() || "/";
  const { user, compareIds, openAuthModal, logout } = useApp();
  const { mobileDrawerOpen, setMobileDrawerOpen } = useLayout();

  const navItems = [
    {
      id: "pg-nav-home",
      href: "/",
      label: "首页",
      active: pathname === "/",
    },
    {
      id: "pg-nav-gallery",
      href: "/gallery",
      label: "风格画廊",
      active: pathname === "/gallery" || pathname.startsWith("/gallery/"),
    },
    {
      id: "pg-nav-generate",
      href: "/generate",
      label: "创作工坊",
      active: pathname === "/generate" || pathname.startsWith("/generate/"),
    },
    {
      id: "pg-nav-collections",
      href: "/collections",
      label: "我的项目",
      active:
        pathname === "/collections" || pathname.startsWith("/collections/"),
    },
    {
      id: "pg-nav-compare",
      href: "/compare",
      label: "并排对比",
      active: pathname === "/compare" || pathname.startsWith("/compare/"),
      badge: compareIds.length > 0 ? compareIds.length : undefined,
    },
  ];

  return (
    <header className="gl-topbar gl-glass-topbar" id="pg-main-navbar">
      <div className="gl-topbar-inner">
        <div className="gl-topbar-left">
          <button
            type="button"
            className={`gl-topbar-menu-btn ${
              showMenuOnDesktop ? "is-always-visible" : ""
            }`}
            aria-label="打开导航菜单"
            aria-expanded={mobileDrawerOpen}
            aria-controls="gl-mobile-nav-drawer"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <Menu size={20} strokeWidth={2} aria-hidden="true" />
          </button>

          <Link href="/" className="gl-topbar-brand" id="pg-brand-link">
            <Image
              src="/brand/pptgod-logo.svg"
              alt=""
              width={32}
              height={32}
              unoptimized
              aria-hidden="true"
              className="gl-topbar-logo"
            />
            <span className="gl-topbar-wordmark">PPTGod</span>
          </Link>

          <nav className="gl-topbar-nav" aria-label="主导航">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                aria-current={item.active ? "page" : undefined}
                className={`gl-topbar-nav-link ${item.active ? "is-active" : ""}`}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className="gl-topbar-badge"
                    aria-label={`已选 ${item.badge} 套对比风格`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="gl-topbar-actions">
          <Suspense fallback={<TopbarSearchInput initialQuery="" />}>
            <TopbarSearchWithParams />
          </Suspense>

          <Link
            href="/create"
            className="gl-topbar-create-btn"
            id="pg-nav-create-btn"
          >
            <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>发布风格</span>
          </Link>

          {user ? (
            <div className="gl-topbar-user">
              <Link
                href={`/creator/${user.username}`}
                id="pg-nav-creator-link"
                className="gl-topbar-user-link"
                title={`创作者主页 · ${user.displayName}`}
                aria-label={`创作者主页 · ${user.displayName}`}
              >
                <span
                  className="gl-topbar-avatar"
                  style={{ background: user.avatarColor }}
                  aria-hidden="true"
                >
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="gl-topbar-user-name">{user.displayName}</span>
              </Link>
              <button
                type="button"
                id="pg-nav-logout-btn"
                className="gl-topbar-logout-btn"
                onClick={logout}
                title="退出登录"
                aria-label="退出登录"
              >
                <LogOut size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="pg-nav-login-btn"
              className="gl-topbar-login-btn"
              onClick={() => openAuthModal("login")}
            >
              <UserIcon size={15} strokeWidth={2} aria-hidden="true" />
              <span>登录</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
