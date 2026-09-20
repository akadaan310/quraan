/**
 * A small, consistent icon set. Stroked at 1.5 so the weight sits beside the
 * hairline gold rules rather than competing with them.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PlayIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
  </svg>
);

export const PauseIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M8 4.5v15M16 4.5v15" />
  </svg>
);

export const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} aria-hidden="true">
    <path d="M6.5 3.75h11a.75.75 0 0 1 .75.75v15.3a.4.4 0 0 1-.63.33L12 16.2l-5.62 3.93a.4.4 0 0 1-.63-.33V4.5a.75.75 0 0 1 .75-.75Z" />
  </svg>
);

export const TranslateIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M3.5 5.5h8M7.5 3.5v2M9.5 5.5c0 4-2.6 7.2-6 8.5M5 9.2c1 2.2 3 4 5.5 4.8M13 20.5l4-11 4 11M14.4 17h5.2" />
  </svg>
);

export const CompassIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.75" />
    <path d="M15.2 8.8 13.6 13.6 8.8 15.2l1.6-4.8 4.8-1.6Z" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.75v2.1M12 19.15v2.1M21.25 12h-2.1M4.85 12h-2.1M18.54 5.46l-1.48 1.48M6.94 17.06l-1.48 1.48M18.54 18.54l-1.48-1.48M6.94 6.94 5.46 5.46" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ChevronIcon = ({ dir = "left" }: { dir?: "left" | "right" }) => (
  <svg
    {...base}
    aria-hidden="true"
    style={{ transform: dir === "right" ? "rotate(180deg)" : undefined }}
  >
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);

export const NoteIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M5.25 4.75h13.5v11l-4 4.5h-9.5v-15.5ZM18.25 15.5h-4v4.5" />
  </svg>
);
