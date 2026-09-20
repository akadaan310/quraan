# Phase 1 — Landscape analysis and technical findings

This is the research the reader was built on. Everything marked *measured* was
verified against live endpoints and real font files during the build, not taken
from documentation. Where a finding contradicts the published docs, the
measurement is what the code follows.

---

## 1. How existing platforms render a page-faithful Muṣḥaf

### The glyph-code approach, and why it exists

There are two ways to put Qurʾānic Arabic on a web page.

**Unicode Uthmani** (`text_uthmani`, `text_qpc_hafs`) is real text: selectable,
searchable, read correctly by assistive technology. But the browser decides
where lines break, and browsers disagree with each other about how to stack
Quranic marks. A page-faithful Muṣḥaf is not reachable this way — the printed
line breaks are a property of the edition, not of the text.

**QCF glyph fonts (KFGQPC)** invert the problem. Each of the 604 printed pages
has *its own font file*, in which every word of that page is a single
pre-shaped glyph, already stretched so the line comes out justified. There is
no shaping at runtime, so every engine renders identically.

The cost is severe and worth stating plainly: the glyph codes are **not
characters**. Measured across pages 1, 50 and 604, every page's codes start at
**U+FC41** and increment contiguously — so the identical string renders as
completely different words depending on which page's font is active. Rendering
page N's codes in page M's font paints wrong Qurʾānic text, silently. That is
the single most dangerous failure mode in this domain, and it drives three
decisions in this codebase: fonts are loaded per page by exact family name,
`font-display` is `block` rather than `swap`, and nothing renders in glyph mode
until that page's font is confirmed present.

Font files verified: `p1.woff2` 40,956 B (36 glyphs, U+FC41–U+FC64, upem 2500),
`p50.woff2` 121,960 B (153 glyphs), `p604.woff2` 53,340 B. The full V2 woff2 set
is roughly 94 MB, which settles the hosting question — load per page from a
CDN, never bundle.

### Sūrah titles are a ligature font

`sura_names.woff2` (211 KB, 128 glyphs) resolves a **zero-padded chapter
number** through `liga` substitutions — inspecting its GSUB table shows
`zero + nine + nine → uniE099` and `one + one + four → uniE114`. So rendering
the calligraphic title of al-Baqarah is writing `"002"` with that font and
ligatures enabled. This is why `.surah-name-glyph` is the one place in the
stylesheet where ligatures are turned **on** while every other Arabic surface
turns them off.

### Justification

Two approaches are in use. `text-align: justify` with `text-align-last: justify`
requires a `font-size: 0` hack on the container to suppress inter-element
whitespace. Flexbox `justify-content: space-between` needs no hack, survives
whitespace collapsing, and gives every word its own hit target for free.

This reader uses flexbox — but the more important finding is that **justification
is nearly a no-op if the type is sized correctly**, see §4.

---

## 2. The data layer: where it is trustworthy, and where it is not

### The layout tables disagree with themselves — measured

`api.quran.com/api/v4` serves `line_number` from more than one backing store,
and they do not agree. Identical requests for page 591, minutes apart, returned:

```
lines=[3,4,5,6,7,8,9,12,13,14,15]   surah 86 begins on line 3
lines=[2,3,4,5,6,7,10,11,12,13]     surah 86 begins on line 2
```

A whole line of drift. Since sūrah headers are recovered from the *gaps* in the
line numbering, that drift moves an illuminated header onto an occupied line.
Requests are stable within a burst and differ across bursts, which is the
signature of load-balanced backends carrying different data.

`api.qurancdn.com/api/qdc` — the host the reference client actually uses —
returned the correct layout on every attempt.

**Consequence for this build:** page layout is resolved once at build time
against the qdc host and checked in (`scripts/bake-layout.mjs` →
`src/data/mushaf-layout.json`, 160 KB for all 604 pages). Runtime slices each
page's words into lines using those baked counts. The API is still the source
of the *text*; it is no longer the source of the *layout*.

### `by_page/N` returns words that are not on page N — measured

