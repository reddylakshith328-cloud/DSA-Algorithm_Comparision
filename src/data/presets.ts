import type { AlgorithmInput } from "@/lib/algorithms/types";

/** Small, visualization-friendly inputs (large inputs belong in the Benchmark Lab). */
export const PRESETS: Record<string, { label: string; input: AlgorithmInput }[]> = {
  kmp: [
    { label: "Classic (LPS reuse)", input: { text: "ABABDABACDABABCABAB", pattern: "ABABCABAB" } },
    { label: "Overlapping matches", input: { text: "AAAAABAAABA", pattern: "AAAB" } },
    { label: "Periodic pattern", input: { text: "abababcababababc", pattern: "ababc" } },
  ],
  naive: [
    { label: "Simple", input: { text: "AABAACAADAABAABA", pattern: "AABA" } },
    { label: "Worst case", input: { text: "AAAAAAAAAAAAAAB", pattern: "AAAAB" } },
  ],
  "rabin-karp": [
    { label: "Words", input: { text: "GEEKS FOR GEEKS", pattern: "GEEK" } },
    { label: "Digits", input: { text: "3141592653589793", pattern: "26535" } },
  ],
  "boyer-moore": [
    { label: "Large skips", input: { text: "HERE IS A SIMPLE EXAMPLE", pattern: "EXAMPLE" } },
    { label: "Good suffix", input: { text: "ABAABABACBABABABA", pattern: "ABABA" } },
  ],
  "aho-corasick": [
    { label: "he / she / his / hers", input: { text: "ushers", patterns: ["he", "she", "his", "hers"] } },
    { label: "Keywords", input: { text: "abccab abc", patterns: ["a", "ab", "bc", "bca", "c", "caa"] } },
  ],
  trie: [
    { label: "tea / ten / to", input: { patterns: ["tea", "ten", "to", "inn", "in", "tree"], query: "te" } },
    { label: "Autocomplete", input: { patterns: ["car", "card", "care", "careful", "cat", "dog"], query: "car" } },
  ],
  "suffix-array": [
    { label: "banana", input: { text: "banana" } },
    { label: "mississippi", input: { text: "mississippi" } },
  ],
  kasai: [
    { label: "banana", input: { text: "banana" } },
    { label: "abracadabra", input: { text: "abracadabra" } },
  ],
  "edit-distance": [
    { label: "kitten → sitting", input: { text: "kitten", textB: "sitting" } },
    { label: "sunday → saturday", input: { text: "sunday", textB: "saturday" } },
  ],
  tfidf: [
    { label: "Pets", input: { documents: ["the cat sat on the mat", "the dog sat on the log", "cats and dogs are pets", "the mat was red"] } },
    { label: "Tech news", input: { documents: ["new gpu speeds up deep learning training", "deep learning models need large data", "database indexing speeds up queries", "search engines use inverted indexes"] } },
  ],
  "inverted-index": [
    { label: "Home sales", input: { documents: ["new home sales top forecasts", "home sales rise in july", "increase in home sales in july", "july new home sales rise"], query: "home sales july" } },
  ],
  similarity: [
    { label: "ML sentences", input: { text: "Machine learning models learn patterns from data and improve predictions.", textB: "Deep learning models learn complex patterns from large data sets.", method: "cosine" } },
    { label: "Near duplicate", input: { text: "The quick brown fox jumps over the lazy dog", textB: "A quick brown fox jumped over a lazy dog", method: "jaccard" } },
  ],
};
