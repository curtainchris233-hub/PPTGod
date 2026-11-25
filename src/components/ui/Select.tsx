"use client";

import type React from "react";
import { useId } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectVariant = "default" | "compact" | "pill";
export type SelectSize = "sm" | "md";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hideLabel?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  variant?: SelectVariant;
  size?: SelectSize;
  leftIcon?: React.ReactNode;
  error?: string;
  helperText?: string;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLSelectElement>;
}

export function Select({
  id,
  label,
  hideLabel = false,
  options,
  placeholder,
  variant = "default",
  size = "md",
  leftIcon,
  error,
  helperText,
  wrapperClassName,
  className,
  disabled,
  required,
  children,
  "aria-describedby": ariaDescribedBy,
  ref,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const isInline = variant === "compact" || variant === "pill";
  const describedBy = [
    error ? errorId : undefined,
    !isInline && !error && helperText ? helperId : undefined,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  const control = (
    <div
      className={[
        "gl-select-control",
        `gl-select-control--${variant}`,
        `gl-select-control--${size}`,
        leftIcon ? "has-left-icon" : "",
        error ? "is-error" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {leftIcon && (
        <span className="gl-select-left-icon" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <select
        ref={ref}
        id={selectId}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy || undefined}
        className={["gl-select", className ?? ""].filter(Boolean).join(" ")}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={2}
        className="gl-select-chevron"
        aria-hidden="true"
      />
    </div>
  );

  if (isInline) {
    return (
      <div
        className={[
          "gl-select-inline-wrap",
          error ? "is-error" : "",
          wrapperClassName ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="gl-select-inline">
          {label && (
            <label
              htmlFor={selectId}
              className={hideLabel ? "gl-sr-only" : "gl-select-inline-label"}
            >
              {label}
            </label>
          )}
          {control}
        </div>
        {error && (
          <p id={errorId} className="gl-field-error" role="alert">
            <AlertCircle size={13} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "gl-field",
        error ? "is-error" : "",
        disabled ? "is-disabled" : "",
        wrapperClassName ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label
          htmlFor={selectId}
          className={hideLabel ? "gl-sr-only" : "gl-field-label"}
        >
          <span>{label}</span>
          {required && (
            <span className="gl-field-required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} className="gl-field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="gl-field-helper">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default Select;
