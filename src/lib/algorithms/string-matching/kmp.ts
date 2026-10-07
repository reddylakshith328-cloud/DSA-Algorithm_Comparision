import { AlgorithmDefinition, Highlight, RunContext } from "../types";
import { matchSummary, range, singleSize, validateSingle, windowStrings } from "./common";

export function computeLPS(pattern: string, ctx?: RunContext): number[] {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  let len = 0;
  let i = 1;
  const snap = (hl: Record<number, Highlight>, desc: string, line: number) =>
    ctx?.step(() => ({
      phase: "Preprocessing: LPS",
      description: desc,
      line,
      strings: [
        {
          label: "Pattern",
          chars: pattern,
          highlights: { ...Object.fromEntries(range(0, len).map((x) => [x, "dim" as Highlight])), ...hl },
          pointer: i < m ? i : undefined,
        },
      ],
      arrays: [{ label: "LPS", values: lps.slice(), indexLabels: pattern.split(""), highlights: i < m ? { [i]: "active" } : {} }],
      vars: { i, len },
    }));
  snap({}, "Initialise LPS[0] = 0, len = 0, i = 1. LPS[i] = length of the longest proper prefix of P[0..i] that is also a suffix.", 1);
  while (i < m) {
    if (ctx) ctx.counters.comparisons++;
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      if (ctx) ctx.counters.operations++;
      snap({ [i]: "match", [len - 1]: "match" }, `P[${i}] = '${pattern[i]}' equals P[${len - 1}]. Extend: len = ${len}, LPS[${i}] = ${len}.`, 3);
      i++;
    } else if (len > 0) {
      const old = len;
      snap({ [i]: "mismatch", [len]: "mismatch" }, `P[${i}] = '${pattern[i]}' ≠ P[${len}] = '${pattern[len]}'. Fall back: len = LPS[${old - 1}] = ${lps[old - 1]}.`, 4);
      len = lps[len - 1];
      if (ctx) ctx.counters.operations++;
    } else {
      lps[i] = 0;
      if (ctx) ctx.counters.operations++;
      snap({ [i]: "mismatch", 0: "mismatch" }, `P[${i}] = '${pattern[i]}' ≠ P[0] and len = 0. Set LPS[${i}] = 0.`, 5);
      i++;
    }
  }
  return lps;
}

