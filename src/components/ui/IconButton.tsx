"use client";

import type React from "react";
import { Loader2 } from "lucide-react";

export type IconButtonVariant = "ghost" | "secondary" | "primary" | "danger";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children" | "type"
  > {
  icon: React.ReactNode;
  /** Mandatory accessible name (Spec §7 & §11) */
  ariaLabel: string;
  tooltip?: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  shape?: "rounded" | "circle";
  active?: boolean;
  ariaPressed?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  ref?: React.Ref<HTMLButtonElement>;
}

export function IconButton({
  icon,
  ariaLabel,
  tooltip,
  size = "md",
  variant = "ghost",
  shape = "rounded",
  active = false,
  ariaPressed,
  loading = false,
  disabled,
  type = "button",
  className,
  title,
  onClick,
  ref,
  ...rest
}: IconButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [
    "gl-icon-btn",
    `gl-icon-btn--${variant}`,
    `gl-icon-btn--${size}`,
    `gl-icon-btn--${shape}`,
    active ? "is-active" : "",
    loading ? "is-loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-busy={loading || undefined}
      title={tooltip ? undefined : (title ?? ariaLabel)}
      data-tooltip={tooltip || undefined}
      className={classes}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={size === "sm" ? 15 : 17}
          className="gl-spin"
          aria-hidden="true"
        />
      ) : (
        <span className="gl-icon-btn-glyph" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}

export default IconButton;
