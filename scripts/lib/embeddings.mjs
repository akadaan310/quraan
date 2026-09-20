/**
 * Verse embeddings from triliteral root distribution.
 *
 * What this is, precisely: a distributional (LSA-family) model over Arabic
 * roots. Roots that keep company with the same other roots end up close
 * together; a verse is the weighted centre of its roots. It is *not* a neural
 * language model, and the UI says so — but it is a genuine vector space, it
 * runs entirely on-device, and because every dimension traces back to shared
 * roots, any two verses it links can be explained to the reader rather than
 * merely asserted.
 *
 * Pipeline: verse→roots  →  PPMI root co-occurrence  →  truncated
 * eigendecomposition  →  root vectors  →  IDF-weighted verse vectors.
 */

/** Roots this common carry no thematic signal; they behave like stopwords. */
const MAX_DOC_FREQUENCY = 0.14;
/** A root seen once cannot support a reliable co-occurrence estimate. */
const MIN_OCCURRENCES = 3;

export function buildRootIndex(morphologyByVerse) {
  const verseKeys = Object.keys(morphologyByVerse).sort(compareVerseKeys);
  const rootCounts = new Map();

  const rawVerseRoots = verseKeys.map((key) => {
    const roots = [];
    for (const word of morphologyByVerse[key]) {
      for (const segment of word.segments) {
        if (segment.root) roots.push(segment.root);
      }
    }
    for (const root of new Set(roots)) {
      rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1);
    }
    return roots;
  });

  const total = verseKeys.length;
  const vocabulary = [...rootCounts.entries()]
    .filter(
      ([, count]) => count >= MIN_OCCURRENCES && count / total <= MAX_DOC_FREQUENCY,
    )
    .map(([root]) => root)
    .sort();

  const rootId = new Map(vocabulary.map((root, i) => [root, i]));
  const documentFrequency = new Float64Array(vocabulary.length);
  for (let i = 0; i < vocabulary.length; i += 1) {
    documentFrequency[i] = rootCounts.get(vocabulary[i]);
  }

  const verseRoots = rawVerseRoots.map((roots) =>
    roots.map((r) => rootId.get(r)).filter((id) => id !== undefined),
  );

  const idf = Float64Array.from(documentFrequency, (df) =>
    Math.log((total + 1) / (df + 1)) + 1,
  );

  return { verseKeys, vocabulary, rootId, verseRoots, idf, documentFrequency };
}

/**
 * Positive pointwise mutual information over root co-occurrence within a
 * verse. PPMI is the standard weighting here: raw counts are dominated by
 * frequent roots, and plain PMI is unstable for rare pairs.
 */
function buildPpmiMatrix(index) {
  const n = index.vocabulary.length;
  const matrix = new Float64Array(n * n);
  const rowTotals = new Float64Array(n);
  let grandTotal = 0;

  for (const roots of index.verseRoots) {
    const unique = [...new Set(roots)];
    for (let a = 0; a < unique.length; a += 1) {
      for (let b = a + 1; b < unique.length; b += 1) {
        matrix[unique[a] * n + unique[b]] += 1;
        matrix[unique[b] * n + unique[a]] += 1;
      }
    }
  }

  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += matrix[i * n + j];
    rowTotals[i] = sum;
    grandTotal += sum;
  }
  if (grandTotal === 0) return matrix;

  for (let i = 0; i < n; i += 1) {
    if (rowTotals[i] === 0) continue;
    for (let j = 0; j < n; j += 1) {
      const joint = matrix[i * n + j];
      if (joint === 0) continue;
      const pmi = Math.log(
        (joint * grandTotal) / (rowTotals[i] * rowTotals[j]),
      );
      matrix[i * n + j] = pmi > 0 ? pmi : 0;
    }
  }
  return matrix;
}

/** Modified Gram-Schmidt: numerically stabler than the classical form. */
function orthonormalize(block, rows, cols) {
  for (let c = 0; c < cols; c += 1) {
    for (let prev = 0; prev < c; prev += 1) {
      let dot = 0;
      for (let r = 0; r < rows; r += 1) {
        dot += block[r * cols + prev] * block[r * cols + c];
      }
      for (let r = 0; r < rows; r += 1) {
        block[r * cols + c] -= dot * block[r * cols + prev];
      }
    }
    let norm = 0;
    for (let r = 0; r < rows; r += 1) norm += block[r * cols + c] ** 2;
    norm = Math.sqrt(norm);
    if (norm < 1e-12) continue;
    for (let r = 0; r < rows; r += 1) block[r * cols + c] /= norm;
  }
}

/**
 * Top-`k` eigenvectors of a symmetric matrix by subspace iteration.
 *
 * The PPMI matrix is symmetric and its spectrum decays quickly, so a few
 * dozen iterations converge well past the precision an int8-quantised
 * embedding can carry.
 */
