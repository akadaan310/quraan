# Session handoff — deep-layer engine

Written at the end of the session that added Parts 2–4 of the "living Muṣḥaf"
brief on top of the production baseline. Read this before continuing; the
**Where it actually stands** section is the part that matters, because several
things are written and typechecked but *not yet running*.

Branch: `claude/celestial-mushaf-reader-ui-nbxyn1`

---

## Where it actually stands

### Verified working

| | Evidence |
|---|---|
| Baseline reader, all 604 pages | Unchanged from previous session; re-verified this session |
| Mobile render at 390×844 | 15 lines, 144 words, **0 console errors**, screenshot in `docs/screens/mobile-page-50.jpg` |
| Auto-hiding dock | Withdrew on idle in the mobile check |
| Data pipeline, end to end | `node scripts/bake-corpus.mjs` produced all 610 files |
| Morphology ↔ reader alignment | 107 verses sampled across the Muṣḥaf, **0 mismatches** |
| Embedding quality | Spot-checked; see "Why the embeddings are trustworthy" below |
| Typecheck and production build | Both clean |

### Written, typechecked, **never executed**

Nothing below has been run in a browser even once. Treat all of it as
unverified code.

- **`CelestialCanvas` is not mounted anywhere.** Only `useAmbience()` is
  imported, so it resolves to the no-op default context. Consequence: no WebGL
  background, no touch ripples, no contemplation breathing. The app correctly
  falls back to the CSS `AuroraVeil`, which is why the mobile check was clean —
  it never exercised the engine. **This is the single highest-value next step.**
- The whole WebGL engine (`src/lib/ambience/`) — shaders have never been
  compiled by a driver. Expect GLSL errors on first run.
- Swipe navigation (`useSwipeNavigation`) — never touched with a real finger.
- The encrypted ledger (`src/lib/ledger/`) — never opened an IndexedDB.
- The semantic worker (`src/workers/semantic.worker.ts`) — never spawned.
  Note the Next.js `new Worker(new URL(...))` pattern is used; confirm it
  bundles correctly in the production build.
- All three deep-layer UIs (`src/components/deep/`) — never rendered.

### Not started

- **PWA / offline.** No manifest, no service worker. The brief's
  "offline-first" requirement is unmet: the data files exist and are
  cache-friendly, but nothing caches them.
- Safe-area insets are applied in the dock and deep panels only; the reader
  shell has not been audited for notches.
- `src/components/celestial/Starfield.tsx` is now **orphaned** — no importers.
  Delete it once `CelestialCanvas` is proven, or restore it as the fallback.

---

## What was added

### Part 2 — adaptive canvas engine (`src/lib/ambience/`, `src/components/celestial/CelestialCanvas.tsx`)

WebGL2, two passes. Nebula is fbm value-noise rendered into a **320 px
offscreen texture at ~12 fps** and upscaled — it breathes over tens of seconds,
so refreshing it every frame is wasted fill rate. Starfield is one `POINTS`
draw with all motion in the vertex shader, so the CPU uploads nothing per frame
but uniforms.

Signals in: `velocity` (page turns), `calm` (rises over 26 s of stillness),
and the page's measured `flow` / `grain` / `brightness` / `rhymeRun` /
`density`. Calm rises slowly and falls fast, so the sanctuary takes a moment to
settle and gives way immediately. Ripples are up to six `vec4`s in a uniform
array, expanding bands in the fragment shader.

`ambienceProfile()` picks star count, fbm octaves and a DPR cap from
`hardwareConcurrency` / `deviceMemory`. Honours `prefers-reduced-motion` (one
frame then hold — present but still) and Data Saver (skipped).

### Part 3 — the four computational layers

All four are **baked at build time** into `public/data/` (8.7 MB, 610 files) by
`scripts/bake-corpus.mjs`. Nothing is computed at runtime.

1. **Semantic vectors.** `scripts/lib/embeddings.mjs`. Verse → triliteral
   roots → PPMI root co-occurrence → truncated eigendecomposition (subspace
   iteration, deterministic seed) → 90-d root vectors → IDF-weighted verse
   vectors → int8. 561 KB for all 6,236 verses.
2. **Morphology.** Quranic Arabic Corpus, parsed by
   `scripts/lib/morphology.mjs`, packed per page by `scripts/lib/pack.mjs`
   (string tables + tag bitmasks) — 8.5 KB a page, down from 23 KB.
3. **Phonetics.** `scripts/lib/phonetics.mjs`. Madd, ghunnah, qalqalah, heavy
   and sibilant rates, plus the rhyme key (fāṣila), per verse and aggregated
   per page.
4. **Symmetry.** `scripts/lib/symmetry.mjs`. Root-overlap Jaccard between the
   nth verse from each end, scored as **lift over a same-sūrah baseline**.

### Part 4 — ledger and personalisation

