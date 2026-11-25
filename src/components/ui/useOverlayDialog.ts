"use client";

import type React from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";

export interface UseOverlayDialogOptions {
  open: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const emptySubscribe = () => () => {};

let openOverlayCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
const overlayStack: symbol[] = [];

function lockBodyScroll() {
  if (openOverlayCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPadding =
        Number.parseFloat(
          window.getComputedStyle(document.body).paddingRight
        ) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  }
  openOverlayCount += 1;
}

function unlockBodyScroll() {
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
  }
}

function getVisibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return el.offsetParent !== null || el.getClientRects().length > 0;
  });
}

export function useOverlayDialog({
  open,
  onClose,
  closeOnEsc = true,
  panelRef,
}: UseOverlayDialogOptions): { isClient: boolean } {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const overlayToken = Symbol("gl-overlay");
    overlayStack.push(overlayToken);
    lockBodyScroll();

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const rafId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(document.activeElement)) return;
      const focusables = getVisibleFocusables(panel);
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      } else {
        panel.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== overlayToken) {
        return;
      }

      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = getVisibleFocusables(panel);
        if (focusables.length === 0) {
          event.preventDefault();
          panel.focus({ preventScroll: true });
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !panel.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !panel.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);

      const idx = overlayStack.lastIndexOf(overlayToken);
      if (idx >= 0) {
        overlayStack.splice(idx, 1);
      }
      unlockBodyScroll();

      if (previouslyFocused && previouslyFocused.isConnected) {
        const currentActive = document.activeElement;
        const insideAnotherDialog =
          currentActive instanceof HTMLElement &&
          Boolean(currentActive.closest('[role="dialog"]'));
        if (!insideAnotherDialog) {
          previouslyFocused.focus({ preventScroll: true });
        }
      }
    };
  }, [open, closeOnEsc, panelRef]);

  return { isClient };
}
