"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient starlight.
 *
 * A star field does not need a frame loop: the stars never move relative to
 * one another, only the field drifts. So we rasterise the field once into a
 * seamlessly tileable bitmap and hand it to CSS, which drifts three parallax
 * copies of it with nothing but `transform`. After the initial bake no
 * JavaScript runs at all and the animation lives entirely on the compositor,
 * which is what keeps the reading canvas free of jank.
 */

const TILE = 512;

interface Layer {
  className: string;
  size: number;
  opacity: number;
  duration: number;
  reverse: boolean;
}

const LAYERS: Layer[] = [
  { className: "far", size: 512, opacity: 0.5, duration: 420, reverse: false },
  { className: "mid", size: 384, opacity: 0.32, duration: 260, reverse: true },
  { className: "near", size: 256, opacity: 0.18, duration: 150, reverse: false },
];

/**
 * Paint a tile whose stars wrap at the edges. Every mote is drawn up to four
 * times — once for each edge it overlaps — so the repeat seam is invisible.
 */
function bakeTile(count: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * TILE;
    const y = Math.random() * TILE;
    // Nine in ten are faint motes; the rest carry the field's few bright points.
    const bright = Math.random() > 0.9;
    const radius = bright ? Math.random() * 1.6 + 0.9 : Math.random() * 0.8 + 0.3;

    ctx.globalAlpha = bright
      ? 0.55 + Math.random() * 0.4
      : 0.14 + Math.random() * 0.4;
    // Warm white, so the stars belong to the same light as the gold rims.
    ctx.fillStyle = bright ? "#fdf3d7" : "#dcd8cc";

    for (const dx of [0, x < radius ? TILE : 0, x > TILE - radius ? -TILE : 0]) {
      for (const dy of [
        0,
        y < radius ? TILE : 0,
        y > TILE - radius ? -TILE : 0,
      ]) {
        if ((dx !== 0 || dy !== 0) && dx === dy && dx === 0) continue;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL("image/png");
}

export function Starfield({ enabled }: { enabled: boolean }) {
  const [tile, setTile] = useState<string | null>(null);
  const [lite, setLite] = useState(false);
  const baked = useRef(false);

  useEffect(() => {
    if (!enabled || baked.current) return;
    baked.current = true;

    // A device that is short on cores or memory gets one layer, not three.
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    if (nav.connection?.saveData) return;
    const weak =
      (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    setLite(weak);

    // Bake off the critical path — the Muṣḥaf must paint first.
    const schedule =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    schedule(() => setTile(bakeTile(weak ? 90 : 190)));
  }, [enabled]);

  /**
   * Compositor work on a hidden tab is pure waste; pause every drift when the
   * document is not visible.
   */
  useEffect(() => {
    if (!tile) return;
    const onVisibility = () => {
      for (const el of document.querySelectorAll<HTMLElement>("[data-star-layer]")) {
        for (const animation of el.getAnimations()) {
          if (document.hidden) animation.pause();
          else animation.play();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tile]);

  if (!enabled || !tile) return null;
  const layers = lite ? LAYERS.slice(0, 1) : LAYERS;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ opacity: "var(--star-opacity)" }}
    >
      {layers.map((layer) => (
        <div
          key={layer.className}
          data-star-layer
          className="absolute"
          style={{
            // Overscan so the tile wrap never reaches a visible edge.
            inset: "-30%",
            backgroundImage: `url(${tile})`,
            backgroundRepeat: "repeat",
            backgroundSize: `${layer.size}px ${layer.size}px`,
            opacity: layer.opacity,
            willChange: "transform",
            contain: "strict",
            backfaceVisibility: "hidden",
            // Drifting by exactly one tile keeps the loop seamless.
            animation: `star-drift-${layer.size} ${layer.duration}s linear infinite${
              layer.reverse ? " reverse" : ""
            }`,
          }}
        />
      ))}
      <style>{LAYERS.map(
        (l) => `@keyframes star-drift-${l.size}{from{transform:translate3d(0,0,0)}to{transform:translate3d(-${l.size}px,-${l.size / 2}px,0)}}`,
      ).join("")}</style>
    </div>
  );
}
