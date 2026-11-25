import type React from "react";
import Image from "next/image";

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  showGlacierPeaks?: boolean;
  compact?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  showGlacierPeaks = true,
  compact = false,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={[
        "gl-page-header",
        compact ? "gl-page-header--compact" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showGlacierPeaks && (
        <div className="gl-page-header-peaks" aria-hidden="true">
          <Image
            src="/brand/glacier-hero-peaks.svg"
            alt=""
            width={960}
            height={220}
            unoptimized
            priority={false}
            aria-hidden="true"
            className="gl-page-header-peaks-img"
          />
        </div>
      )}

      <div className="gl-page-header-content">
        <div className="gl-page-header-main">
          {icon && (
            <div className="gl-page-header-icon" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="gl-page-header-titles">
            <h1 className="gl-page-header-title">{title}</h1>
            {subtitle && (
              <p className="gl-page-header-subtitle">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="gl-page-header-actions">{actions}</div>}
      </div>
    </section>
  );
}

export default PageHeader;
