"use client";

import {
  BookmarkIcon,
  ChevronIcon,
  CompassIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  TranslateIcon,
} from "./icons";
import type { PanelId } from "@/lib/store/reader";

/**
 * The one piece of permanent chrome.
 *
 * It sits below the page rather than over it, holds nothing but the turn
 * controls and the four meta surfaces, and fades toward the background until
 * the pointer approaches — so the reading canvas is the only thing competing
 * for attention while the reader is reading.
 */
export function MetaDock({
  page,
  lastPage,
  onTurn,
  onJump,
  activePanel,
  onPanel,
  playing,
  onPlayPage,
  canPlay,
}: {
  page: number;
  lastPage: number;
  onTurn: (delta: 1 | -1) => void;
  onJump: (page: number) => void;
  activePanel: PanelId;
  onPanel: (panel: NonNullable<PanelId>) => void;
  playing: boolean;
  onPlayPage: () => void;
  canPlay: boolean;
}) {
  return (
    <div className="relative z-20 flex justify-center px-4 pb-4">
      <div className="glass group flex items-center gap-1 px-2 py-1.5 opacity-70 transition-opacity duration-500 hover:opacity-100 focus-within:opacity-100">
        <DockButton
          label="Previous page"
          onClick={() => onTurn(-1)}
          disabled={page <= 1}
        >
          <ChevronIcon dir="right" />
        </DockButton>

        <label className="flex items-center gap-1.5 px-2">
          <span className="sr-only-text">Go to page</span>
          <input
            type="number"
            min={1}
            max={lastPage}
            value={page}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onJump(next);
            }}
            className="w-11 bg-transparent text-center text-sm tabular-nums text-gold-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[0.64rem] tabular-nums text-gold-300/40">
            / {lastPage}
          </span>
        </label>

        <DockButton
          label="Next page"
          onClick={() => onTurn(1)}
          disabled={page >= lastPage}
        >
          <ChevronIcon dir="left" />
        </DockButton>

        <span className="mx-1.5 h-6 w-px bg-gold-400/20" />

        <DockButton
          label={playing ? "Pause recitation" : "Recite this page"}
          onClick={onPlayPage}
          disabled={!canPlay}
          active={playing}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </DockButton>

        <DockButton
          label="Navigate"
          onClick={() => onPanel("navigator")}
          active={activePanel === "navigator"}
        >
          <CompassIcon />
        </DockButton>

        <DockButton
          label="Translation"
          onClick={() => onPanel("translation")}
          active={activePanel === "translation"}
        >
          <TranslateIcon />
        </DockButton>

        <DockButton
          label="Bookmarks"
          onClick={() => onPanel("bookmarks")}
          active={activePanel === "bookmarks"}
        >
          <BookmarkIcon />
        </DockButton>

        <DockButton
          label="Settings"
          onClick={() => onPanel("settings")}
          active={activePanel === "settings"}
        >
          <SettingsIcon />
        </DockButton>
      </div>
    </div>
  );
}

function DockButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid size-9 place-items-center rounded-lg transition-colors duration-200 disabled:pointer-events-none disabled:opacity-25 ${
        active
          ? "bg-gold-400/20 text-gold-100"
          : "text-gold-200/70 hover:bg-gold-400/12 hover:text-gold-100"
      }`}
    >
      {children}
    </button>
  );
}