export const kmp: AlgorithmDefinition = {
  meta: {
    id: "kmp",
    name: "Knuth–Morris–Pratt (KMP)",
    category: "string-matching",
    description: "Linear-time single-pattern search that never re-examines text characters by using a precomputed LPS (failure) table.",
    complexity: { best: "O(n + m)", average: "O(n + m)", worst: "O(n + m)", space: "O(m)", notes: "At most 2n comparisons in the search phase." },
    input: {
      fields: ["text", "pattern"],
      requirements: "Non-empty text and a non-empty pattern no longer than the text.",
      output: "All starting indices where the pattern occurs (overlapping), plus the LPS array.",
      example: { text: "ABABDABACDABABCABAB", pattern: "ABABCABAB" },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "computeLPS(P):",
      "  len ← 0; i ← 1; LPS[0] ← 0",
      "  while i < m:",
      "    if P[i] = P[len]: len++; LPS[i] ← len; i++",
      "    else if len > 0: len ← LPS[len-1]",
      "    else: LPS[i] ← 0; i++",
      "search(T, P):",
      "  i ← 0; j ← 0",
      "  while i < n:",
      "    if T[i] = P[j]: i++; j++",
      "      if j = m: report i-m; j ← LPS[j-1]",
      "    else if j > 0: j ← LPS[j-1]   ▷ shift pattern",
      "    else: i++",
    ],
    learning: {
      what: "KMP is an exact string-matching algorithm that finds all occurrences of a pattern P (length m) in a text T (length n) in O(n + m) time.",
      why: "The naive approach restarts comparison after every mismatch and may re-read text characters, costing O(nm) in the worst case (e.g., T = aaaa…ab, P = aaab). KMP guarantees linear time regardless of input.",
      how: [
        "Preprocess the pattern into the LPS array: LPS[i] is the length of the longest proper prefix of P[0..i] that is also a suffix.",
        "Scan the text with index i and pattern index j. On a match, advance both.",
        "On a mismatch with j > 0, do not move i; set j = LPS[j-1]. The pattern slides right by j - LPS[j-1] positions, reusing already-matched characters.",
        "When j reaches m a match is reported at i - m and j falls back to LPS[m-1] to find overlapping matches.",
      ],
      example: "P = ABABCABAB → LPS = [0,0,1,2,0,1,2,3,4]. After matching ABAB and failing on C, KMP knows 'AB' is already matched and continues from j = 2.",
      advantages: ["Guaranteed O(n + m) worst case", "Text pointer never moves backwards — suitable for streaming", "Small O(m) memory"],
      limitations: ["Single pattern only", "Often slower than Boyer–Moore on natural-language text with large alphabets", "Preprocessing overhead for tiny inputs"],
      applications: ["Streaming log scanning", "DNA motif search", "Text editors' find function", "Basis of Aho–Corasick failure links"],
    },
    model: "n+m",
    maxBenchmarkSize: 5_000_000,
    vizLimits: { text: 300, pattern: 40 },
  },
  validate: validateSingle,
  inputSize: singleSize,
  run(input, ctx) {
    const text = input.text!;
    const pattern = input.pattern!;
    const n = text.length;
    const m = pattern.length;
    const lps = computeLPS(pattern, ctx);
    const matches: number[] = [];
    let i = 0;
    let j = 0;
    const lpsArr = (hl?: number) => [{ label: "LPS", values: lps, indexLabels: pattern.split(""), highlights: hl !== undefined ? { [hl]: "active" as Highlight } : {} }];
    ctx.step(() => ({
      phase: "Search",
      description: `LPS table ready: [${lps.join(", ")}]. Start scanning text with i = 0, j = 0.`,
      line: 7,
      strings: windowStrings(text, pattern, 0, { found: [] }),
      arrays: lpsArr(),
      vars: { i, j, comparisons: ctx.counters.comparisons, matches: 0 },
    }));
    while (i < n) {
      ctx.counters.comparisons++;
      if (text[i] === pattern[j]) {
        const shift = i - j;
        ctx.step(() => ({
          phase: "Search",
          description: `T[${i}] = '${text[i]}' matches P[${j}] = '${pattern[j]}'. Advance i and j.`,
          line: 9,
          strings: windowStrings(text, pattern, shift, { matched: range(0, j), compare: j, result: "match", found: matches }),
          arrays: lpsArr(),
          vars: { i, j, shift, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
        i++;
        j++;
        if (j === m) {
          matches.push(i - m);
          ctx.counters.operations++;
          const nj = lps[j - 1];
          ctx.step(() => ({
            phase: "Search",
            description: `Full match at index ${i - m}! Set j = LPS[${m - 1}] = ${nj} to continue searching for overlapping occurrences.`,
            line: 10,
            strings: windowStrings(text, pattern, i - m, { found: matches }),
            arrays: lpsArr(m - 1),
            vars: { i, j, comparisons: ctx.counters.comparisons, matches: matches.length },
          }));
          j = nj;
        }
      } else if (j > 0) {
        const shift = i - j;
        const nj = lps[j - 1];
        ctx.step(() => ({
          phase: "Search",
          description: `Mismatch: T[${i}] = '${text[i]}' ≠ P[${j}] = '${pattern[j]}'. Keep i, set j = LPS[${j - 1}] = ${nj}. Pattern shifts right by ${j - nj}.`,
          line: 11,
          strings: windowStrings(text, pattern, shift, { matched: range(0, j), compare: j, result: "mismatch", found: matches }),
          arrays: lpsArr(j - 1),
          vars: { i, j, shift, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
        j = nj;
        ctx.counters.operations++;
      } else {
        ctx.step(() => ({
          phase: "Search",
          description: `Mismatch: T[${i}] = '${text[i]}' ≠ P[0] = '${pattern[0]}' with j = 0. Advance i.`,
          line: 12,
          strings: windowStrings(text, pattern, i, { compare: 0, result: "mismatch", found: matches }),
          arrays: lpsArr(),
          vars: { i, j, shift: i, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
        i++;
      }
    }
    ctx.step(() => ({
      phase: "Done",
      description: `Search complete. ${matches.length} match(es) with ${ctx.counters.comparisons} character comparisons (n = ${n}, m = ${m}).`,
      line: 8,
      strings: windowStrings(text, pattern, Math.max(0, n - m), { found: matches }),
      arrays: lpsArr(),
      vars: { comparisons: ctx.counters.comparisons, matches: matches.length },
    }));
    return { output: { matches: matches.slice(0, 1000), totalMatches: matches.length, lps: m <= 500 ? lps : lps.slice(0, 500) }, matches, summary: matchSummary(matches, pattern), memoryBytes: m * 8 };
  },
};
