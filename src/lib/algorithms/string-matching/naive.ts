import { AlgorithmDefinition } from "../types";
import { matchSummary, range, singleSize, validateSingle, windowStrings } from "./common";

export const naive: AlgorithmDefinition = {
  meta: {
    id: "naive",
    name: "Naive String Matching",
    category: "string-matching",
    description: "Brute-force search: aligns the pattern at every text position and compares characters left to right.",
    complexity: { best: "O(n)", average: "O(n·m) worst-bound, ≈O(n) on random text", worst: "O(n·m)", space: "O(1)" },
    input: {
      fields: ["text", "pattern"],
      requirements: "Non-empty text and a non-empty pattern no longer than the text.",
      output: "All starting indices where the pattern occurs.",
      example: { text: "AABAACAADAABAABA", pattern: "AABA" },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "for s ← 0 to n − m:",
      "  j ← 0",
      "  while j < m and T[s + j] = P[j]:",
      "    j ← j + 1",
      "  if j = m: report s",
      "  ▷ shift pattern by one",
    ],
    learning: {
      what: "The simplest exact matching algorithm: try every alignment of the pattern against the text.",
      why: "It is the baseline every other algorithm is measured against and has no preprocessing cost.",
      how: ["Place the pattern at shift s = 0.", "Compare characters left to right until a mismatch or full match.", "Report a match if all m characters agree.", "Shift the pattern by exactly one position and repeat."],
      example: "T = AAAAAB, P = AAB: at each shift the first two characters match before failing, giving ~n·m comparisons.",
      advantages: ["Trivial to implement and verify", "No preprocessing or extra memory", "Competitive for very short patterns"],
      limitations: ["O(n·m) worst case on repetitive text", "Re-examines text characters many times"],
      applications: ["Baseline for benchmarking", "Short one-off searches", "Teaching"],
    },
    model: "nm",
    maxBenchmarkSize: 2_000_000,
    vizLimits: { text: 200, pattern: 30 },
  },
  validate: validateSingle,
  inputSize: singleSize,
  run(input, ctx) {
    const text = input.text!;
    const pattern = input.pattern!;
    const n = text.length;
    const m = pattern.length;
    const matches: number[] = [];
    for (let s = 0; s <= n - m; s++) {
      let j = 0;
      while (j < m) {
        ctx.counters.comparisons++;
        const ok = text[s + j] === pattern[j];
        ctx.step(() => ({
          phase: "Search",
          description: ok
            ? `Shift ${s}: T[${s + j}] = '${text[s + j]}' matches P[${j}].`
            : `Shift ${s}: T[${s + j}] = '${text[s + j]}' ≠ P[${j}] = '${pattern[j]}'. Shift pattern by 1.`,
          line: ok ? 3 : 5,
          strings: windowStrings(text, pattern, s, { matched: range(0, j), compare: j, result: ok ? "match" : "mismatch", found: matches }),
          vars: { s, j, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
        if (!ok) break;
        j++;
      }
      ctx.counters.operations++;
      if (j === m) {
        matches.push(s);
        ctx.step(() => ({
          phase: "Search",
          description: `All ${m} characters matched: occurrence at index ${s}.`,
          line: 4,
          strings: windowStrings(text, pattern, s, { found: matches }),
          vars: { s, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
      }
    }
    ctx.step(() => ({
      phase: "Done",
      description: `Finished after ${n - m + 1} alignments and ${ctx.counters.comparisons} comparisons.`,
      strings: windowStrings(text, pattern, n - m, { found: matches }),
      vars: { comparisons: ctx.counters.comparisons, matches: matches.length },
    }));
    return { output: { matches: matches.slice(0, 1000), totalMatches: matches.length }, matches, summary: matchSummary(matches, pattern), memoryBytes: 0 };
  },
};
