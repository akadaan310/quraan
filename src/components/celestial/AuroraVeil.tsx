"use client";

/**
 * The warm halo the page appears to rest on, plus two slow nebular blooms.
 *
 * Softness is baked into the gradient stops rather than produced with
 * `filter: blur()`: blurring a viewport-sized layer every frame is the most
 * expensive thing this interface could do, and a multi-stop radial gradient is
 * visually indistinguishable at these opacities.
 */
export function AuroraVeil({ enabled }: { enabled: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      {/* The parchment backlight behind the reading surface. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse var(--halo-reach) 58% at 50% 46%,
            rgb(212 172 78 / calc(0.10 * var(--halo-warmth))) 0%,
            rgb(184 137 58 / calc(0.055 * var(--halo-warmth))) 34%,
            rgb(37 45 74 / 0.05) 62%,
            transparent 82%)`,
          transition: "background 2.4s var(--ease-ethereal)",
        }}
      />
      {enabled && (
        <>
          <div
            className="absolute -left-[18%] -top-[22%] h-[70vmax] w-[70vmax] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgb(37 45 74 / 0.5) 0%, rgb(26 32 54 / 0.22) 42%, transparent 70%)",
              animation: "veil-breathe 46s ease-in-out infinite",
              willChange: "transform, opacity",
            }}
          />
          <div
            className="absolute -bottom-[26%] -right-[14%] h-[62vmax] w-[62vmax] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgb(141 100 40 / 0.2) 0%, rgb(18 23 41 / 0.24) 46%, transparent 72%)",
              animation: "veil-breathe 62s ease-in-out infinite reverse",
              willChange: "transform, opacity",
            }}
          />
        </>
      )}
      {/* A fine vignette keeps the eye on the measure of the text. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 96% 82% at 50% 50%, transparent 52%, rgb(5 6 12 / 0.62) 100%)",
        }}
      />
      <style>{`@keyframes veil-breathe{
        0%,100%{transform:scale(1) translate3d(0,0,0);opacity:.72}
        50%{transform:scale(1.13) translate3d(2%,-1.5%,0);opacity:1}
      }`}</style>
    </div>
  );
}
