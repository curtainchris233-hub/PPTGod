"use client";

import type React from "react";
import { useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
  /** Optional stable DOM id for E2E compatibility (e.g. #pg-auth-tab-login) */
  htmlId?: string;
  /** Optional aria-controls target panel ID */
  controlsId?: string;
}

export type TabsVariant = "pill" | "segment" | "underline";

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: TabsVariant;
  size?: "sm" | "md";
  fullWidth?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "pill",
  size = "md",
  fullWidth = false,
  ariaLabel,
  id,
  className,
}: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const hasSelectedEnabled = items.some(
    (item) => item.id === value && !item.disabled
  );
  const firstEnabledIndex = items.findIndex((item) => !item.disabled);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const enabledIndices = items
      .map((item, idx) => (item.disabled ? -1 : idx))
      .filter((idx) => idx >= 0);

    if (enabledIndices.length <= 1) return;

    const currentPos = enabledIndices.indexOf(currentIndex);
    let targetIndex: number | null = null;

    if (event.key === "ArrowRight") {
      const nextPos =
        currentPos < 0 ? 0 : (currentPos + 1) % enabledIndices.length;
      targetIndex = enabledIndices[nextPos];
    } else if (event.key === "ArrowLeft") {
      const prevPos =
        currentPos < 0
          ? enabledIndices.length - 1
          : (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
      targetIndex = enabledIndices[prevPos];
    } else if (event.key === "Home") {
      targetIndex = enabledIndices[0];
    } else if (event.key === "End") {
      targetIndex = enabledIndices[enabledIndices.length - 1];
    }

    if (targetIndex !== null) {
      event.preventDefault();
      const targetItem = items[targetIndex];
      if (targetItem) {
        onChange(targetItem.id);
        tabRefs.current[targetIndex]?.focus();
      }
    }
  };

  return (
    <div
      id={id}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={[
        "gl-tabs",
        `gl-tabs--${variant}`,
        `gl-tabs--${size}`,
        fullWidth ? "gl-tabs--full" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item, idx) => {
        const isSelected = item.id === value;
        const isFocusable = hasSelectedEnabled
          ? isSelected
          : idx === firstEnabledIndex;

        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={item.htmlId}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={item.controlsId}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            tabIndex={isFocusable ? 0 : -1}
            className={`gl-tab ${isSelected ? "is-active" : ""}`}
            onClick={() => {
              if (!item.disabled && item.id !== value) {
                onChange(item.id);
              }
            }}
            onKeyDown={(event) => handleKeyDown(event, idx)}
          >
            {item.icon && (
              <span className="gl-tab-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="gl-tab-label">{item.label}</span>
            {item.badge !== undefined && (
              <span className="gl-tab-badge">{item.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
