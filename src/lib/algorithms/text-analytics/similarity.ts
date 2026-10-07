import { AlgorithmDefinition, ValidationError } from "../types";
import { requireText } from "@/lib/utils/validators";
import { tokenize } from "@/lib/utils/preprocessing";

type Vec = Map<string, number>;

interface SimilarityMethod {
  id: string;
  name: string;
  formula: string;
  compute: (a: Vec, b: Vec) => number;
}

const setOf = (v: Vec) => new Set(v.keys());
const inter = (a: Set<string>, b: Set<string>) => {
  let c = 0;
  for (const x of a) if (b.has(x)) c++;
  return c;
};

/** Pluggable similarity measures — add a new entry here to extend the module. */
export const SIMILARITY_METHODS: SimilarityMethod[] = [
  {
    id: "cosine",
    name: "Cosine (term frequency)",
    formula: "cos(A,B) = Σ aᵢbᵢ / (‖A‖·‖B‖)",
    compute: (a, b) => {
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (const [t, v] of a) {
        na += v * v;
        const w = b.get(t);
        if (w) dot += v * w;
      }
      for (const v of b.values()) nb += v * v;
      return na && nb ? dot / Math.sqrt(na * nb) : 0;
    },
  },
  {
    id: "jaccard",
    name: "Jaccard (token sets)",
    formula: "J(A,B) = |A ∩ B| / |A ∪ B|",
    compute: (a, b) => {
      const A = setOf(a);
      const B = setOf(b);
      const i = inter(A, B);
      const u = A.size + B.size - i;
      return u ? i / u : 0;
    },
  },
  {
    id: "dice",
    name: "Sørensen–Dice",
    formula: "D(A,B) = 2|A ∩ B| / (|A| + |B|)",
    compute: (a, b) => {
      const A = setOf(a);
      const B = setOf(b);
      return A.size + B.size ? (2 * inter(A, B)) / (A.size + B.size) : 0;
    },
  },
  {
    id: "overlap",
    name: "Overlap coefficient",
    formula: "O(A,B) = |A ∩ B| / min(|A|, |B|)",
    compute: (a, b) => {
      const A = setOf(a);
      const B = setOf(b);
      const m = Math.min(A.size, B.size);
      return m ? inter(A, B) / m : 0;
    },
  },
];

