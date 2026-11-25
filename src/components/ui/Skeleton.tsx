import type React from "react";

export type SkeletonVariant = "card" | "slide" | "row" | "stat" | "text";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  width?: string | number;
  height?: string | number;
  ariaLabel?: string;
  className?: string;
}

export function Skeleton({
  variant = "text",
  count = 1,
  width,
  height,
  ariaLabel = "正在加载内容",
  className,
}: SkeletonProps) {
  const safeCount = Math.max(1, Math.min(20, Math.floor(count)));
  const items = Array.from({ length: safeCount }, (_, index) => index);

  const customStyle: React.CSSProperties | undefined =
    width !== undefined || height !== undefined
      ? { width, height }
      : undefined;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      className={[
        "gl-skeleton-group",
        `gl-skeleton-group--${variant}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="gl-sr-only">{ariaLabel}</span>

      {variant === "slide" &&
        items.map((idx) => (
          <div
            key={idx}
            className="gl-skeleton-block gl-skeleton-slide"
            style={customStyle}
            aria-hidden="true"
          />
        ))}

      {variant === "card" &&
        items.map((idx) => (
          <div
            key={idx}
            className="gl-skeleton-card"
            style={customStyle}
            aria-hidden="true"
          >
            <div className="gl-skeleton-block gl-skeleton-slide" />
            <div className="gl-skeleton-card-body">
              <div className="gl-skeleton-block gl-skeleton-line gl-skeleton-line--title" />
              <div className="gl-skeleton-card-tags">
                <div className="gl-skeleton-block gl-skeleton-pill" />
                <div className="gl-skeleton-block gl-skeleton-pill gl-skeleton-pill--wide" />
              </div>
            </div>
          </div>
        ))}

      {variant === "row" &&
        items.map((idx) => (
          <div
            key={idx}
            className="gl-skeleton-row"
            style={customStyle}
            aria-hidden="true"
          >
            <div className="gl-skeleton-block gl-skeleton-row-thumb" />
            <div className="gl-skeleton-row-lines">
              <div className="gl-skeleton-block gl-skeleton-line gl-skeleton-line--title" />
              <div className="gl-skeleton-block gl-skeleton-line gl-skeleton-line--sub" />
            </div>
          </div>
        ))}

      {variant === "stat" &&
        items.map((idx) => (
          <div
            key={idx}
            className="gl-skeleton-stat"
            style={customStyle}
            aria-hidden="true"
          >
            <div className="gl-skeleton-block gl-skeleton-line gl-skeleton-line--sub" />
            <div className="gl-skeleton-block gl-skeleton-stat-num" />
          </div>
        ))}

      {variant === "text" &&
        items.map((idx) => {
          const isShortTail = safeCount > 1 && idx === safeCount - 1;
          return (
            <div
              key={idx}
              className={`gl-skeleton-block gl-skeleton-line ${
                isShortTail ? "gl-skeleton-line--tail" : ""
              }`}
              style={customStyle}
              aria-hidden="true"
            />
          );
        })}
    </div>
  );
}

export default Skeleton;