Words carry their own `v2_page`, and it does not always match the endpoint they
arrived from. On page 591, **25 of 150 returned words are printed on page 592**;
conversely words genuinely on page 600 arrive only from the page-599 endpoint.
The reference client sends `filter_page_words=true` for this; on the public v4
host that parameter is accepted and has **no effect** (measured: still 8 wrong-page
words on page 585 with it set). So the client queries three adjacent endpoints
and keeps exactly the words whose own `v2_page` claims the page.

### Recovering the ornamental lines

The API never emits sūrah headers or the basmala. They are recoverable: a sūrah
opening is always preceded by exactly the blank lines its ornaments occupy —
two where the basmala is printed separately, one for al-Fātiḥah and at-Tawbah
which have none. Validated across all 604 pages.

The validation also surfaced **18 pages with a genuinely blank final line**
(76, 207, 331, 341, 349, 366, 376, 414, 417, 445, 452, 498, 506, 525, 548, 555,
557, 584). On each, a sūrah closes on line 14 and the next one's header will not
fit beneath it, so the printers leave line 15 empty. Page 76 closes 3:200, page
207 closes 9:129, page 584 closes 79:46. These are print, not bugs — the bake
script distinguishes an empty *final* line from an unexplained interior gap.

### Audio timings

`/recitations/{id}/by_page/{n}?fields=segments` returns per-ayah files with
segment tuples `[segmentIndex, wordPosition, startMs, endMs]`, timed against the
ayah's own mp3. Two hazards, both handled in `useRecitation`:

- **Segment count does not reliably equal word count.** A measurable share of
  ayāt ship more or fewer segments than they have words. Cues must therefore be
  keyed by the *word position the tuple reports*, never by array index —
  indexing by slot shifts the highlight for the rest of the verse.
- **Malformed tuples exist in the feed** (stray 1- and 2-element arrays), so
  length is checked rather than trusted.

Highlighting is driven by `requestAnimationFrame` reading `currentTime`, not by
the `timeupdate` event, which fires about four times a second and lands visibly
behind the reciter.

### Juzʾ boundaries

The 30 juzʾ opening pages were verified against the API by resolving each juzʾ's
first verse key to its page: **0 mismatches out of 30**. They are stated as a
constant rather than fetched.

---

## 3. Motion and ambience

### Page turns

Cross-document View Transitions are the wrong tool here, for a specific reason:
a cross-document transition is abandoned if the incoming document does not
render within four seconds, and a documented cause is **web fonts with
`font-display: block`** — exactly what a per-page glyph Muṣḥaf requires. The
transition would race the font load and lose on a cold page. Firefox also lacks
the cross-document implementation.

So the turn is a same-document, dual-buffer crossfade animating **only `opacity`
and `transform`**, which run on the compositor and therefore cannot be stalled
by the font and data work happening on the main thread at the same moment.

Two details that matter more than they look:
- **Scale 1.012 → 1, not 1.05 → 1.** A large scale delta resamples a rasterised
  text layer and softens Arabic diacritics visibly mid-flight.
- **In a right-to-left book the next page arrives from the left.** Motion's `x`
  maps to physical `translateX` regardless of direction, so the sign is negated
  explicitly rather than left to the library.

### Starfield

A drifting star field needs no frame loop: the stars never move relative to one
another, only the field translates. So the field is rasterised **once** into a
seamlessly tileable bitmap (each mote drawn again at every edge it overlaps) and
handed to CSS, which drifts three parallax copies with nothing but `transform`.
After the bake, no JavaScript runs — the animation is entirely compositor work.
Layers pause on `visibilitychange`, drop to one on low-core or low-memory
devices, and are skipped under Data Saver.

### Glass

The failure mode this design invites is a `backdrop-filter` panel sitting over a
continuously animating starfield: the blur re-samples its backdrop every frame
the backdrop changes. Mitigations applied — blur held at 10 px (cost is
superlinear in radius), at most a few blurred surfaces on screen, `contain:
paint` and `isolation: isolate` to bound sampling, and **the blur radius is
never animated** (only opacity and transform are).

