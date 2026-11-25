"use client";

import type React from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useOverlayDialog } from "./useOverlayDialog";

export type DialogSize = "sm" | "md" | "lg" | "xl";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: DialogSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  hideCloseButton?: boolean;
  id?: string;
  /** Optional stable heading ID (e.g. "pg-auth-title") */
  titleId?: string;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  hideCloseButton = false,
  id,
  titleId,
  className,
}: DialogProps) {
  const autoId = useId();
  const resolvedTitleId = titleId ?? `${autoId}-title`;
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
      className="gl-overlay-backdrop gl-overlay-backdrop--dialog"
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
        aria-labelledby={resolvedTitleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={[
          "gl-dialog",
          `gl-dialog--${size}`,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="gl-dialog-header">
          <div className="gl-dialog-heading">
            <h2 id={resolvedTitleId} className="gl-dialog-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="gl-dialog-description">
                {description}
              </p>
            )}
          </div>
          {!hideCloseButton && (
            <IconButton
              icon={<X size={18} strokeWidth={2} />}
              ariaLabel="关闭窗口"
              size="sm"
              variant="ghost"
              className="gl-dialog-close"
              onClick={onClose}
            />
          )}
        </div>

        <div className="gl-dialog-body">{children}</div>

        {footer && <div className="gl-dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export default Dialog;
