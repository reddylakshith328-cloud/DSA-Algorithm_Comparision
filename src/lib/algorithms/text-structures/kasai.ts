import { AlgorithmDefinition, Highlight } from "../types";
import { requireText } from "@/lib/utils/validators";
import { buildSuffixArray } from "./suffix-array";

const show = (s: string, max = 40) => (s.length > max ? s.slice(0, max) + "…" : s);

export const kasai: AlgorithmDefinition = {
  meta: {
    id: "kasai",
    name: "Kasai LCP Array",
    category: "text-structures",
    description: "Computes the Longest Common Prefix array between adjacent suffixes in the suffix array in linear time.",
    complexity: { best: "O(n)", average: "O(n)", worst: "O(n)", space: "O(n)", notes: "Assumes the suffix array is given; total time including SA construction is dominated by the SA step." },
    input: { fields: ["text"], requirements: "Non-empty text.", output: "LCP array, longest repeated substring, number of distinct substrings.", example: { text: "banana" } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "SA ← suffixArray(T); rank[SA[i]] ← i",
      "h ← 0",
      "for i ← 0 to n−1 (text order):",
      "  if rank[i] > 0:",
      "    j ← SA[rank[i] − 1]",
      "    while T[i+h] = T[j+h]: h++",
      "    LCP[rank[i]] ← h",
      "    if h > 0: h ← h − 1",
      "  else: h ← 0",
    ],
    learning: {
      what: "Kasai's algorithm builds the LCP array: LCP[r] = length of the common prefix of suffixes SA[r−1] and SA[r].",
      why: "Together with the suffix array, LCP answers questions like longest repeated substring and number of distinct substrings in linear time.",
      how: ["Compute rank = inverse of SA.", "Process suffixes in text order i = 0..n−1.", "Compare suffix i with its predecessor in sorted order, starting from the previous h.", "Key insight: LCP drops by at most 1 when moving from suffix i to i+1, so h decreases by one — total work O(n)."],
      example: "banana: SA = [5,3,1,0,4,2], LCP = [0,1,3,0,0,2]. Longest repeated substring = 'ana' (LCP 3).",
      advantages: ["Linear time", "Simple once SA exists", "Enables many string statistics"],
      limitations: ["Requires the suffix array first", "Extra O(n) memory for rank array"],
      applications: ["Longest repeated substring", "Distinct substring counting", "Suffix tree simulation", "Genome repeat analysis"],
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
    const n = text.length;
    const sa = buildSuffixArray(text); // SA construction not visualised here (see Suffix Array)
    const rank = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) rank[sa[i]] = i;
    const lcp = new Array<number>(n).fill(0);
    const tableRows = () => sa.map((s, r) => [r, s, lcp[r], show(text.slice(s))]);
    ctx.step(() => ({
      phase: "Setup",
      description: `Suffix array computed: [${sa.join(", ")}]. Build rank[] (inverse SA).`,
      line: 0,
      table: { title: "Suffix array with LCP", headers: ["rank", "SA", "LCP", "suffix"], rows: tableRows() },
      arrays: [
        { label: "SA", values: sa.slice() },
        { label: "rank", values: rank.slice() },
      ],
    }));
    let h = 0;
    for (let i = 0; i < n; i++) {
      if (rank[i] > 0) {
        const j = sa[rank[i] - 1];
        const start = h;
        while (i + h < n && j + h < n) {
          ctx.counters.comparisons++;
          if (text[i + h] !== text[j + h]) break;
          h++;
        }
        lcp[rank[i]] = h;
        ctx.counters.operations++;
        const hh = h;
        ctx.step(() => {
          // highlight construction is lazy: only paid when recording steps for the visualizer
          const hlA: Record<number, Highlight> = {};
          const hlB: Record<number, Highlight> = {};
          for (let k = 0; k < hh; k++) {
            hlA[k] = k < start ? "dim" : "match";
            hlB[k] = k < start ? "dim" : "match";
          }
          if (i + hh < n) hlA[hh] = "mismatch";
          if (j + hh < n) hlB[hh] = "mismatch";
          return {
          phase: "LCP",
          description: `Suffix ${i} (rank ${rank[i]}) vs predecessor suffix ${j}. Start at h = ${start} (inherited), common prefix length = ${hh}. LCP[${rank[i]}] = ${hh}.`,
          line: 6,
          strings: [
            { label: `T[${i}..]`, chars: text.slice(i), highlights: hlA },
            { label: `T[${j}..]`, chars: text.slice(j), highlights: hlB },
          ],
          table: { title: "Suffix array with LCP", headers: ["rank", "SA", "LCP", "suffix"], rows: tableRows(), highlightRows: { [rank[i]]: "active", [rank[i] - 1]: "compare" } },
          arrays: [{ label: "LCP", values: lcp.slice(), highlights: { [rank[i]]: "active" } }],
          vars: { i, j, h: hh, "h carried": start },
          };
        });
        if (h > 0) h--;
      } else {
        h = 0;
      }
    }
    let best = 0;
    let bestR = 0;
    let sum = 0;
    for (let r = 0; r < n; r++) {
      sum += lcp[r];
      if (lcp[r] > best) {
        best = lcp[r];
        bestR = r;
      }
    }
    const lrs = best > 0 ? text.slice(sa[bestR], sa[bestR] + best) : "";
    const distinct = (n * (n + 1)) / 2 - sum;
    ctx.step(() => ({
      phase: "Done",
      description: `LCP = [${lcp.join(", ")}]. Longest repeated substring "${lrs}" (length ${best}). Distinct substrings = n(n+1)/2 − ΣLCP = ${distinct}.`,
      table: { title: "Suffix array with LCP", headers: ["rank", "SA", "LCP", "suffix"], rows: tableRows(), highlightRows: { [bestR]: "found" } },
      arrays: [{ label: "LCP", values: lcp.slice() }],
    }));
    return {
      output: { suffixArray: sa.slice(0, 1000), lcp: lcp.slice(0, 1000), longestRepeatedSubstring: show(lrs, 200), longestRepeatLength: best, distinctSubstrings: distinct },
      summary: `LCP computed. Longest repeated substring: "${show(lrs, 40)}" (length ${best}). Distinct substrings: ${distinct.toLocaleString()}.`,
      memoryBytes: n * 8 * 4,
    };
  },
};
