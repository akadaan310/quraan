"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ledger, type LedgerEvent, type LedgerEventKind } from "./db";

/**
 * The reader's own record of their reading, and what the app infers from it.
 *
 * Two rules govern everything here. Nothing is sent anywhere. And nothing
 * inferred is allowed to change the text — only the atmosphere around it, and
 * what the app offers to show next.
 */

export interface LedgerInsights {
  /** Verses this reader keeps returning to, most-dwelt first. */
  dwellLeaders: { verseKey: string; totalMs: number; visits: number }[];
  /** Roots they have looked up most often. */
  lexicalPrism: { root: string; count: number }[];
  /** The verses that shape the resonance centroid. */
  attentionSet: string[];
  /** Total recorded events, for the privacy panel. */
  events: number;
  /** Rolling mean seconds per page — the reader's own tempo. */
  tempo: number;
}

const EMPTY: LedgerInsights = {
  dwellLeaders: [],
  lexicalPrism: [],
  attentionSet: [],
  events: 0,
  tempo: 0,
};

/** A glance is not attention; below this a dwell is not worth recording. */
const MIN_DWELL_MS = 2200;

export function useLedger(enabled: boolean) {
  const ledgerRef = useRef<Ledger | null>(null);
  const [insights, setInsights] = useState<LedgerInsights>(EMPTY);
  const [available, setAvailable] = useState(false);

  const dwellRef = useRef<{ verseKey: string; since: number; page: number } | null>(null);
  const pageEnteredRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void Ledger.open().then(async (ledger) => {
      if (!active || !ledger) return;
      ledgerRef.current = ledger;
      setAvailable(true);
      setInsights(await summarise(ledger));
    });

    return () => {
      active = false;
      ledgerRef.current = null;
    };
  }, [enabled]);

  const record = useCallback(
    (kind: LedgerEventKind, detail: Omit<LedgerEvent, "kind" | "at">) => {
      const ledger = ledgerRef.current;
      if (!ledger) return;
      void ledger.record({ kind, at: Date.now(), ...detail });
    },
    [],
  );

  /**
   * Begin attributing attention to a verse. Calling it again, or with null,
   * closes the previous span — so a reader moving between verses produces one
   * clean dwell each rather than overlapping ones.
   */
  const attendTo = useCallback(
    (verseKey: string | null, page: number) => {
      const previous = dwellRef.current;
      if (previous && previous.verseKey !== verseKey) {
        const dwellMs = performance.now() - previous.since;
        if (dwellMs >= MIN_DWELL_MS) {
          record("verse-dwell", {
            verseKey: previous.verseKey,
            page: previous.page,
            dwellMs: Math.round(dwellMs),
          });
        }
      }
      dwellRef.current = verseKey ? { verseKey, since: performance.now(), page } : null;
    },
    [record],
  );

  const notePage = useCallback(
    (page: number) => {
      const elapsed = performance.now() - pageEnteredRef.current;
      pageEnteredRef.current = performance.now();
      record("page-view", { page, dwellMs: Math.round(elapsed) });
    },
    [record],
  );

  const refresh = useCallback(async () => {
    const ledger = ledgerRef.current;
    if (!ledger) return;
    setInsights(await summarise(ledger));
  }, []);

  const forget = useCallback(async () => {
    const ledger = ledgerRef.current;
    if (!ledger) return;
    await ledger.clear();
    setInsights(EMPTY);
  }, []);

  // Recompute periodically rather than on every event: the insights change
  // slowly, and decrypting the whole ledger is not something to do in a
  // click handler.
  useEffect(() => {
    if (!available) return;
    const timer = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(timer);
  }, [available, refresh]);

  return useMemo(
    () => ({ available, insights, record, attendTo, notePage, refresh, forget }),
    [available, insights, record, attendTo, notePage, refresh, forget],
  );
}

/**
 * Fold the event log into the handful of numbers the UI actually consults.
 *
 * Recent attention counts for more than old: a reader working through a sūrah
 * this week should not be steered by what they were reading last spring. The
 * half-life is three weeks.
 */
async function summarise(ledger: Ledger): Promise<LedgerInsights> {
  const events = await ledger.read();
  const now = Date.now();
  const HALF_LIFE_MS = 21 * 86_400_000;
  const weightAt = (at: number) => Math.pow(0.5, (now - at) / HALF_LIFE_MS);

  const dwell = new Map<string, { totalMs: number; visits: number; weighted: number }>();
  const roots = new Map<string, number>();
  const pageTimes: number[] = [];

  for (const event of events) {
    const weight = weightAt(event.at);

    if (event.kind === "verse-dwell" && event.verseKey && event.dwellMs) {
      const entry = dwell.get(event.verseKey) ?? { totalMs: 0, visits: 0, weighted: 0 };
      entry.totalMs += event.dwellMs;
      entry.visits += 1;
      entry.weighted += event.dwellMs * weight;
      dwell.set(event.verseKey, entry);
      continue;
    }
    if (event.kind === "word-lookup" && event.root) {
      roots.set(event.root, (roots.get(event.root) ?? 0) + weight);
      continue;
    }
    if (event.kind === "page-view" && event.dwellMs) {
      // Ignore spans long enough to be the reader walking away.
      if (event.dwellMs > 1500 && event.dwellMs < 20 * 60_000) {
        pageTimes.push(event.dwellMs);
      }
    }
  }

  const dwellLeaders = [...dwell.entries()]
    .sort((a, b) => b[1].weighted - a[1].weighted)
    .slice(0, 24)
    .map(([verseKey, entry]) => ({
      verseKey,
      totalMs: entry.totalMs,
      visits: entry.visits,
    }));

  const lexicalPrism = [...roots.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([root, count]) => ({ root, count: Math.round(count * 10) / 10 }));

  return {
    dwellLeaders,
    lexicalPrism,
    attentionSet: dwellLeaders.slice(0, 12).map((d) => d.verseKey),
    events: events.length,
    tempo: pageTimes.length
      ? Math.round(pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length / 100) / 10
      : 0,
  };
}
