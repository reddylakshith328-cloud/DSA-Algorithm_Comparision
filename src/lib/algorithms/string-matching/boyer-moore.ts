import { AlgorithmDefinition, RunContext } from "../types";
import { matchSummary, range, singleSize, validateSingle, windowStrings } from "./common";

export function badCharTable(pattern: string): Map<string, number> {
  const last = new Map<string, number>();
  for (let i = 0; i < pattern.length; i++) last.set(pattern[i], i);
  return last;
}

/** Strong good-suffix rule shift table (size m + 1). */
export function goodSuffixTable(p: string, ctx?: RunContext): number[] {
  const m = p.length;
  const shift = new Array<number>(m + 1).fill(0);
  const bpos = new Array<number>(m + 1).fill(0);
  let i = m;
  let j = m + 1;
  bpos[i] = j;
  while (i > 0) {
    while (j <= m && p[i - 1] !== p[j - 1]) {
      if (ctx) ctx.counters.comparisons++;
      if (shift[j] === 0) shift[j] = j - i;
      j = bpos[j];
    }
    i--;
    j--;
    bpos[i] = j;
  }
  j = bpos[0];
  for (i = 0; i <= m; i++) {
    if (shift[i] === 0) shift[i] = j;
    if (i === j) j = bpos[j];
  }
  return shift;
}

export const boyerMoore: AlgorithmDefinition = {
  meta: {
    id: "boyer-moore",
    name: "Boyer–Moore",
    category: "string-matching",
    description: "Compares the pattern right-to-left and skips ahead using the bad-character and good-suffix heuristics.",
    complexity: { best: "O(n / m)", average: "Sublinear on large alphabets", worst: "O(n·m) (this variant, without Galil rule)", space: "O(m + σ)" },
    input: {
      fields: ["text", "pattern"],
      requirements: "Non-empty text and a non-empty pattern no longer than the text.",
      output: "Match indices and the heuristic tables.",
      example: { text: "HERE IS A SIMPLE EXAMPLE", pattern: "EXAMPLE" },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "last ← badCharTable(P); gs ← goodSuffixTable(P)",
      "s ← 0",
      "while s ≤ n − m:",
      "  j ← m − 1",
      "  while j ≥ 0 and P[j] = T[s + j]: j ← j − 1",
      "  if j < 0: report s; s ← s + gs[0]",
      "  else: s ← s + max(gs[j+1], j − last[T[s+j]])",
    ],
    learning: {
      what: "Boyer–Moore scans each alignment from the right end of the pattern and uses mismatch information to skip many alignments at once.",
      why: "On natural-language text with a large alphabet most mismatches occur immediately and the pattern can jump up to m positions, so it often inspects fewer than n characters.",
      how: [
        "Bad-character rule: on a mismatch with text character c, align the last occurrence of c in the pattern with it (or skip past c entirely).",
        "Good-suffix rule: if a suffix matched before the mismatch, shift so that another occurrence of that suffix (or a matching prefix) aligns.",
        "Shift by the maximum of the two rules.",
      ],
      example: "Searching EXAMPLE in 'HERE IS A SIMPLE EXAMPLE': the first comparison of 'E' vs 'S' lets the pattern jump 7 positions since 'S' does not occur in the pattern.",
      advantages: ["Sublinear average behaviour on large alphabets", "Longer patterns → larger skips", "Widely used in practice (grep, editors)"],
      limitations: ["More complex preprocessing", "Weaker on small alphabets (DNA, binary)", "Worst case O(nm) without the Galil rule"],
      applications: ["grep-like tools", "Text editors", "Intrusion-detection signature search"],
    },
    model: "n/m",
    maxBenchmarkSize: 5_000_000,
    vizLimits: { text: 200, pattern: 30 },
  },
  validate: validateSingle,
  inputSize: singleSize,
  run(input, ctx) {
    const text = input.text!;
    const pattern = input.pattern!;
    const n = text.length;
    const m = pattern.length;
    const last = badCharTable(pattern);
    const gs = goodSuffixTable(pattern, ctx);
    const matches: number[] = [];
    const tables = () => [
      { label: "Good-suffix shift", values: gs, indexLabels: range(0, m + 1) },
      { label: "Bad-char last index", values: Array.from(last.values()), indexLabels: Array.from(last.keys()).map((c) => (c === " " ? "␣" : c)) },
    ];
    ctx.step(() => ({ phase: "Preprocessing", description: "Built the bad-character table (last index of each pattern character) and the good-suffix shift table.", line: 0, arrays: tables(), strings: windowStrings(text, pattern, 0, { found: [] }) }));
    let s = 0;
    while (s <= n - m) {
      let j = m - 1;
      while (j >= 0) {
        ctx.counters.comparisons++;
        const ok = pattern[j] === text[s + j];
        ctx.step(() => ({
          phase: "Search",
          description: ok ? `Right-to-left: P[${j}] = T[${s + j}] = '${pattern[j]}'.` : `Mismatch: P[${j}] = '${pattern[j]}' ≠ T[${s + j}] = '${text[s + j]}'.`,
          line: 4,
          strings: windowStrings(text, pattern, s, { matched: range(j + 1, m), compare: j, result: ok ? "match" : "mismatch", found: matches }),
          arrays: tables(),
          vars: { s, j, comparisons: ctx.counters.comparisons, matches: matches.length },
        }));
        if (!ok) break;
        j--;
      }
      ctx.counters.operations++;
      if (j < 0) {
        matches.push(s);
        const sh = gs[0];
        ctx.step(() => ({ phase: "Search", description: `Match at ${s}. Shift by good-suffix gs[0] = ${sh}.`, line: 5, strings: windowStrings(text, pattern, s, { found: matches }), arrays: tables(), vars: { s, shift: sh, matches: matches.length } }));
        s += sh;
      } else {
        const c = text[s + j];
        const bc = j - (last.has(c) ? last.get(c)! : -1);
        const g = gs[j + 1];
        const sh = Math.max(g, bc);
        ctx.step(() => ({
          phase: "Shift",
          description: `Bad-character shift = ${bc} ('${c}' last at ${last.has(c) ? last.get(c) : "none"}), good-suffix shift = ${g}. Shift by ${sh}.`,
          line: 6,
          strings: windowStrings(text, pattern, s, { matched: range(j + 1, m), compare: j, result: "mismatch", found: matches }),
          arrays: tables(),
          vars: { s, j, badChar: bc, goodSuffix: g, shift: sh },
        }));
        s += sh;
      }
    }
    return {
      output: { matches: matches.slice(0, 1000), totalMatches: matches.length, goodSuffix: gs.slice(0, 200), badCharacter: Object.fromEntries(Array.from(last.entries()).slice(0, 100)) },
      matches,
      summary: matchSummary(matches, pattern),
      memoryBytes: (m + 1) * 16 + last.size * 40,
    };
  },
};
