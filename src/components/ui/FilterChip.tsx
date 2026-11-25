"use client";

import type React from "react";

export type FilterChipVariant = "capsule" | "subtle";

export interface FilterChipProps {
  label: string;
  count?: number;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  variant?: FilterChipVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function FilterChip({
  label,
  count,
  icon,
  selected,
  onClick,
  variant = "capsule",
  size = "md",
  disabled = false,
  id,
  className,
}: FilterChipProps) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={[
        "gl-chip",
        `gl-chip--${variant}`,
        `gl-chip--${size}`,
        selected ? "is-selected" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <span className="gl-chip-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="gl-chip-label">{label}</span>
      {count !== undefined && <span className="gl-chip-count">{count}</span>}
    </button>
  );
}

export default FilterChip;
