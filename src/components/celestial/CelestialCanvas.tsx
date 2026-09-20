"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AmbienceEngine,
  ambienceProfile,
  type AmbienceSignals,
} from "@/lib/ambience/engine";

/**
 * The atmosphere, and the handle the rest of the app uses to disturb it.
 *
 * Nothing here re-renders React when the sky changes. Signals go straight
 * into the engine's numbers, so a reader swiping through pages never pays for
 * a reconciliation because the background reacted.
 */

interface Ambience {
  /** A touch at viewport coordinates sends one ring of light outward. */
  ripple: (x: number, y: number, strength?: number) => void;
  /** Feed the page's measured phonetic texture. */
  setTexture: (texture: Partial<AmbienceSignals>) => void;
  /** Called on any deliberate movement; resets the settling timer. */
  noteActivity: (velocity?: number) => void;
  /** Whether the engine is live, so callers can skip work when it is not. */
  active: boolean;
}

const AmbienceContext = createContext<Ambience>({
  ripple: () => {},
  setTexture: () => {},
  noteActivity: () => {},
  active: false,
});

export function useAmbience() {
  return useContext(AmbienceContext);
}

/** Seconds of stillness before the sanctuary is considered fully settled. */
const SETTLE_SECONDS = 26;

export function CelestialCanvas({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AmbienceEngine | null>(null);
  const lastActivityRef = useRef(performance.now());
  const velocityRef = useRef(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    // Motion here is decorative; a reader who has asked for less of it gets a
    // still field rather than none, so the page keeps its depth.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;

    let engine: AmbienceEngine;
    try {
      engine = new AmbienceEngine(canvas, ambienceProfile());
    } catch {
      // No WebGL2: the CSS aurora underneath is the whole fallback.
      return;
    }

    engineRef.current = engine;
    setActive(true);
    if (reduceMotion) {
      // One frame, then hold — the sky is present but still.
      engine.setSignals({ calm: 1, velocity: 0 });
      engine.start();
      const hold = window.setTimeout(() => engine.stop(), 400);
      return () => {
        window.clearTimeout(hold);
        engine.dispose();
        engineRef.current = null;
        setActive(false);
      };
    }

    engine.start();

    const onResize = () => engine.resize();
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      engineRef.current = null;
      setActive(false);
    };
  }, [enabled]);

  /**
   * Contemplation breathing.
   *
   * Calm is a function of how long the reader has been still, sampled a few
   * times a second — cheap enough to leave running, and far steadier than
   * trying to infer intent from individual events.
   */
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const still = (performance.now() - lastActivityRef.current) / 1000;
      const calm = Math.min(1, still / SETTLE_SECONDS);
      // Velocity bleeds off on its own, so a single swipe is a pulse rather
      // than a step change.
      velocityRef.current *= 0.82;
      engine.setSignals({ calm, velocity: velocityRef.current });
    }, 220);
    return () => window.clearInterval(timer);
  }, [active]);

  const ripple = useCallback((x: number, y: number, strength = 1) => {
    engineRef.current?.ripple(x, y, strength);
    lastActivityRef.current = performance.now();
  }, []);

  const setTexture = useCallback((texture: Partial<AmbienceSignals>) => {
    engineRef.current?.setSignals(texture);
  }, []);

  const noteActivity = useCallback((velocity = 0) => {
    lastActivityRef.current = performance.now();
    if (velocity !== 0) {
      velocityRef.current = Math.max(-1.6, Math.min(1.6, velocityRef.current + velocity));
    }
  }, []);

  const value = useMemo<Ambience>(
    () => ({ ripple, setTexture, noteActivity, active }),
    [ripple, setTexture, noteActivity, active],
  );

  return (
    <AmbienceContext.Provider value={value}>
      {enabled && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 h-full w-full"
        />
      )}
      {children}
    </AmbienceContext.Provider>
  );
}
