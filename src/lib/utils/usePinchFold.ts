"use client";

import { useEffect, useRef } from "react";

/**
 * A two-finger pinch on the reading surface, isolated from
 * `useSwipeNavigation` on purpose: that hook only ever inspects the one
 * `pointerId` it is tracking and ignores every other pointer, so a second
 * finger touching down cannot desync it — which means this hook can listen
 * on the same element with its own independent pointer map and never fight
 * the swipe gesture for state.
 *
 * Deliberately narrow: it detects "two fingers moved together" and fires
 * once per gesture. It does not attempt to render a live split-screen fold
 * as the fingers move — that would need new page-layout code with no way to
 * verify it renders correctly on a real touchscreen, so the gesture instead
 * opens the already-working symmetry lens for the current sūrah, which
 * *is* the fold, just not painted between the two fingers.
 */

/** Fingers must close to this fraction of their starting distance to count. */
const PINCH_RATIO = 0.65;
/** Below this starting distance a "pinch" is probably two fingers already close together by accident. */
const MIN_START_DISTANCE = 40;

export function usePinchFold(
  surface: React.RefObject<HTMLElement | null>,
  onPinch: () => void,
  enabled = true,
) {
  const onPinchRef = useRef(onPinch);
  onPinchRef.current = onPinch;

  useEffect(() => {
    const element = surface.current;
    if (!element || !enabled) return;

    const points = new Map<number, { x: number; y: number }>();
    let startDistance = 0;
    let fired = false;

    const distance = () => {
      const [a, b] = [...points.values()];
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size === 2) {
        startDistance = distance();
        fired = false;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size !== 2 || fired || startDistance < MIN_START_DISTANCE) return;

      if (distance() / startDistance <= PINCH_RATIO) {
        fired = true;
        onPinchRef.current();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      points.delete(event.pointerId);
      if (points.size < 2) {
        startDistance = 0;
        fired = false;
      }
    };

    // Not `passive: false` / preventDefault: a two-finger touch that turns
    // out not to be a pinch should not have blocked anything else from
    // happening with it.
    element.addEventListener("pointerdown", onPointerDown, { passive: true });
    element.addEventListener("pointermove", onPointerMove, { passive: true });
    element.addEventListener("pointerup", onPointerEnd, { passive: true });
    element.addEventListener("pointercancel", onPointerEnd, { passive: true });

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerEnd);
      element.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [surface, enabled]);
}
