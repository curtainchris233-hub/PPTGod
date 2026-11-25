import type React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  id?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  id,
  className,
}: EmptyStateProps) {
  return (
    <div
      id={id}
      className={[
        "gl-empty",
        compact ? "gl-empty--compact" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <div className="gl-empty-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="gl-empty-title">{title}</h3>
      {description && <p className="gl-empty-desc">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="gl-empty-actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
