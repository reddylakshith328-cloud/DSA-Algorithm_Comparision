import { test } from "node:test";
import assert from "node:assert/strict";
import { executeAlgorithm } from "@/lib/algorithms/engine";
import { ALGORITHMS } from "@/lib/algorithms/registry";
import { computeLPS } from "@/lib/algorithms/string-matching/kmp";
import { referenceMatches } from "@/lib/algorithms/string-matching/common";
import { buildSuffixArray } from "@/lib/algorithms/text-structures/suffix-array";
import { levenshtein } from "@/lib/algorithms/text-analytics/edit-distance";
import { ValidationError } from "@/lib/algorithms/types";
import { mulberry32 } from "@/lib/services/workloads";

const SINGLE = ["naive", "kmp", "rabin-karp", "boyer-moore"];

test("every registered algorithm runs its own example and records steps", () => {
  for (const a of ALGORITHMS) {
    const r = executeAlgorithm(a.meta.id, a.meta.input.example, { record: true });
    assert.equal(r.algorithmId, a.meta.id);
    assert.ok(r.steps.length > 0, `${a.meta.id} produced no steps`);
    assert.ok(r.metrics.runtimeMs >= 0);
    assert.ok(r.summary.length > 0);
  }
});

test("single-pattern matchers agree with reference on random inputs", () => {
  const rand = mulberry32(7);
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(rand() * 60);
    const text = Array.from({ length: n }, () => "ab"[Math.floor(rand() * 2)]).join("");
    const m = 1 + Math.floor(rand() * Math.min(5, n));
    const pattern = Array.from({ length: m }, () => "ab"[Math.floor(rand() * 2)]).join("");
    const ref = referenceMatches(text, pattern);
    for (const id of SINGLE) assert.deepEqual(executeAlgorithm(id, { text, pattern }).matches, ref, `${id} on ${text}/${pattern}`);
  }
});

test("repeated characters and overlapping matches", () => {
  for (const id of SINGLE) assert.deepEqual(executeAlgorithm(id, { text: "aaaaa", pattern: "aa" }).matches, [0, 1, 2, 3]);
});

test("KMP LPS arrays", () => {
  assert.deepEqual(computeLPS("ABABCABAB"), [0, 0, 1, 2, 0, 1, 2, 3, 4]);
  assert.deepEqual(computeLPS("AAAA"), [0, 1, 2, 3]);
  assert.deepEqual(computeLPS("AABAACAABAA"), [0, 1, 0, 1, 2, 0, 1, 2, 3, 4, 5]);
});

test("KMP does at most 2n comparisons in search on worst-case input", () => {
  const text = "a".repeat(10_000);
  const r = executeAlgorithm("kmp", { text, pattern: "aaab" });
  assert.ok(r.metrics.comparisons <= 2 * text.length + 8);
  const naive = executeAlgorithm("naive", { text, pattern: "aaab" });
  assert.ok(naive.metrics.comparisons > r.metrics.comparisons);
});

test("empty input and empty pattern are rejected with ValidationError", () => {
  for (const id of SINGLE) {
    assert.throws(() => executeAlgorithm(id, { text: "", pattern: "a" }), ValidationError);
    assert.throws(() => executeAlgorithm(id, { text: "abc", pattern: "" }), ValidationError);
    assert.throws(() => executeAlgorithm(id, { text: "ab", pattern: "abc" }), ValidationError);
  }
  assert.throws(() => executeAlgorithm("aho-corasick", { text: "abc", patterns: [] }), ValidationError);
  assert.throws(() => executeAlgorithm("tfidf", { documents: [] }), ValidationError);
  assert.throws(() => executeAlgorithm("unknown-algo", {}), ValidationError);
});

test("visualization refuses inputs above its limit", () => {
  assert.throws(() => executeAlgorithm("kmp", { text: "a".repeat(5000), pattern: "a" }, { record: true }), ValidationError);
});

test("Aho-Corasick finds all dictionary occurrences", () => {
  const r = executeAlgorithm("aho-corasick", { text: "ushers", patterns: ["he", "she", "his", "hers"] });
  const out = r.output as { totalMatches: number; matches: { pattern: string; index: number }[] };
  assert.equal(out.totalMatches, 3);
  assert.deepEqual(out.matches.map((m) => `${m.pattern}@${m.index}`).sort(), ["he@2", "hers@2", "she@1"]);
});

test("Trie prefix search", () => {
  const out = executeAlgorithm("trie", { patterns: ["tea", "ten", "to", "inn"], query: "te" }).output as { completions: string[]; isWord: boolean };
  assert.deepEqual(out.completions, ["tea", "ten"]);
  assert.equal(out.isWord, false);
});

test("Suffix array and Kasai LCP", () => {
  assert.deepEqual(buildSuffixArray("banana"), [5, 3, 1, 0, 4, 2]);
  const out = executeAlgorithm("kasai", { text: "banana" }).output as { lcp: number[]; longestRepeatedSubstring: string; distinctSubstrings: number };
  assert.deepEqual(out.lcp, [0, 1, 3, 0, 0, 2]);
  assert.equal(out.longestRepeatedSubstring, "ana");
  assert.equal(out.distinctSubstrings, 15);
});

test("Suffix array is sorted on larger random text", () => {
  const rand = mulberry32(3);
  const t = Array.from({ length: 3000 }, () => "abc"[Math.floor(rand() * 3)]).join("");
  const sa = buildSuffixArray(t);
  for (let i = 1; i < sa.length; i++) assert.ok(t.slice(sa[i - 1]) < t.slice(sa[i]));
});

test("Edit distance", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal((executeAlgorithm("edit-distance", { text: "sunday", textB: "saturday" }).output as { distance: number }).distance, 3);
  assert.equal((executeAlgorithm("edit-distance", { text: "", textB: "abc" }).output as { distance: number }).distance, 3);
});

test("TF-IDF, inverted index and similarity", () => {
  const docs = ["the cat sat", "the dog sat", "cats and dogs"];
  const tf = executeAlgorithm("tfidf", { documents: docs }).output as { vocabularySize: number };
  assert.ok(tf.vocabularySize >= 5);
  const ii = executeAlgorithm("inverted-index", { documents: ["home sales", "home july", "sales july"], query: "home sales" }).output as { andResults: number[] };
  assert.deepEqual(ii.andResults, [0]);
  const sim = executeAlgorithm("similarity", { text: "a b c apple", textB: "apple", method: "jaccard" }).output as { method: { score: number } };
  assert.ok(sim.method.score > 0 && sim.method.score <= 1);
  const same = executeAlgorithm("similarity", { text: "machine learning", textB: "machine learning", method: "cosine" }).output as { method: { score: number } };
  assert.equal(same.method.score, 1);
});

test("large input executes within limits", () => {
  const text = "abcde".repeat(200_000);
  for (const id of SINGLE) assert.equal(executeAlgorithm(id, { text, pattern: "cdeab" }).matches!.length, 199_999);
});
