"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Folder,
  HelpCircle,
  Home,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  PlusSquare,
  Presentation,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLayout } from "@/context/LayoutContext";

export interface WorkspaceNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const WORKSPACE_NAV_ITEMS: readonly WorkspaceNavItem[] = [
  { key: "home", label: "首页", href: "/", icon: Home },
  { key: "create-deck", label: "新建演示", href: "/generate", icon: PlusSquare },
  { key: "projects", label: "我的项目", href: "/collections", icon: Folder },
  { key: "gallery", label: "风格画廊", href: "/gallery", icon: LayoutGrid },
  {
    key: "studio",
    label: "提示词工作室",
    href: "/studio/apple-soft-bento-modular",
    icon: Wand2,
  },
  {
    key: "audit",
    label: "设计体检",
    href: "/generate?panel=audit",
    icon: ShieldCheck,
  },
  {
    key: "rehearsal",
    label: "演讲排练",
    href: "/tools?tab=pacing",
    icon: Presentation,
  },
  { key: "tools", label: "效率工具箱", href: "/tools", icon: Wrench },
  { key: "publish", label: "发布风格", href: "/create", icon: Sparkles },
];

export function isWorkspaceNavActive(
  key: string,
  pathname: string,
  panel: string | null,
  tab: string | null
): boolean {
  switch (key) {
    case "home":
      return pathname === "/";
    case "create-deck":
      return pathname === "/generate" && panel !== "audit";
    case "projects":
      return pathname === "/collections" || pathname.startsWith("/collections/");
    case "gallery":
      return pathname === "/gallery" || pathname.startsWith("/gallery/");
    case "studio":
      return pathname === "/studio" || pathname.startsWith("/studio/");
    case "audit":
      return pathname === "/generate" && panel === "audit";
    case "rehearsal":
      return (
        pathname.startsWith("/deck/") ||
        (pathname === "/tools" && tab === "pacing")
      );
    case "tools":
      return pathname === "/tools" && tab !== "pacing";
    case "publish":
      return pathname === "/create" || pathname.startsWith("/create/");
    default:
      return false;
  }
}

interface SidebarNavListProps {
  pathname: string;
  panel: string | null;
  tab: string | null;
  collapsed: boolean;
}

function SidebarNavList({
  pathname,
  panel,
  tab,
  collapsed,
}: SidebarNavListProps) {
  return (
    <nav className="gl-sidebar-nav" aria-label="工作区导航">
      {WORKSPACE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isWorkspaceNavActive(item.key, pathname, panel, tab);
        return (
          <Link
            key={item.key}
            href={item.href}
            /* Enabled once M2 introduces /gallery/page.tsx */
            prefetch={item.href === "/gallery" ? false : undefined}
            className={`gl-sidebar-item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            data-tooltip={collapsed ? item.label : undefined}
          >
            <Icon
              size={20}
              strokeWidth={active ? 2 : 1.8}
              className="gl-sidebar-item-icon"
              aria-hidden="true"
            />
            <span className="gl-sidebar-item-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarNavWithSearchParams({
  pathname,
  collapsed,
}: {
  pathname: string;
  collapsed: boolean;
}) {
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const tab = searchParams.get("tab");
  return (
    <SidebarNavList
      pathname={pathname}
      panel={panel}
      tab={tab}
      collapsed={collapsed}
    />
  );
}

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const {
    sidebarCollapsed,
    toggleSidebar,
    helpModalOpen,
    openHelpModal,
    settingsModalOpen,
    openSettingsModal,
  } = useLayout();

  return (
    <aside
      className={`gl-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}
      aria-label="左侧工作区侧边栏"
    >
      <div className="gl-sidebar-scroll">
        <Suspense
          fallback={
            <SidebarNavList
              pathname={pathname}
              panel={null}
              tab={null}
              collapsed={sidebarCollapsed}
            />
          }
        >
          <SidebarNavWithSearchParams
            pathname={pathname}
            collapsed={sidebarCollapsed}
          />
        </Suspense>

        <hr className="gl-sidebar-divider" />

        <div className="gl-sidebar-utilities" aria-label="帮助与设置">
          <button
            type="button"
            className={`gl-sidebar-item ${helpModalOpen ? "is-active" : ""}`}
            onClick={openHelpModal}
            aria-label={sidebarCollapsed ? "帮助中心" : undefined}
            data-tooltip={sidebarCollapsed ? "帮助中心" : undefined}
          >
            <HelpCircle
              size={20}
              strokeWidth={1.8}
              className="gl-sidebar-item-icon"
              aria-hidden="true"
            />
            <span className="gl-sidebar-item-label">帮助中心</span>
          </button>

          <button
            type="button"
            className={`gl-sidebar-item ${settingsModalOpen ? "is-active" : ""}`}
            onClick={openSettingsModal}
            aria-label={sidebarCollapsed ? "设置" : undefined}
            data-tooltip={sidebarCollapsed ? "设置" : undefined}
          >
            <Settings
              size={20}
              strokeWidth={1.8}
              className="gl-sidebar-item-icon"
              aria-hidden="true"
            />
            <span className="gl-sidebar-item-label">设置</span>
          </button>
        </div>

        <div className="gl-sidebar-bottom">
          <button
            type="button"
            className="gl-sidebar-item gl-sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            title={sidebarCollapsed ? undefined : "收起侧边栏"}
            data-tooltip={sidebarCollapsed ? "展开侧边栏" : undefined}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen
                size={19}
                strokeWidth={1.85}
                className="gl-sidebar-item-icon"
                aria-hidden="true"
              />
            ) : (
              <PanelLeftClose
                size={19}
                strokeWidth={1.85}
                className="gl-sidebar-item-icon"
                aria-hidden="true"
              />
            )}
            <span className="gl-sidebar-item-label">收起导航</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
