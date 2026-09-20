"use client";

import { AnimatePresence, motion } from "motion/react";
import { CloseIcon } from "./icons";

/**
 * The shared shell for every summoned surface.
 *
 * Panels enter from the edge and stay narrow so the reading canvas behind them
 * remains visible — the reader should always be able to see what they were
 * reading while they consult something about it.
 */
export function MetaPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
  side = "end",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  side?: "start" | "end";
}) {
  const fromRight = side === "end";

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key={title}
          role="dialog"
          aria-label={title}
          className="glass fixed top-3 bottom-3 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden"
          style={fromRight ? { right: "0.75rem" } : { left: "0.75rem" }}
          initial={{ opacity: 0, x: fromRight ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: fromRight ? 22 : -22 }}
          // Only opacity and transform animate; the blur radius stays fixed so
          // the panel never forces a per-frame re-rasterisation of its backdrop.
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium tracking-[0.12em] text-gold-100 uppercase">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-gold-300/55">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-gold-200/65 transition-colors hover:bg-gold-400/12 hover:text-gold-100"
            >
              <CloseIcon />
            </button>
          </header>

          <span className="gold-rule mx-5 h-px opacity-45" />

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
