"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Page turning by touch.
 *
 * Built on Pointer Events, so a trackpad drag and a thumb swipe are the same
 * gesture. Three things make it feel like paper rather than a carousel:
 *
 *  - the page follows the finger while the gesture is live, with resistance
 *    at the ends of the Muṣḥaf, so the book's limits are felt not announced;
 *  - a flick commits on *velocity*, not distance, so a short fast swipe turns
 *    the page and a long slow drag that stops short does not;
 *  - the follow is written straight to `transform`, never to React state, so
 *    dragging costs no reconciliation.
 */

interface Options {
  onTurn: (delta: 1 | -1) => void;
  onProgress?: (fraction: number) => void;
  /** Blocks turning past the ends. */
  canGoNext: boolean;
  canGoPrevious: boolean;
  enabled?: boolean;
}

/** Past this fraction of the width, release commits the turn. */
const COMMIT_FRACTION = 0.26;
/** Or past this speed, in px/ms, regardless of distance. */
const COMMIT_VELOCITY = 0.45;
/** Below this the gesture is a tap, and the pill should get it instead. */
const TAP_SLOP = 10;

export function useSwipeNavigation(
  surface: React.RefObject<HTMLElement | null>,
  target: React.RefObject<HTMLElement | null>,
  { onTurn, onProgress, canGoNext, canGoPrevious, enabled = true }: Options,
) {
  // Options change every render; hold them in a ref so listeners bind once.
  const optionsRef = useRef({ onTurn, onProgress, canGoNext, canGoPrevious });
  optionsRef.current = { onTurn, onProgress, canGoNext, canGoPrevious };

  useEffect(() => {
    const element = surface.current;
    if (!element || !enabled) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let dragging = false;
    let decided: "horizontal" | "vertical" | null = null;

    const paint = (dx: number) => {
      const page = target.current;
      if (!page) return;
      page.style.transform = `translate3d(${dx}px,0,0)`;
      page.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (element.clientWidth * 1.6)));
    };

    const release = (animate: boolean) => {
      const page = target.current;
      if (!page) return;
      page.style.transition = animate
        ? "transform 320ms cubic-bezier(.32,.72,0,1), opacity 320ms ease"
        : "";
      page.style.transform = "";
      page.style.opacity = "";
      if (animate) {
        window.setTimeout(() => {
          if (page) page.style.transition = "";
        }, 340);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (pointerId !== null || event.pointerType === "mouse") return;
      // Controls and panels handle their own gestures.
      if ((event.target as HTMLElement).closest("[data-no-swipe]")) return;

      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = event.clientY;
      lastT = event.timeStamp;
      velocity = 0;
      dragging = false;
      decided = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (decided === null) {
        if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
        // A mostly-vertical drag is a scroll somewhere else; let it go.
        decided = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
        if (decided === "vertical") {
          pointerId = null;
          return;
        }
        dragging = true;
        element.setPointerCapture(event.pointerId);
      }

      const dt = event.timeStamp - lastT;
      if (dt > 0) velocity = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastT = event.timeStamp;

      // In a right-to-left book, dragging left moves toward the end.
      const wantsNext = dx < 0;
      const allowed = wantsNext
        ? optionsRef.current.canGoNext
        : optionsRef.current.canGoPrevious;
      // Resistance rather than a hard stop: the end of the book is felt.
      const followed = allowed ? dx : dx * 0.22;

      paint(followed);
      optionsRef.current.onProgress?.(followed / element.clientWidth);
      event.preventDefault();
    };

    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      pointerId = null;
      optionsRef.current.onProgress?.(0);

      if (!dragging) return;
      dragging = false;

      const width = element.clientWidth || 1;
      const far = Math.abs(dx) / width > COMMIT_FRACTION;
      const fast = Math.abs(velocity) > COMMIT_VELOCITY;
      // A flick back the way it came should not commit the turn.
      const consistent = Math.sign(velocity) === Math.sign(dx) || Math.abs(velocity) < 0.1;

      if ((far || fast) && consistent) {
        const delta: 1 | -1 = dx < 0 ? 1 : -1;
        const allowed = delta === 1
          ? optionsRef.current.canGoNext
          : optionsRef.current.canGoPrevious;
        if (allowed) {
          release(false);
          optionsRef.current.onTurn(delta);
          return;
        }
      }
      release(true);
    };

    element.addEventListener("pointerdown", onPointerDown, { passive: true });
    element.addEventListener("pointermove", onPointerMove, { passive: false });
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
    };
  }, [surface, target, enabled]);
}

/**
 * Hide the chrome while the reader is reading.
 *
 * The dock returns on any deliberate touch and after a turn, then withdraws
 * again. Nothing important is ever only behind the hidden state.
 */
export function useAutoHideChrome(idleMs = 3200) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<number | null>(null);

  const wake = useRef(() => {});
  wake.current = () => {
    setVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), idleMs);
  };

  useEffect(() => {
    const onActivity = () => wake.current();
    wake.current();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return { visible, wake: () => wake.current() };
}
