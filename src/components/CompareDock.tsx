"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Columns2, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { PromptItem } from "@/types/prompt";

export default function CompareDock() {
  const pathname = usePathname();
  const { compareIds, removeCompare, clearCompare } = useApp();
  const [promptPool, setPromptPool] = useState<PromptItem[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (compareIds.length === 0) return;
    const hasMissing = compareIds.some((id) => !knownIdsRef.current.has(id));
    if (!hasMissing) return;

    let cancelled = false;
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.prompts)) {
          const list = data.prompts as PromptItem[];
          knownIdsRef.current = new Set(list.map((item) => item.id));
          setPromptPool(list);
        }
      })
      .catch(() => {
        // ignore transient network errors; dock stays stable
      });

    return () => {
      cancelled = true;
    };
  }, [compareIds]);

  const items = useMemo(() => {
    const map = new Map(promptPool.map((p) => [p.id, p]));
    return compareIds
      .map((id) => map.get(id))
      .filter((item): item is PromptItem => Boolean(item));
  }, [compareIds, promptPool]);

  if (compareIds.length === 0 || pathname === "/compare") return null;

  const pendingSlots = Math.max(0, compareIds.length - items.length);

  return (
    <aside className="gl-compare-dock" aria-label="已选风格对比栏">
      <div className="gl-compare-dock-inner">
        <div className="gl-compare-dock-label">
          <Columns2 size={16} strokeWidth={2} aria-hidden="true" />
          <span>风格对比</span>
          <span className="gl-compare-dock-count">{compareIds.length}/3</span>
        </div>

        <div className="gl-compare-dock-chips">
          {items.map((item) => (
            <div key={item.id} className="gl-compare-chip">
              <span
                className="gl-compare-dot"
                style={{
                  background: item.visualSpec.palette.bg,
                  borderColor: item.visualSpec.palette.accent,
                }}
                aria-hidden="true"
              />
              <span className="gl-compare-chip-name" title={item.title}>
                {item.title}
              </span>
              <button
                type="button"
                className="gl-compare-chip-remove"
                onClick={() => removeCompare(item.id)}
                aria-label={`移出 ${item.title}`}
              >
                <X size={12} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          ))}

          {Array.from({ length: pendingSlots }, (_, idx) => (
            <span
              key={`pending-${idx}`}
              className="gl-compare-chip gl-compare-chip--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="gl-compare-dock-actions">
          <button
            type="button"
            className="gl-btn gl-btn--ghost gl-btn--sm"
            onClick={clearCompare}
          >
            清空
          </button>
          <Link
            href="/compare"
            className="gl-btn gl-btn--primary gl-btn--sm gl-btn--pill"
            id="pg-dock-open-compare"
          >
            <span>开始并排对比</span>
            <ArrowRight size={14} strokeWidth={2.1} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