`src/lib/ledger/` — IndexedDB, AES-GCM, non-extractable key, fresh IV per
record, `at` left in the clear for indexing/compaction. 400-day retention,
20k-row cap. Insights weight recent attention with a **3-week half-life**.
`src/lib/deep/useDeepReader.ts` is the orchestration seam. The privacy panel in
Settings shows the whole profile and erases it in two taps.

---

## Decisions a human needs to make

### 1. Licensing — blocking

The morphology data is the **Quranic Arabic Corpus, which is GNU GPL**. This
repository is MIT. `public/data/morphology/` is a derived work of GPL data now
sitting in an MIT tree. Options:

- relicense the repo (or the data directory) GPL;
- keep the data out of git and make `bake-corpus.mjs` a required setup step —
  but that breaks offline-first for anyone who clones;
- carve out the data in `LICENSE` the way the KFGQPC fonts already are, and
  state the GPL terms explicitly.

**I did the third by default — `README.md` has not been updated yet, so right
now the repo ships GPL data with no attribution. Fix before any publication.**

### 2. Honesty framing — already implemented, worth reviewing

Three places where the brief asked for more than the data supports, and what
was shipped instead:

- **"Dependency graph overlays."** The corpus is morphological, not syntactic —
  there are no head-dependent links. Worse, in glyph mode *each word is a
  single glyph*, so there is no sub-word geometry to anchor an arc to at all.
  Shipped: segment arcs inside the panel (where layout is controllable), and
  roles named from case endings the way I‘rāb is taught. `MorphologyPanel.tsx`
  says so in its header comment.
- **"Vector-space semantics using classical Arabic language models."** No LM is
  used; this is distributional/LSA over roots. The upside is that every link is
  explainable — the constellation names the shared roots — which a neural
  embedding could not do. The UI labels weak links "thematic proximity only".
- **"Ring composition."** There is no authoritative machine-readable dataset.
  Shipped a measurement with an explicit baseline, and the lens says "no
  measurable mirror" for the 85 sūrahs where that is the truth.

If any of these framings is wrong for the product, change it deliberately.

---

## Why the embeddings are trustworthy

Spot-checks that convinced me the vector space is real and not noise:

```
root جنن (garden) → تحت (beneath) جري (flow) نهر (rivers) خلد (eternal) فوز (success)
root رحم (mercy)  → غفر (forgiveness) وهب (bestow) رأف (compassion)
root صلو (prayer) → زكو (zakat) قوم (establish)
```

The first is literally the Qur'anic collocation "gardens beneath which rivers
flow, abiding eternally"; the third is "establish prayer and give zakat".

Symmetry, on Al-Kāfirūn (109): the top pairs are **109:2 ↔ 109:5** and
**109:3 ↔ 109:4**, both on root عبد — its known chiasmus, found without being
told. Note 109 still scores *low overall*, because عبد saturates the whole
sūrah so the baseline is high too. That is the measure being correctly
conservative, and it is why `notable` pairs are surfaced independently of
`strength`.

Phonetics: Al-Fātiḥah's page rhyme resolves to `ين`, page 604's to `اس`, and
604 has the highest sibilance in the Muṣḥaf (الناس، الوسواس، الخناس). All three
are independently checkable and correct.

Distribution: 85 sūrahs "none", 15 "weak", 4 "moderate", 5 "strong". A
suspiciously high strong count would have meant the baseline was broken.

---

## Next steps, in order

1. **Mount `CelestialCanvas`** in `src/app/read/ReaderShell.tsx`, wrapping
   `MushafReader` (the provider must be an ancestor of the `useAmbience()`
   call). Gate on `useReader.getState().ambience`. Then run it and fix the
   GLSL — first-run shader compile errors are near-certain.
2. **Exercise the deep layers in a browser.** Tap a word → grammar panel;
   tap Trace → constellation; dock → symmetry lens. Verify the worker spawns
   under `next build` and not just `next dev`.
3. **Swipe on a real touch device** (or Playwright touch emulation). The
   commit/velocity thresholds in `useSwipeNavigation` are guesses.
4. **PWA.** Manifest, then a service worker: cache-first for `/data/*` and the
   font CDN (both immutable), network-first for HTML. This is what makes the
   8.7 MB of baked data pay off.
5. **Confirm the ledger** actually writes and reads — open devtools →
   Application → IndexedDB and check the rows are opaque.
6. Delete or restore `Starfield.tsx`.
7. Update `README.md` and `docs/RESEARCH.md` for everything above, including
   the GPL attribution.

## Useful commands

```bash
npm run dev
npm run build && npm run start
npm run typecheck
node scripts/bake-corpus.mjs     # regenerates public/data (~4 min, cached in .cache/)
```

`.cache/` holds the morphology download and the page↔verse index so a rebake
does not re-fetch. It is gitignored; the first bake on a fresh clone will
re-download about 6 MB.
