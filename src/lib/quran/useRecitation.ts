"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AyahAudio } from "./types";

interface Cue {
  verseKey: string;
  position: number;
  startMs: number;
  endMs: number;
}

/**
 * Per-ayah playback with word-level highlighting.
 *
 * Two details matter for the highlight to track the voice:
 *
 *  - Position drives off `requestAnimationFrame` reading `currentTime`, not
 *    the `timeupdate` event, which fires about four times a second and lands
 *    visibly behind the reciter.
 *  - Cues are keyed by the word *position* the feed reports, never by array
 *    index. A measurable share of ayāt ship more or fewer segments than they
 *    have words, and indexing by slot would shift the highlight for the whole
 *    rest of the verse.
 */
export function useRecitation(audio: AyahAudio[]) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const cursorRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [verseKey, setVerseKey] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);

  const byVerse = useMemo(() => {
    const map = new Map<string, { file: AyahAudio; cues: Cue[] }>();
    for (const file of audio) {
      const cues: Cue[] = file.segments
        .map(([wordPosition, startMs, endMs]) => ({
          verseKey: file.verseKey,
          position: wordPosition,
          startMs,
          endMs,
        }))
        .filter((cue) => cue.endMs > cue.startMs)
        .sort((a, b) => a.startMs - b.startMs);
      map.set(file.verseKey, { file, cues });
    }
    return map;
  }, [audio]);

  const order = useMemo(() => audio.map((a) => a.verseKey), [audio]);

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopFrameLoop();
    const element = elementRef.current;
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    setIsPlaying(false);
    setVerseKey(null);
    setPosition(null);
  }, [stopFrameLoop]);

  const play = useCallback(
    (key: string) => {
      const entry = byVerse.get(key);
      if (!entry) return;

      let element = elementRef.current;
      if (!element) {
        element = new Audio();
        element.preload = "auto";
        elementRef.current = element;
      }

      element.src = entry.file.url;
      cursorRef.current = 0;
      setVerseKey(key);
      setPosition(null);

      void element.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false),
      );

      const tick = () => {
        const current = elementRef.current;
        if (!current) return;
        const ms = current.currentTime * 1000;
        const { cues } = entry;

        // Advance a cursor rather than searching; playback is monotonic.
        while (
          cursorRef.current < cues.length &&
          ms > cues[cursorRef.current].endMs
        ) {
          cursorRef.current += 1;
        }
        while (
          cursorRef.current > 0 &&
          ms < cues[cursorRef.current - 1].startMs
        ) {
          cursorRef.current -= 1;
        }

        const cue = cues[cursorRef.current];
        setPosition(cue && ms >= cue.startMs ? cue.position : null);
        frameRef.current = requestAnimationFrame(tick);
      };

      stopFrameLoop();
      frameRef.current = requestAnimationFrame(tick);
    },
    [byVerse, stopFrameLoop],
  );

  /** Continue to the next ayah on the page, then fall silent. */
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const onEnded = () => {
      const index = verseKey ? order.indexOf(verseKey) : -1;
      const next = index >= 0 ? order[index + 1] : undefined;
      if (next) play(next);
      else stop();
    };

    element.addEventListener("ended", onEnded);
    return () => element.removeEventListener("ended", onEnded);
  }, [order, play, stop, verseKey]);

  const pause = useCallback(() => {
    elementRef.current?.pause();
    stopFrameLoop();
    setIsPlaying(false);
  }, [stopFrameLoop]);

  const resume = useCallback(() => {
    if (!verseKey) return;
    void elementRef.current?.play().then(() => setIsPlaying(true));
  }, [verseKey]);

  const toggle = useCallback(
    (key: string) => {
      if (verseKey === key && isPlaying) pause();
      else if (verseKey === key) resume();
      else play(key);
    },
    [isPlaying, pause, play, resume, verseKey],
  );

  useEffect(() => stop, [stop]);

  return { isPlaying, verseKey, position, play, pause, resume, toggle, stop };
}
