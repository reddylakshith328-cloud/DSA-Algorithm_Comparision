import { executeAlgorithm } from "@/lib/algorithms/engine";
import { computeLPS } from "@/lib/algorithms/string-matching/kmp";
import { buildSuffixArray } from "@/lib/algorithms/text-structures/suffix-array";
import { levenshtein } from "@/lib/algorithms/text-analytics/edit-distance";
import { referenceMatches } from "@/lib/algorithms/string-matching/common";

export interface Challenge {
  id: string;
  title: string;
  algorithmId: string;
  kind: "Find a pattern" | "Build LPS" | "Complexity" | "Predict next step" | "Compare behaviour" | "Suffix array" | "Edit distance" | "Automaton";
  difficulty: "easy" | "medium" | "hard";
  problem: string;
  input: Record<string, string>;
  task: string;
  answerFormat: string;
  options?: string[];
  expected: () => string;
  explanation: () => string;
}

const normList = (s: string) =>
  s
    .replace(/[\[\]{}()]/g, "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .join(",");
export const normalize = (s: string) => normList(s.trim().toLowerCase());

const cmpNaiveKmp = () => {
  const text = "a".repeat(200);
  const p = "aaaab";
  const n = executeAlgorithm("naive", { text, pattern: p }).metrics.comparisons;
  const k = executeAlgorithm("kmp", { text, pattern: p }).metrics.comparisons;
  return { n, k };
};

export const CHALLENGES: Challenge[] = [
  {
    id: "find-pattern-1",
    title: "Locate every occurrence",
    algorithmId: "kmp",
    kind: "Find a pattern",
    difficulty: "easy",
    problem: "Find every starting index (0-based) where the pattern occurs in the text, including overlapping occurrences.",
    input: { text: "abracadabra abracadabra", pattern: "abra" },
    task: "List all match indices.",
    answerFormat: "Comma-separated integers, e.g. 0, 7",
    expected: () => referenceMatches("abracadabra abracadabra", "abra").join(","),
    explanation: () => `The pattern "abra" starts at ${referenceMatches("abracadabra abracadabra", "abra").join(", ")}. Note the occurrence at 7 overlaps the end of the first word ("…abra").`,
  },
  {
    id: "lps-1",
    title: "Build the LPS array",
    algorithmId: "kmp",
    kind: "Build LPS",
    difficulty: "medium",
    problem: "Compute the KMP failure function (LPS array) for the pattern. LPS[i] is the length of the longest proper prefix of P[0..i] that is also a suffix of it.",
    input: { pattern: "AABAACAABAA" },
    task: "Enter the LPS values for every position.",
    answerFormat: "Comma-separated integers (11 values)",
    expected: () => computeLPS("AABAACAABAA").join(","),
    explanation: () => `LPS = [${computeLPS("AABAACAABAA").join(", ")}]. At the final position "AABAA" is both a prefix and a suffix of the whole pattern, giving 5.`,
  },
  {
    id: "lps-2",
    title: "LPS of a periodic pattern",
    algorithmId: "kmp",
    kind: "Build LPS",
    difficulty: "easy",
    problem: "Compute the LPS array for a pattern with period 2.",
    input: { pattern: "ABABABAB" },
    task: "Enter the LPS values.",
    answerFormat: "Comma-separated integers",
    expected: () => computeLPS("ABABABAB").join(","),
    explanation: () => `LPS = [${computeLPS("ABABABAB").join(", ")}]. For a periodic string with period p, LPS[i] = i + 1 − p once the first period is complete.`,
  },
  {
    id: "kmp-next-step",
    title: "Predict KMP's next move",
    algorithmId: "kmp",
    kind: "Predict next step",
    difficulty: "medium",
    problem: "KMP is searching P = \"ABABC\" in T = \"ABABABC\". It has matched P[0..3] = \"ABAB\" against T[0..3] and now compares T[4] = 'A' with P[4] = 'C' — a mismatch.",
    input: { text: "ABABABC", pattern: "ABABC", i: "4", j: "4" },
    task: "What is the new value of j (the pattern index) after the mismatch?",
    answerFormat: "A single integer",
    expected: () => String(computeLPS("ABABC")[3]),
    explanation: () => `LPS("ABABC") = [${computeLPS("ABABC").join(", ")}]. On a mismatch at j = 4, KMP sets j = LPS[3] = ${computeLPS("ABABC")[3]}; i stays at 4. The prefix "AB" is already known to match.`,
  },
  {
    id: "complexity-1",
    title: "Worst case of Naive search",
    algorithmId: "naive",
    kind: "Complexity",
    difficulty: "easy",
    problem: "What is the worst-case time complexity of the naive string matching algorithm for text length n and pattern length m?",
    input: {},
    task: "Choose one.",
    answerFormat: "Select an option",
    options: ["O(n + m)", "O(n·m)", "O(n log m)", "O(n / m)"],
    expected: () => normalize("O(n·m)"),
    explanation: () => "At each of the n − m + 1 alignments up to m characters may be compared (e.g. T = aaaa…a, P = aa…ab), giving Θ(n·m).",
  },
  {
    id: "complexity-2",
    title: "Aho–Corasick running time",
    algorithmId: "aho-corasick",
    kind: "Complexity",
    difficulty: "medium",
    problem: "Aho–Corasick searches k patterns with total length m in a text of length n, reporting z matches. What is its running time (after building)?",
    input: {},
    task: "Choose one.",
    answerFormat: "Select an option",
    options: ["O(k·n)", "O(n + z)", "O(n·m)", "O(n log k)"],
    expected: () => normalize("O(n + z)"),
    explanation: () => "The automaton processes each text character in amortised O(1) (failure links are amortised like KMP) and emits each of the z matches once. Build cost is O(m·σ).",
  },
  {
    id: "compare-1",
    title: "Who compares less?",
    algorithmId: "kmp",
    kind: "Compare behaviour",
    difficulty: "medium",
    problem: "Run Naive and KMP on T = 'a' × 200 and P = 'aaaab'. The laboratory counts character comparisons.",
    input: { text: "a × 200", pattern: "aaaab" },
    task: "Which algorithm performs fewer character comparisons? (answer: naive or kmp)",
    answerFormat: "naive or kmp",
    options: ["naive", "kmp"],
    expected: () => {
      const { n, k } = cmpNaiveKmp();
      return k < n ? "kmp" : "naive";
    },
    explanation: () => {
      const { n, k } = cmpNaiveKmp();
      return `Measured by the laboratory: Naive = ${n} comparisons, KMP = ${k} comparisons (including LPS construction). Naive re-reads 4 'a's at every shift; KMP never moves the text pointer backwards.`;
    },
  },
  {
    id: "sa-1",
    title: "Construct a suffix array",
    algorithmId: "suffix-array",
    kind: "Suffix array",
    difficulty: "medium",
    problem: "Sort all suffixes of the string lexicographically and list their starting positions.",
    input: { text: "banana" },
    task: "Enter the suffix array.",
    answerFormat: "Comma-separated integers (6 values)",
    expected: () => buildSuffixArray("banana").join(","),
    explanation: () => `Sorted suffixes: a(5), ana(3), anana(1), banana(0), na(4), nana(2) → SA = [${buildSuffixArray("banana").join(", ")}].`,
  },
  {
    id: "sa-2",
    title: "Suffix array of mississippi",
    algorithmId: "suffix-array",
    kind: "Suffix array",
    difficulty: "hard",
    problem: "Build the suffix array of the classic example string.",
    input: { text: "mississippi" },
    task: "Enter the suffix array.",
    answerFormat: "Comma-separated integers (11 values)",
    expected: () => buildSuffixArray("mississippi").join(","),
    explanation: () => `SA = [${buildSuffixArray("mississippi").join(", ")}]. The first suffix is "i" (position 10), followed by "ippi" (7), "issippi" (4), "ississippi" (1).`,
  },
  {
    id: "ed-1",
    title: "Edit distance",
    algorithmId: "edit-distance",
    kind: "Edit distance",
    difficulty: "easy",
    problem: "Compute the Levenshtein distance (insert, delete, substitute each cost 1).",
    input: { source: "sunday", target: "saturday" },
    task: "Enter the minimum number of edits.",
    answerFormat: "A single integer",
    expected: () => String(levenshtein("sunday", "saturday")),
    explanation: () => `Distance = ${levenshtein("sunday", "saturday")}: insert 'a', insert 't', substitute 'n'→'r'.`,
  },
  {
    id: "ed-2",
    title: "Edit distance with transposition-like change",
    algorithmId: "edit-distance",
    kind: "Edit distance",
    difficulty: "medium",
    problem: "Compute the Levenshtein distance. Remember: plain Levenshtein has no transposition operation.",
    input: { source: "algorithm", target: "altruistic" },
    task: "Enter the minimum number of edits.",
    answerFormat: "A single integer",
    expected: () => String(levenshtein("algorithm", "altruistic")),
    explanation: () => `The DP table gives D[9][10] = ${levenshtein("algorithm", "altruistic")}. Open the Visualizer with these strings to trace the optimal path.`,
  },
  {
    id: "ac-1",
    title: "Count automaton matches",
    algorithmId: "aho-corasick",
    kind: "Automaton",
    difficulty: "medium",
    problem: "Using patterns {he, she, his, hers}, scan the text with Aho–Corasick.",
    input: { text: "ushers", patterns: "he, she, his, hers" },
    task: "How many pattern occurrences are reported in total?",
    answerFormat: "A single integer",
    expected: () => String((executeAlgorithm("aho-corasick", { text: "ushers", patterns: ["he", "she", "his", "hers"] }).output as { totalMatches: number }).totalMatches),
    explanation: () => "Reading 'ushe' reaches state 'she', whose output link also reports 'he'. Continuing with 'rs' reaches 'hers'. Total: she, he, hers = 3.",
  },
];

export function publicChallenge(c: Challenge) {
  const { expected, explanation, ...rest } = c;
  void expected;
  void explanation;
  return rest;
}
