"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ContextAnchor } from "@/lib/store/reader";

export interface PillAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onSelect: () => void;
}

/**
 * The tap-to-summon control.
 *
 * It appears at the point of contact rather than at a fixed edge, so the
 * reading surface is never permanently occupied by controls. Placement is
 * clamped to the viewport and flips above the touch point when there is no
 * room below, so it never covers the line just touched.
 */
export function ContextPill({
  anchor,
  actions,
  caption,
  onDismiss,
}: {
  anchor: ContextAnchor | null;
  actions: PillAction[];
  caption: string;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const dismiss = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return;
      onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    // Deferred so the pointer event that opened the pill does not close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", dismiss);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onDismiss]);

  const placement = anchor ? resolvePlacement(anchor) : null;

  return (
    <AnimatePresence>
      {anchor && placement && (
        <motion.div
          ref={ref}
          key="context-pill"
          role="dialog"
          aria-label={`Actions for verse ${anchor.verseKey}`}
          className="glass fixed z-50 px-1.5 py-1.5"
          style={{
            left: placement.left,
            top: placement.top,
            transform: "translateX(-50%)",
          }}
          initial={{ opacity: 0, scale: 0.92, y: placement.flipped ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: placement.flipped ? 4 : -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-0.5">
            <span className="px-2.5 text-[0.64rem] font-medium tabular-nums tracking-[0.14em] text-gold-300/75">
              {caption}
            </span>
            <span className="mx-1 h-5 w-px bg-gold-400/25" />
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                title={action.label}
                aria-label={action.label}
                aria-pressed={action.active}
                onClick={action.onSelect}
                className={`grid size-9 place-items-center rounded-lg transition-colors duration-200 ${
                  action.active
                    ? "bg-gold-400/20 text-gold-100"
                    : "text-gold-200/70 hover:bg-gold-400/12 hover:text-gold-100"
                }`}
              >
                {action.icon}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const PILL_WIDTH = 260;
const PILL_HEIGHT = 52;
const GAP = 14;

function resolvePlacement(anchor: ContextAnchor) {
  const margin = 12;
  const half = PILL_WIDTH / 2;

  const left = Math.min(
    Math.max(anchor.x, half + margin),
    window.innerWidth - half - margin,
  );

  // Prefer sitting below the touched word; flip above when the bottom of the
  // viewport is too close, so the pill never hides the word it describes.
  const below = anchor.y + GAP;
  const flipped = below + PILL_HEIGHT > window.innerHeight - margin;
  const top = flipped ? anchor.y - PILL_HEIGHT - GAP : below;

  return { left, top: Math.max(margin, top), flipped };
}