function topEigenvectors(matrix, n, k, iterations, random) {
  let block = new Float64Array(n * k);
  for (let i = 0; i < block.length; i += 1) block[i] = random() * 2 - 1;
  orthonormalize(block, n, k);

  const next = new Float64Array(n * k);
  for (let step = 0; step < iterations; step += 1) {
    next.fill(0);
    for (let i = 0; i < n; i += 1) {
      const rowBase = i * n;
      const outBase = i * k;
      for (let j = 0; j < n; j += 1) {
        const weight = matrix[rowBase + j];
        if (weight === 0) continue;
        const inBase = j * k;
        for (let c = 0; c < k; c += 1) next[outBase + c] += weight * block[inBase + c];
      }
    }
    block.set(next);
    orthonormalize(block, n, k);
  }

  // Rayleigh quotients give the eigenvalues the vectors converged to.
  const eigenvalues = new Float64Array(k);
  for (let c = 0; c < k; c += 1) {
    let value = 0;
    for (let i = 0; i < n; i += 1) {
      let row = 0;
      const rowBase = i * n;
      for (let j = 0; j < n; j += 1) row += matrix[rowBase + j] * block[j * k + c];
      value += block[i * k + c] * row;
    }
    eigenvalues[c] = value;
  }

  return { vectors: block, eigenvalues };
}

/** Deterministic PRNG so a rebuild produces byte-identical vectors. */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildEmbeddings(index, { dimensions = 96, iterations = 60 } = {}) {
  const n = index.vocabulary.length;
  const requested = Math.min(dimensions, n);
  const ppmi = buildPpmiMatrix(index);
  const { vectors, eigenvalues } = topEigenvectors(
    ppmi,
    n,
    requested,
    iterations,
    mulberry32(0x5ee17),
  );

  /*
   * Subspace iteration converges the dominant directions first and can leave
   * a straggler far down the spectrum — a run at 34 iterations produced
   * eigenvalues 169, 70, 63, 45, *1.4*, 51. Ordering by eigenvalue and
   * dropping the degenerate tail keeps only axes that carry real structure,
   * so a stalled direction becomes a slightly shorter vector rather than a
   * dimension of noise every similarity has to see through.
   */
  const order = [...eigenvalues.keys()]
    .sort((a, b) => eigenvalues[b] - eigenvalues[a])
    .filter((i) => eigenvalues[i] > eigenvalues[0] * 1e-3);
  const k = order.length;

  const rootVectors = new Float64Array(n * k);
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < k; c += 1) {
      // Scale each axis by sqrt of its eigenvalue, as in classical LSA — it
      // weights dimensions by how much structure they actually explain.
      rootVectors[i * k + c] =
        vectors[i * requested + order[c]] * Math.sqrt(Math.max(eigenvalues[order[c]], 0));
    }
  }

  /*
   * The muqaṭṭaʿāt — the disconnected letters that open twenty-nine sūrahs —
   * carry no roots at all, so they have no position in this space. Their
   * vectors stay zero and they are reported as unplaced rather than being
   * silently returned as equidistant from everything, which is what a bare
   * cosine would make them look like.
   */
  const placed = new Uint8Array(index.verseKeys.length);
  const verseVectors = new Float64Array(index.verseKeys.length * k);
  index.verseRoots.forEach((roots, verseIndex) => {
    if (roots.length === 0) return;
    const base = verseIndex * k;
    let weightTotal = 0;
    for (const rootIndex of roots) {
      const weight = index.idf[rootIndex];
      weightTotal += weight;
      for (let c = 0; c < k; c += 1) {
        verseVectors[base + c] += weight * rootVectors[rootIndex * k + c];
      }
    }
    if (weightTotal === 0) return;
    let norm = 0;
    for (let c = 0; c < k; c += 1) {
      verseVectors[base + c] /= weightTotal;
      norm += verseVectors[base + c] ** 2;
    }
    norm = Math.sqrt(norm);
    if (norm < 1e-12) return;
    for (let c = 0; c < k; c += 1) verseVectors[base + c] /= norm;
    placed[verseIndex] = 1;
  });

  const keptEigenvalues = Float64Array.from(order, (i) => eigenvalues[i]);
  return { dimensions: k, rootVectors, verseVectors, placed, eigenvalues: keptEigenvalues };
}

/**
 * Quantise unit vectors to int8.
 *
 * Every vector is L2-normalised, so components sit well inside [-1, 1] and a
 * fixed 127× scale loses far less than the model's own noise floor — while
 * cutting the payload a mobile reader downloads by four.
 */
export function quantize(vectors) {
  const out = new Int8Array(vectors.length);
  for (let i = 0; i < vectors.length; i += 1) {
    out[i] = Math.max(-127, Math.min(127, Math.round(vectors[i] * 127)));
  }
  return out;
}

export function compareVerseKeys(a, b) {
  const [aS, aA] = a.split(":").map(Number);
  const [bS, bA] = b.split(":").map(Number);
  return aS - bS || aA - bA;
}
