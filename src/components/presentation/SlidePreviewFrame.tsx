"use client";

import type React from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { Button, Skeleton } from "@/components/ui";
import type {
  AnatomyDimension,
  DeckSlideItem,
  SlideType,
  VisualSpec,
} from "@/types/prompt";

export type SlidePreviewRadius = "sm" | "md" | "lg";

export interface SlidePreviewFrameProps {
  /** VisualSpec passed to unchanged SlideCanvas; optional during loading/error */
  spec?: VisualSpec | null;
  slideType?: SlideType;
  topic?: string;
  subtitle?: string;
  audience?: string;
  slideCount?: number;
  englishTitle?: string;
  scenario?: string;
  highlightDimension?: AnatomyDimension | null;
  slideData?: Partial<DeckSlideItem>;
  pageIndex?: number;
  totalPages?: number;
  canvasClassName?: string;

  /** External Glacier frame chrome (strictly outside SlideCanvas) */
  selected?: boolean;
  /** Show circular #2563EB checkmark badge when selected (default: true) */
  showSelectedBadge?: boolean;
  /** Honest boundary B9: marks preview as sample before generation */
  isSample?: boolean;
  sampleLabel?: string;
  /** Optional custom top-left chrome slot (e.g. "01 商务专业" or page badge) */
  topLeftBadge?: React.ReactNode;
  /** Optional hover / focus-within action bar (e.g. "预览" / "使用风格") */
  overlayActions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  radius?: SlidePreviewRadius;
  interactive?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SlidePreviewFrame({
  spec,
  slideType = "cover",
  topic = "",
  subtitle = "",
  audience,
  slideCount,
  englishTitle,
  scenario,
  highlightDimension,
  slideData,
  pageIndex,
  totalPages,
  canvasClassName,
  selected = false,
  showSelectedBadge = true,
  isSample = false,
  sampleLabel = "示例预览",
  topLeftBadge,
  overlayActions,
  loading = false,
  error = null,
  onRetry,
  radius = "md",
  interactive = false,
  ariaLabel,
  className,
}: SlidePreviewFrameProps) {
  const frameClasses = [
    "gl-slide-frame",
    `gl-slide-frame--radius-${radius}`,
    interactive ? "gl-slide-frame--interactive" : "",
    selected ? "is-selected" : "",
    error ? "is-error" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={frameClasses}
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      data-selected={selected ? "true" : undefined}
    >
      <div className="gl-slide-viewport">
        {loading ? (
          <Skeleton variant="slide" ariaLabel="正在加载幻灯片预览" />
        ) : error || !spec ? (
          <div className="gl-slide-fallback" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <p className="gl-slide-fallback-text">
              {error || "暂无法加载幻灯片预览"}
            </p>
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw size={13} />}
                onClick={onRetry}
              >
                重新加载
              </Button>
            )}
          </div>
        ) : (
          <SlideCanvas
            spec={spec}
            slideType={slideType}
            topic={topic}
            subtitle={subtitle}
            audience={audience}
            slideCount={slideCount}
            englishTitle={englishTitle}
            scenario={scenario}
            highlightDimension={highlightDimension}
            slideData={slideData}
            pageIndex={pageIndex}
            totalPages={totalPages}
            className={canvasClassName}
          />
        )}
      </div>

      {(topLeftBadge || isSample) && !loading && (
        <div className="gl-slide-chrome-tl">
          {topLeftBadge}
          {isSample && (
            <span className="gl-slide-sample-badge">{sampleLabel}</span>
          )}
        </div>
      )}

      {selected && showSelectedBadge && (
        <span className="gl-slide-selected-badge" aria-hidden="true">
          <Check size={13} strokeWidth={2.75} />
        </span>
      )}

      {overlayActions && !loading && !error && (
        <div className="gl-slide-overlay-actions">{overlayActions}</div>
      )}
    </div>
  );
}

export default SlidePreviewFrame;
