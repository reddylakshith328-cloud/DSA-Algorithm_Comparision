import { AlgorithmDefinition, RunContext } from "../types";
import { requireText } from "@/lib/utils/validators";

const show = (s: string, max = 40) => (s.length > max ? s.slice(0, max) + "…" : s);

/** Prefix-doubling suffix array construction: O(n log² n) with comparison sort. */
export function buildSuffixArray(text: string, ctx?: RunContext): number[] {
  const n = text.length;
  const sa = Array.from({ length: n }, (_, i) => i);
  let rank = Array.from({ length: n }, (_, i) => text.charCodeAt(i));
  const tmp = new Array<number>(n).fill(0);
  const record = (k: number, desc: string) =>
    ctx?.step(() => ({
      phase: "Suffix sorting",
      description: desc,
      line: k === 0 ? 1 : 3,
      table: {
        title: `Suffixes ordered by first ${k === 0 ? 1 : 2 * k} character(s)`,
        headers: ["pos", "SA[i]", "rank", "rank(i+k)", "suffix"],
        rows: sa.map((s, i) => [i, s, rank[s], k && s + k < n ? rank[s + k] : k ? -1 : "–", show(text.slice(s))]),
      },
      vars: { k: k || 1, n },
    }));
  ctx?.step(() => ({
    phase: "Generate suffixes",
    description: `Generate all ${n} suffixes of the string (unsorted, by starting position).`,
    line: 0,
    table: { title: "All suffixes", headers: ["i", "suffix"], rows: sa.map((s) => [s, show(text.slice(s))]) },
    vars: { n },
  }));
  if (n <= 1) return sa;
  for (let k = 1; ; k <<= 1) {
    const cmp = (a: number, b: number) => {
      if (ctx) ctx.counters.comparisons++;
      if (rank[a] !== rank[b]) return rank[a] - rank[b];
      const ra = a + k < n ? rank[a + k] : -1;
      const rb = b + k < n ? rank[b + k] : -1;
      return ra - rb;
    };
    sa.sort(cmp);
    tmp[sa[0]] = 0;
    for (let i = 1; i < n; i++) {
      tmp[sa[i]] = tmp[sa[i - 1]] + (cmp(sa[i - 1], sa[i]) < 0 ? 1 : 0);
      if (ctx) ctx.counters.operations++;
    }
    const prevRank = rank;
    rank = tmp.slice();
    const distinct = rank[sa[n - 1]] + 1;
    // Show the pair ranks that were used for this round
    const r = rank;
    rank = prevRank;
    record(k, `Round k = ${k}: sort suffixes by the pair (rank[i], rank[i+${k}]), i.e. by their first ${2 * k} characters. ${distinct} distinct ranks.`);
    rank = r;
    if (distinct === n) break;
  }
  ctx?.step(() => ({
    phase: "Suffix array",
    description: `All ranks are distinct — the suffix array is complete: [${sa.join(", ")}].`,
    line: 5,
    table: { title: "Sorted suffixes", headers: ["rank", "SA[i]", "suffix"], rows: sa.map((s, i) => [i, s, show(text.slice(s))]) },
    arrays: [{ label: "SA", values: sa.slice() }],
  }));
  return sa;
}

export const suffixArray: AlgorithmDefinition = {
  meta: {
    id: "suffix-array",
    name: "Suffix Array",
    category: "text-structures",
    description: "Sorted array of all suffix start positions, built by prefix doubling. Enables binary-search substring queries.",
    complexity: { best: "O(n log n)", average: "O(n log² n)", worst: "O(n log² n)", space: "O(n)", notes: "Prefix doubling with comparison sort; SA-IS achieves O(n)." },
    input: { fields: ["text"], requirements: "Non-empty text (e.g. 'banana').", output: "The suffix array and sorted suffixes.", example: { text: "banana" } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "generate all suffixes T[i..n−1]",
      "rank[i] ← code(T[i]); k ← 1",
      "repeat:",
      "  sort i by (rank[i], rank[i+k])",
      "  re-rank; k ← 2k",
      "until all ranks distinct → SA",
    ],
    learning: {
      what: "A suffix array lists the starting positions of all suffixes of a string in lexicographic order.",
      why: "It supports substring search in O(m log n), longest repeated substring, and compression (BWT) using far less memory than a suffix tree.",
      how: ["Rank suffixes by their first character.", "Double k each round: sort by the pair (rank of first k chars, rank of next k chars).", "Stop when all ranks are unique (≤ log n rounds)."],
      example: "banana → suffixes sorted: a, ana, anana, banana, na, nana → SA = [5, 3, 1, 0, 4, 2].",
      advantages: ["Compact (n integers)", "Binary-searchable", "Foundation for LCP, BWT, FM-index"],
      limitations: ["Construction more complex than tries", "Static — rebuilding required on updates"],
      applications: ["Full-text indexes", "Genome assembly", "Data compression (bzip2)", "Plagiarism detection"],
    },
    model: "nlog2n",
    maxBenchmarkSize: 100_000,
    vizLimits: { text: 24 },
  },
  validate(input) {
    return { text: requireText(input) };
  },
  inputSize(input) {
    return { n: input.text?.length ?? 0, m: 0, k: 1 };
  },
  run(input, ctx) {
    const text = input.text!;
    const sa = buildSuffixArray(text, ctx);
    return {
      output: { suffixArray: sa.slice(0, 1000), length: sa.length, sortedSuffixes: sa.slice(0, 50).map((s) => ({ index: s, suffix: show(text.slice(s), 60) })) },
      summary: `Suffix array of length ${sa.length} built${sa.length <= 20 ? `: [${sa.join(", ")}]` : ""}.`,
      memoryBytes: text.length * 8 * 3,
    };
  },
};
