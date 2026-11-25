"use client";

import type React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
  /** Optional override label shown while loading */
  loadingText?: React.ReactNode;
  fullWidth?: boolean;
  selected?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  pill = false,
  loading = false,
  loadingText,
  fullWidth = false,
  selected = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [
    "gl-btn",
    `gl-btn--${variant}`,
    `gl-btn--${size}`,
    pill ? "gl-btn--pill" : "",
    fullWidth ? "gl-btn--full" : "",
    selected ? "is-selected" : "",
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
      aria-busy={loading || undefined}
      className={classes}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={size === "sm" ? 14 : 16}
          className="gl-spin gl-btn-icon"
          aria-hidden="true"
        />
      ) : (
        leftIcon && (
          <span className="gl-btn-icon" aria-hidden="true">
            {leftIcon}
          </span>
        )
      )}
      <span className="gl-btn-label">{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon && (
        <span className="gl-btn-icon" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
}

export default Button;
