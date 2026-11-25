import type React from "react";

export type GlacierPanelVariant = "default" | "solid" | "floating";
export type GlacierPanelPadding = "none" | "sm" | "md" | "lg";
export type GlacierPanelRadius = "lg" | "xl";

export interface GlacierPanelProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  as?: "div" | "section" | "article";
  variant?: GlacierPanelVariant;
  padding?: GlacierPanelPadding;
  radius?: GlacierPanelRadius;
  /** Full custom header override; when provided, title/subtitle/icon/actions are ignored */
  header?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  headingAs?: "h2" | "h3" | "h4";
  /** Optional subtle hover lift (-2px) & elevated shadow */
  interactive?: boolean;
  selected?: boolean;
  error?: boolean;
  children?: React.ReactNode;
}

export function GlacierPanel({
  as = "div",
  variant = "default",
  padding = "md",
  radius = "lg",
  header,
  title,
  subtitle,
  icon,
  actions,
  headingAs = "h2",
  interactive = false,
  selected = false,
  error = false,
  className,
  children,
  ...rest
}: GlacierPanelProps) {
  const Tag = as;
  const HeadingTag = headingAs;
  const hasStructuredHeader = Boolean(title || subtitle || icon || actions);
  const showHeader = Boolean(header) || hasStructuredHeader;

  const classes = [
    "gl-panel",
    `gl-panel--${variant}`,
    `gl-panel--pad-${padding}`,
    `gl-panel--radius-${radius}`,
    interactive ? "gl-panel--interactive" : "",
    selected ? "is-selected" : "",
    error ? "is-error" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {showHeader && (
        <div className="gl-panel-header">
          {header ?? (
            <>
              <div className="gl-panel-title-group">
                {icon && (
                  <span className="gl-panel-icon" aria-hidden="true">
                    {icon}
                  </span>
                )}
                {(title || subtitle) && (
                  <div className="gl-panel-heading-stack">
                    {title && (
                      <HeadingTag className="gl-panel-title">{title}</HeadingTag>
                    )}
                    {subtitle && (
                      <p className="gl-panel-subtitle">{subtitle}</p>
                    )}
                  </div>
                )}
              </div>
              {actions && <div className="gl-panel-actions">{actions}</div>}
            </>
          )}
        </div>
      )}
      {children}
    </Tag>
  );
}

export default GlacierPanel;
