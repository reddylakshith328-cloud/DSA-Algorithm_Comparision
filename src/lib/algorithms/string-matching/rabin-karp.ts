import { AlgorithmDefinition } from "../types";
import { matchSummary, range, singleSize, validateSingle, windowStrings } from "./common";

const BASE = 256;
const MOD = 1_000_003;

export const rabinKarp: AlgorithmDefinition = {
  meta: {
    id: "rabin-karp",
    name: "Rabin–Karp",
    category: "string-matching",
    description: "Rolling-hash search: compares hash values of text windows with the pattern hash and verifies only on hash hits.",
    complexity: { best: "O(n + m)", average: "O(n + m)", worst: "O(n·m)", space: "O(1)", notes: `Polynomial rolling hash, base ${BASE}, modulus ${MOD}. Worst case occurs with many hash collisions.` },
    input: {
      fields: ["text", "pattern"],
      requirements: "Non-empty text and a non-empty pattern no longer than the text.",
      output: "Match indices, number of hash hits and spurious hits (collisions).",
      example: { text: "GEEKS FOR GEEKS", pattern: "GEEK" },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "h ← BASE^(m−1) mod q",
      "hp ← hash(P); ht ← hash(T[0..m−1])",
      "for s ← 0 to n − m:",
      "  if hp = ht:",
      "    verify T[s..s+m−1] = P char by char",
      "    if equal: report s  else: spurious hit",
      "  if s < n − m:",
      "    ht ← (BASE·(ht − T[s]·h) + T[s+m]) mod q  ▷ roll",
    ],
    learning: {
      what: "Rabin–Karp uses hashing to filter candidate positions and only compares characters when hashes agree.",
      why: "Hashing lets each window be checked in O(1) amortised time and generalises naturally to searching many patterns of the same length or 2-D matching.",
      how: ["Compute the hash of the pattern and the first text window.", "Slide the window by one: remove the leading character and add the trailing one in O(1) (rolling hash).", "When hashes match, verify character by character to rule out collisions.", "Collisions that fail verification are 'spurious hits'."],
      example: "With base 256 and a prime modulus, 'GEEK' hashes to one value; every 4-character window of the text is hashed incrementally.",
      advantages: ["Simple O(n + m) expected time", "Extends to multiple equal-length patterns and plagiarism detection", "Rolling hash is useful beyond matching"],
      limitations: ["Worst case O(n·m) with adversarial collisions", "Modular arithmetic overhead per character", "Hash quality matters"],
      applications: ["Plagiarism detection (fingerprinting)", "Duplicate-content detection", "Multiple pattern search of equal length"],
    },
    model: "n+m",
    maxBenchmarkSize: 5_000_000,
    vizLimits: { text: 200, pattern: 20 },
  },
  validate: validateSingle,
  inputSize: singleSize,
  run(input, ctx) {
    const text = input.text!;
    const pattern = input.pattern!;
    const n = text.length;
    const m = pattern.length;
    let h = 1;
    for (let i = 0; i < m - 1; i++) h = (h * BASE) % MOD;
    let hp = 0;
    let ht = 0;
    for (let i = 0; i < m; i++) {
      hp = (BASE * hp + pattern.charCodeAt(i)) % MOD;
      ht = (BASE * ht + text.charCodeAt(i)) % MOD;
      ctx.counters.operations += 2;
    }
    const matches: number[] = [];
    let hits = 0;
    let spurious = 0;
    for (let s = 0; s <= n - m; s++) {
      ctx.counters.comparisons++; // hash comparison
      const hashEq = hp === ht;
      ctx.step(() => ({
        phase: "Hash compare",
        description: hashEq ? `Window ${s}: hash ${ht} equals pattern hash ${hp}. Verify characters.` : `Window ${s}: hash ${ht} ≠ pattern hash ${hp}. Skip.`,
        line: 3,
        strings: windowStrings(text, pattern, s, { found: matches }),
        vars: { s, windowHash: ht, patternHash: hp, hashHits: hits, spurious, matches: matches.length },
      }));
      if (hashEq) {
        hits++;
        let j = 0;
        while (j < m) {
          ctx.counters.comparisons++;
          const ok = text[s + j] === pattern[j];
          ctx.step(() => ({
            phase: "Verify",
            description: ok ? `Verify T[${s + j}] = P[${j}] = '${pattern[j]}'.` : `Verify failed at P[${j}]: collision (spurious hit).`,
            line: 4,
            strings: windowStrings(text, pattern, s, { matched: range(0, j), compare: j, result: ok ? "match" : "mismatch", found: matches }),
            vars: { s, j, windowHash: ht, patternHash: hp },
          }));
          if (!ok) break;
          j++;
        }
        if (j === m) matches.push(s);
        else spurious++;
      }
      if (s < n - m) {
        const oldHash = ht;
        ht = (BASE * (ht - text.charCodeAt(s) * h) + text.charCodeAt(s + m)) % MOD;
        if (ht < 0) ht += MOD;
        ctx.counters.operations++;
        ctx.step(() => ({
          phase: "Roll",
          description: `Roll hash: remove '${text[s]}', add '${text[s + m]}'. ${oldHash} → ${ht}.`,
          line: 7,
          strings: windowStrings(text, pattern, s + 1, { found: matches, extra: { [s]: "mismatch", [s + m]: "active" } }),
          vars: { s: s + 1, windowHash: ht, patternHash: hp },
        }));
      }
    }
    return {
      output: { matches: matches.slice(0, 1000), totalMatches: matches.length, patternHash: hp, hashHits: hits, spuriousHits: spurious, base: BASE, modulus: MOD },
      matches,
      summary: `${matchSummary(matches, pattern)} Hash hits: ${hits}, spurious hits: ${spurious}.`,
      memoryBytes: 32,
    };
  },
};
