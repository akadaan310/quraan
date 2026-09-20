"use client";

import { MetaPanel } from "./MetaPanel";
import type { Bookmark } from "@/lib/store/reader";

export function BookmarksPanel({
  open,
  onClose,
  bookmarks,
  onNavigate,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onNavigate: (page: number, verseKey: string) => void;
  onRemove: (verseKey: string) => void;
}) {
  return (
    <MetaPanel
      open={open}
      title="Bookmarks"
      subtitle={bookmarks.length ? `${bookmarks.length} saved` : undefined}
      onClose={onClose}
    >
      {bookmarks.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-gold-300/45">
          Nothing saved yet.
          <br />
          Touch any word to mark where you stopped.
        </p>
      ) : (
        <ul className="space-y-1">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.verseKey} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onNavigate(bookmark.page, bookmark.verseKey);
                  onClose();
                }}
                className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gold-400/10"
              >
                <span className="block truncate text-sm text-ink">
                  {bookmark.label}
                </span>
                <span className="block text-[0.66rem] tabular-nums text-gold-300/45">
                  {bookmark.verseKey} · page {bookmark.page}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(bookmark.verseKey)}
                aria-label={`Remove bookmark at ${bookmark.verseKey}`}
                className="shrink-0 rounded-md px-2 py-1 text-[0.66rem] text-gold-300/0 transition-colors group-hover:text-gold-300/55 hover:!text-gold-100 focus-visible:text-gold-300/70"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </MetaPanel>
  );
}
