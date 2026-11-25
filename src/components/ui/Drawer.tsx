"use client";

import type React from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useOverlayDialog } from "./useOverlayDialog";

export type DrawerSide = "right" | "left";
export type DrawerSize = "sm" | "md" | "lg";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: DrawerSide;
  size?: DrawerSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  hideCloseButton?: boolean;
  zIndex?: number;
  id?: string;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  side = "right",
  size = "md",
  footer,
  children,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  hideCloseButton = false,
  zIndex,
  id,
  className,
}: DrawerProps) {
  const autoId = useId();
  const titleId = `${autoId}-title`;
  const descId = `${autoId}-desc`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropPressRef = useRef(false);

  const { isClient } = useOverlayDialog({
    open,
    onClose,
    closeOnEsc,
    panelRef,
  });

  if (!open || !isClient) {
    return null;
  }

  return createPortal(
    <div
      className={`gl-overlay-backdrop gl-overlay-backdrop--drawer gl-overlay-backdrop--${side}`}
      style={zIndex !== undefined ? { zIndex } : undefined}
      onMouseDown={(event) => {
        backdropPressRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          closeOnBackdropClick &&
          backdropPressRef.current &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
        backdropPressRef.current = false;
      }}
    >
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={[
          "gl-drawer",
          `gl-drawer--${side}`,
          `gl-drawer--${size}`,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="gl-drawer-header">
          <div className="gl-drawer-heading">
            <h2 id={titleId} className="gl-drawer-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="gl-drawer-description">
                {description}
              </p>
            )}
          </div>
          {!hideCloseButton && (
            <IconButton
              icon={<X size={18} strokeWidth={2} />}
              ariaLabel="关闭抽屉"
              size="sm"
              variant="ghost"
              className="gl-drawer-close"
              onClick={onClose}
            />
          )}
        </div>

        <div className="gl-drawer-body">{children}</div>

        {footer && <div className="gl-drawer-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export default Drawer;
