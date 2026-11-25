"use client";

import type React from "react";
import { useId, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export type InputSize = "sm" | "md" | "lg";

interface SharedFieldProps {
  label?: string;
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  showCount?: boolean;
  loading?: boolean;
  wrapperClassName?: string;
}

export interface TextInputProps
  extends SharedFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  ref?: React.Ref<HTMLInputElement>;
}

export interface TextareaProps
  extends SharedFieldProps,
    React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  resize?: "none" | "vertical" | "auto";
  /** Renders character counter inside bottom-right of textarea frame (PNG-3 style) */
  counterPosition?: "inside" | "footer";
  ref?: React.Ref<HTMLTextAreaElement>;
}

function getCounterTone(charLen: number, maxLength?: number): string {
  if (!maxLength || maxLength <= 0) return "";
  if (charLen >= maxLength) return "is-over-limit";
  if (charLen / maxLength >= 0.9) return "is-near-limit";
  return "";
}

export function TextInput({
  id,
  label,
  hideLabel = false,
  error,
  helperText,
  leftIcon,
  rightAdornment,
  showCount = false,
  loading = false,
  size = "md",
  wrapperClassName,
  className,
  disabled,
  required,
  maxLength,
  value,
  defaultValue,
  onChange,
  "aria-describedby": ariaDescribedBy,
  ref,
  ...rest
}: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const [uncontrolledLen, setUncontrolledLen] = useState(
    () => String(defaultValue ?? "").length
  );
  const isControlled = value !== undefined;
  const charLen = isControlled ? String(value).length : uncontrolledLen;

  const describedBy = [
    error ? errorId : undefined,
    !error && helperText ? helperId : undefined,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setUncontrolledLen(event.target.value.length);
    }
    onChange?.(event);
  };

  const counterTone = getCounterTone(charLen, maxLength);

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
          htmlFor={inputId}
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

      <div
        className={[
          "gl-input-wrap",
          `gl-input-wrap--${size}`,
          leftIcon ? "has-left-icon" : "",
          rightAdornment || loading ? "has-right-adornment" : "",
          error ? "is-error" : "",
          disabled ? "is-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leftIcon && (
          <span className="gl-input-icon gl-input-icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-invalid={Boolean(error) || undefined}
          aria-busy={loading || undefined}
          aria-describedby={describedBy || undefined}
          className={["gl-input", className ?? ""].filter(Boolean).join(" ")}
          {...rest}
        />
        {(loading || rightAdornment) && (
          <span className="gl-input-adornment">
            {loading && (
              <Loader2 size={15} className="gl-spin" aria-hidden="true" />
            )}
            {rightAdornment}
          </span>
        )}
      </div>

      {(error || helperText || showCount) && (
        <div className="gl-field-meta">
          <div className="gl-field-message">
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
          {showCount && (
            <span className={`gl-field-counter ${counterTone}`}>
              {maxLength ? `${charLen} / ${maxLength}` : `${charLen}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Textarea({
  id,
  label,
  hideLabel = false,
  error,
  helperText,
  leftIcon,
  rightAdornment,
  showCount = false,
  loading = false,
  resize = "vertical",
  counterPosition = "inside",
  wrapperClassName,
  className,
  disabled,
  required,
  maxLength,
  value,
  defaultValue,
  onChange,
  "aria-describedby": ariaDescribedBy,
  ref,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;

  const [uncontrolledLen, setUncontrolledLen] = useState(
    () => String(defaultValue ?? "").length
  );
  const isControlled = value !== undefined;
  const charLen = isControlled ? String(value).length : uncontrolledLen;

  const describedBy = [
    error ? errorId : undefined,
    !error && helperText ? helperId : undefined,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) {
      setUncontrolledLen(event.target.value.length);
    }
    onChange?.(event);
  };

  const counterTone = getCounterTone(charLen, maxLength);
  const showInsideCount = showCount && counterPosition === "inside";
  const showFooterCount = showCount && counterPosition === "footer";

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
          htmlFor={textareaId}
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

      <div
        className={[
          "gl-textarea-wrap",
          leftIcon ? "has-left-icon" : "",
          showInsideCount ? "has-inside-counter" : "",
          error ? "is-error" : "",
          disabled ? "is-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leftIcon && (
          <span className="gl-textarea-icon" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-invalid={Boolean(error) || undefined}
          aria-busy={loading || undefined}
          aria-describedby={describedBy || undefined}
          className={[
            "gl-textarea",
            `gl-textarea--resize-${resize}`,
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {(loading || rightAdornment) && (
          <span className="gl-textarea-top-adornment">
            {loading && (
              <Loader2 size={15} className="gl-spin" aria-hidden="true" />
            )}
            {rightAdornment}
          </span>
        )}
        {showInsideCount && (
          <span
            className={`gl-field-counter gl-field-counter--inside ${counterTone}`}
            aria-hidden="true"
          >
            {maxLength ? `${charLen} / ${maxLength}` : `${charLen}`}
          </span>
        )}
      </div>

      {(error || helperText || showFooterCount) && (
        <div className="gl-field-meta">
          <div className="gl-field-message">
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
          {showFooterCount && (
            <span className={`gl-field-counter ${counterTone}`}>
              {maxLength ? `${charLen} / ${maxLength}` : `${charLen}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