The hairline gold rims use a masked gradient ring (`mask-composite: exclude`
with the `-webkit-mask-composite: xor` fallback Safari still needs).
`border-image` was rejected outright: it cannot coexist with `border-radius`.

---

## 4. The finding that shaped the layout

Rendering every line with flex `space-between` at a plausible type size opened
visible gulfs between words that the printed page does not have.

Measuring the natural width of full lines explained why. Over **453 full lines
sampled across 36 pages**, widths run **15.31–16.06 em, median 15.58** — the
only outliers below that band are the short centered lines that close a sūrah.
That is not a coincidence, it is the entire design of the font: the glyphs are
pre-stretched so each line comes out justified.

So the type size is not a free parameter. It is the surface width divided by
that measure. The code uses **16.1 em** — the measured maximum plus a hair —
rather than the median, so the page is exactly as wide as its widest possible
line: nothing can overflow and clip, and justification is left with only a
fraction of an em of designed slack to distribute. (Sizing to the median was
the first attempt, and it clipped the long lines off the edge of the page.)

This also fixes the page's proportion: fifteen lines at a line box of ~1.74 em,
over a measure of 16.1 em, gives a text block of roughly 1 : 1.62 — the
proportion of the printed page. The reader is height-constrained on a landscape
screen and width-constrained on a phone, and the grid survives both.

The reference client solves the same problem with hand-tuned lookup tables of
`vh` and `vw` values per font, per device class, per scale step 1–10, and
abandons the 15-line grid above scale 3 on mobile. Deriving the size from the
measured constant is one rule instead of four tables, and it does not need an
escape hatch.

---

## 5. Centered lines cannot be inferred

The intuitive rule — centre a line if it closes a sūrah — over-centres badly,
because the glyphs carry their own stretch and most sūrah-closing lines still
fill the measure exactly. The genuinely short lines are a small fixed set of the
V2 edition, recorded in `src/lib/quran/centering.ts`, plus the two decorative
opening pages in their entirety.

---

## 6. Accessibility

Glyph fonts produce text that is not text. A screen reader meets U+FC41 and
announces nothing useful; copy yields private-use characters; in-page search
finds nothing.

The accepted mitigation, implemented here: the glyph layer is `aria-hidden` and
non-selectable, and every page also carries the **real Uthmani text** in a
visually-hidden element that remains in the accessibility tree. Each page gets a
screen-reader heading naming its number and juzʾ. Beyond that, a **Unicode text
mode** is offered in settings — it trades the exact line breaks for selectable,
resizable, screen-reader-native script. The page-faithful Muṣḥaf is a visual
feature, not the only way to read.

---

## 7. Where the reader departs from existing platforms

| | Reference clients | This reader |
|---|---|---|
| Page layout | Fetched at runtime from an API whose tables disagree | Resolved at build time, checked in, deterministic |
| Type sizing | Per-font, per-device, per-step lookup tables | One measured constant — the 15.6 em designed measure |
| Centered lines | Hardcoded table | Hardcoded table (no better source exists) |
| Large text | 15-line grid abandoned above a threshold | Grid preserved at every size |
| Meta features | Persistent chrome around the page | Summoned at the point of touch; canvas stays clear |
| Starfield / ambience | — | Baked once, drifts on the compositor, ~0% steady CPU |

## Sources

- Quran.com API v4 · `api.quran.com/api/v4`, and the `api.qurancdn.com/api/qdc`
  host the reference client uses
- Quran Foundation API docs — <https://api-docs.quran.foundation/>
- QUL, the Quranic Universal Library — <https://qul.tarteel.ai>
  (mushaf-layout datasets, segmented recitations)
- `cpfair/quran-align` — upstream of the word-timing data
- KFGQPC font licensing — free to use and distribute, **no modification or
  subsetting**, which is why the fonts are referenced rather than re-cut
- Motion, *Web Animation Performance Tier List* — <https://motion.dev/magazine/web-animation-performance-tier-list>
- MDN — View Transition API, `backdrop-filter`, `mask-composite`
