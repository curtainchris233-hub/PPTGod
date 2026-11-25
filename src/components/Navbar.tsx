"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Columns2,
  Compass,
  LogOut,
  Plus,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function Navbar() {
  const pathname = usePathname();
  const { user, compareIds, openAuthModal, logout } = useApp();

  const navItems = [
    { href: "/", label: "视觉画廊", icon: Compass, id: "pg-nav-gallery" },
    {
      href: "/generate",
      label: "在线生成 PPT",
      icon: Sparkles,
      id: "pg-nav-generate",
    },
    {
      href: "/compare",
      label: "并排对比",
      icon: Columns2,
      id: "pg-nav-compare",
      badge: compareIds.length > 0 ? compareIds.length : undefined,
    },
    {
      href: "/collections",
      label: "我的空间",
      icon: Bookmark,
      id: "pg-nav-collections",
    },
  ];

  return (
    <header className="pg-navbar" id="pg-main-navbar">
      <div className="pg-navbar-inner">
        <Link href="/" className="pg-brand" id="pg-brand-link">
          <span className="pg-brand-mark" aria-hidden="true">
            <span className="pg-brand-slide-outer">
              <span className="pg-brand-slide-bar" />
            </span>
          </span>
          <span className="pg-brand-text">
            <span className="pg-brand-name">PPTGod</span>
            <span className="pg-brand-sub">视觉提示词实验室</span>
          </span>
        </Link>

        <nav className="pg-nav-links" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                className={`pg-nav-link ${active ? "is-active" : ""}`}
              >
                <Icon size={15} strokeWidth={1.85} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="pg-nav-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pg-nav-actions">
          <Link
            href="/create"
            className="pg-btn pg-btn-primary pg-btn-sm"
            id="pg-nav-create-btn"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>发布风格</span>
          </Link>

          {user ? (
            <div className="pg-user-pill">
              <Link
                href={`/creator/${user.username}`}
                className="pg-user-trigger"
                title={`创作者主页 · ${user.displayName}`}
                id="pg-nav-creator-link"
              >
                <span
                  className="pg-avatar"
                  style={{ background: user.avatarColor }}
                >
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="pg-user-name">{user.displayName}</span>
              </Link>
              <button
                type="button"
                className="pg-icon-btn"
                onClick={logout}
                title="退出登录"
                aria-label="退出登录"
                id="pg-nav-logout-btn"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={() => openAuthModal("login")}
              id="pg-nav-login-btn"
            >
              <UserIcon size={14} />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
