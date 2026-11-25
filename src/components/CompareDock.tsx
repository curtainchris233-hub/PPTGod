"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Columns2, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { PromptItem } from "@/types/prompt";

export default function CompareDock() {
  const pathname = usePathname();
  const { compareIds, removeCompare, clearCompare } = useApp();
  const [promptPool, setPromptPool] = useState<PromptItem[]>([]);

  useEffect(() => {
    if (compareIds.length === 0) return;
    let cancelled = false;
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.prompts)) {
          setPromptPool(data.prompts);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [compareIds.length]);

  const items = useMemo(() => {
    const map = new Map(promptPool.map((p) => [p.id, p]));
    return compareIds
      .map((id) => map.get(id))
      .filter(Boolean) as PromptItem[];
  }, [compareIds, promptPool]);

  if (compareIds.length === 0 || pathname === "/compare") return null;

  return (
    <aside className="pg-compare-dock" aria-label="已选风格对比栏">
      <div className="pg-compare-dock-inner">
        <div className="pg-compare-dock-label">
          <Columns2 size={15} />
          <span>风格对比 ({compareIds.length}/3)</span>
        </div>

        <div className="pg-compare-dock-chips">
          {items.map((item) => (
            <div key={item.id} className="pg-compare-chip">
              <span
                className="pg-compare-dot"
                style={{
                  background: item.visualSpec.palette.bg,
                  borderColor: item.visualSpec.palette.accent,
                }}
              />
              <span className="pg-compare-chip-name">{item.title}</span>
              <button
                type="button"
                className="pg-compare-chip-remove"
                onClick={() => removeCompare(item.id)}
                aria-label={`移出 ${item.title}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="pg-compare-dock-actions">
          <button
            type="button"
            className="pg-btn pg-btn-ghost pg-btn-sm"
            onClick={clearCompare}
          >
            清空
          </button>
          <Link
            href="/compare"
            className="pg-btn pg-btn-primary pg-btn-sm"
            id="pg-dock-open-compare"
          >
            <span>开始并排对比</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