function vec(tokens: string[]): Vec {
  const v: Vec = new Map();
  for (const t of tokens) v.set(t, (v.get(t) ?? 0) + 1);
  return v;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

export const similarity: AlgorithmDefinition = {
  meta: {
    id: "similarity",
    name: "Text Similarity",
    category: "text-analytics",
    description: "Compares two documents using pluggable vector/set similarity measures (cosine, Jaccard, Dice, overlap) and explains shared and distinct terms.",
    complexity: { best: "O(n + m)", average: "O(n + m)", worst: "O(n + m)", space: "O(V)", notes: "Linear in token count using hash maps; V = combined vocabulary." },
    input: { fields: ["text", "textB", "method"], requirements: "Two non-empty documents. Method: cosine | jaccard | dice | overlap.", output: "Similarity score(s), shared terms, terms unique to each document, top contributing terms.", example: { text: "Machine learning models learn patterns from data and improve predictions.", textB: "Deep learning models learn complex patterns from large data sets.", method: "cosine" } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "A ← tokenize(doc1); B ← tokenize(doc2)",
      "build term-frequency vectors / token sets",
      "shared ← A ∩ B; onlyA ← A − B; onlyB ← B − A",
      "score ← method(A, B)",
      "explain contributions per shared term",
    ],
    learning: {
      what: "Text similarity quantifies how alike two documents are by representing them as vectors or sets of terms.",
      why: "Duplicate detection, plagiarism checks, clustering and recommendation all need a numeric notion of similarity.",
      how: ["Tokenize both documents (lowercase, stop-word removal).", "Cosine: treat term counts as vectors and measure the angle between them.", "Jaccard / Dice / Overlap: compare the sets of distinct terms.", "Inspect shared and unique terms to explain the score."],
      example: "Two sentences sharing 'learning', 'models', 'patterns', 'data' get a cosine of roughly 0.5–0.6 despite different wording.",
      advantages: ["Fast and language-agnostic", "Explainable via shared terms", "Multiple measures for different needs"],
      limitations: ["Lexical only — no synonyms or meaning", "Sensitive to preprocessing", "Set measures ignore frequency"],
      applications: ["Plagiarism detection", "Near-duplicate removal", "Search relevance", "Document clustering"],
    },
    model: "n",
    maxBenchmarkSize: 3_000_000,
    vizLimits: { text: 3000 },
  },
  validate(input) {
    const a = requireText(input, "text", "Document A");
    const b = requireText(input, "textB", "Document B");
    const method = input.method ?? "cosine";
    if (!SIMILARITY_METHODS.some((m) => m.id === method)) throw new ValidationError(`Unknown similarity method "${method}". Use ${SIMILARITY_METHODS.map((m) => m.id).join(", ")}.`);
    return { text: a, textB: b, method };
  },
  inputSize(input) {
    return { n: (input.text?.length ?? 0) + (input.textB?.length ?? 0), m: 0, k: 2 };
  },
  run(input, ctx) {
    const ta = tokenize(input.text!, { removeStopWords: true });
    const tb = tokenize(input.textB!, { removeStopWords: true });
    ctx.counters.operations += ta.length + tb.length;
    const A = vec(ta);
    const B = vec(tb);
    ctx.step(() => ({
      phase: "1. Tokenize",
      description: `Document A → ${ta.length} tokens (${A.size} distinct). Document B → ${tb.length} tokens (${B.size} distinct).`,
      line: 0,
      table: { title: "Token counts", headers: ["term", "A", "B"], rows: Array.from(new Set([...A.keys(), ...B.keys()])).sort().slice(0, 40).map((t) => [t, A.get(t) ?? 0, B.get(t) ?? 0]), highlightRows: Object.fromEntries(Array.from(new Set([...A.keys(), ...B.keys()])).sort().slice(0, 40).map((t, i) => [i, A.has(t) && B.has(t) ? "match" : "dim"])) },
    }));
    const shared: string[] = [];
    const onlyA: string[] = [];
    for (const t of A.keys()) {
      ctx.counters.comparisons++;
      if (B.has(t)) shared.push(t);
      else onlyA.push(t);
    }
    const onlyB = Array.from(B.keys()).filter((t) => !A.has(t));
    ctx.step(() => ({ phase: "2. Compare vocabularies", description: `${shared.length} shared terms, ${onlyA.length} only in A, ${onlyB.length} only in B.`, line: 2, bars: [{ label: "shared", value: shared.length, highlight: true }, { label: "only A", value: onlyA.length }, { label: "only B", value: onlyB.length }] }));
    const scores = SIMILARITY_METHODS.map((m) => ({ id: m.id, name: m.name, formula: m.formula, score: r4(m.compute(A, B)) }));
    const selected = scores.find((s) => s.id === input.method)!;
    ctx.step(() => ({ phase: "3. Score", description: `${selected.name}: ${selected.formula} = ${selected.score}. Other measures shown for comparison.`, line: 3, bars: scores.map((s) => ({ label: s.id, value: s.score, highlight: s.id === selected.id })) }));
    const contributions = shared.map((t) => ({ term: t, a: A.get(t)!, b: B.get(t)!, product: A.get(t)! * B.get(t)! })).sort((x, y) => y.product - x.product);
    ctx.step(() => ({ phase: "4. Explain", description: "Shared terms ranked by their contribution to the cosine dot product (countA × countB).", line: 4, bars: contributions.slice(0, 15).map((c) => ({ label: c.term, value: c.product })) }));
    return {
      output: { method: selected, allMethods: scores, sharedTerms: shared.slice(0, 200), onlyInA: onlyA.slice(0, 200), onlyInB: onlyB.slice(0, 200), contributions: contributions.slice(0, 30), tokensA: ta.length, tokensB: tb.length },
      summary: `${selected.name} similarity = ${selected.score} (${shared.length} shared terms).`,
      memoryBytes: (A.size + B.size) * 48,
    };
  },
};
