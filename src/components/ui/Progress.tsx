"use client";

import type React from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export type ProgressStatus = "running" | "success" | "error";

export interface ProgressProps {
  /** Honest human-readable current stage, e.g. "正在生成结构化大纲…" */
  stageLabel: string;
  /** Optional honest supporting note */
  detail?: string;
  /** Optional real discrete stage text (e.g. "阶段 1 / 2"), NEVER fabricated "%" */
  stepInfo?: string;
  status?: ProgressStatus;
  onRetry?: () => void;
  retryLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
}

export function Progress({
  stageLabel,
  detail,
  stepInfo,
  status = "running",
  onRetry,
  retryLabel = "重新尝试",
  onCancel,
  cancelLabel = "取消",
  className,
}: ProgressProps) {
  const isError = status === "error";
  const isRunning = status === "running";

  return (
    <div
      className={[
        "gl-progress",
        `gl-progress--${status}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div className="gl-progress-head">
        <div className="gl-progress-stage">
          {isRunning && (
            <Loader2
              size={16}
              className="gl-spin gl-progress-icon"
              aria-hidden="true"
            />
          )}
          {status === "success" && (
            <CheckCircle2
              size={16}
              className="gl-progress-icon"
              aria-hidden="true"
            />
          )}
          {isError && (
            <AlertCircle
              size={16}
              className="gl-progress-icon"
              aria-hidden="true"
            />
          )}
          <span className="gl-progress-label">{stageLabel}</span>
        </div>
        {stepInfo && <span className="gl-progress-step">{stepInfo}</span>}
      </div>

      <div
        className="gl-progress-track"
        role="progressbar"
        aria-label={stageLabel}
        aria-busy={isRunning || undefined}
      >
        <div
          className={[
            "gl-progress-bar",
            isRunning ? "gl-progress-bar--indeterminate" : "",
            status === "success" ? "gl-progress-bar--success" : "",
            isError ? "gl-progress-bar--error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>

      {detail && <p className="gl-progress-detail">{detail}</p>}

      {((isError && onRetry) || onCancel) && (
        <div className="gl-progress-actions">
          {isError && onRetry && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default Progress;
