import { test } from "node:test";
import assert from "node:assert/strict";
import { benchmarkOne, compare, scaling, stress } from "@/lib/services/benchmark";
import { generateWorkload } from "@/lib/services/workloads";
import { parseProfile, recommend } from "@/lib/services/recommendation";

test("workload generation is deterministic for a seed", () => {
  const a = generateWorkload({ type: "random", size: 5000, seed: 9 });
  const b = generateWorkload({ type: "random", size: 5000, seed: 9 });
  assert.equal(a.text, b.text);
  assert.equal(a.text!.length, 5000);
  assert.notEqual(generateWorkload({ type: "random", size: 5000, seed: 10 }).text, a.text);
});

test("benchmarkOne returns measured statistics and verifies correctness", () => {
  const e = benchmarkOne("kmp", { text: "abcabcabd".repeat(1000), pattern: "abd" }, 3);
  assert.equal(e.status, "ok");
  assert.equal(e.runs, 3);
  assert.ok(e.runtimeMs.min <= e.runtimeMs.median && e.runtimeMs.median <= e.runtimeMs.max);
  assert.equal(e.correctness.status, "verified");
  assert.ok(e.throughputCharsPerSec > 0);
});

test("compare runs every algorithm on the same workload", () => {
  const r = compare({ algorithms: ["naive", "kmp", "boyer-moore", "aho-corasick"], workload: { type: "small", seed: 1 }, repetitions: 1 });
  assert.equal(r.entries.length, 4);
  for (const e of r.entries) assert.equal(e.correctness.status, "verified", e.algorithm);
});

test("scaling fits theory and computes exponents", () => {
  const r = scaling({ algorithms: ["kmp"], sizes: [2000, 8000, 32000], workload: "random", repetitions: 1 });
  assert.equal(r.series.length, 3);
  assert.equal(r.analysis[0].fitted.length, 3);
  assert.ok(r.analysis[0].empiricalExponent !== null);
});

test("stress covers workloads and skips oversize inputs", () => {
  const r = stress({ algorithms: ["naive", "edit-distance"], workloads: ["random", "worst-case"], size: 20000, repetitions: 1 });
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].results["naive"].status, "ok");
});

test("recommendation explains reasons and prefers Aho-Corasick for many patterns", () => {
  const r = recommend(parseProfile({ task: "multi-pattern", patternCount: 50, textSize: 1e6 }));
  const top = r.recommendations[0];
  assert.equal(top.algorithmId, "aho-corasick");
  assert.ok(top.reasons.length > 0);
  assert.throws(() => parseProfile({ task: "nonsense" }));
});
