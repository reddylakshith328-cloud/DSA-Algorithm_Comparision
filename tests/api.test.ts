import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listAlgorithms } from "@/app/api/algorithms/route";
import { GET as getAlgorithm, POST as runAlgorithm } from "@/app/api/algorithms/[id]/route";
import { POST as visualize } from "@/app/api/visualizer/run/route";
import { POST as recommendRoute } from "@/app/api/recommendation/route";
import { POST as benchRun } from "@/app/api/benchmark/run/route";

const post = (body: unknown) => new Request("http://x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("GET /api/algorithms lists 12 algorithms in 4 categories", async () => {
  const j = await (await listAlgorithms()).json();
  assert.equal(j.algorithms.length, 12);
  assert.equal(j.categories.length, 4);
});

test("GET /api/algorithms/{id} and 404", async () => {
  assert.equal((await getAlgorithm(new Request("http://x"), ctx("kmp"))).status, 200);
  assert.equal((await getAlgorithm(new Request("http://x"), ctx("nope"))).status, 404);
});

test("POST /api/algorithms/kmp executes and returns common result format", async () => {
  const res = await runAlgorithm(post({ input: { text: "abcabc", pattern: "bc" } }), ctx("kmp"));
  assert.equal(res.status, 200);
  const { result } = await res.json();
  assert.deepEqual(result.matches, [1, 4]);
  for (const k of ["output", "metrics", "complexity", "steps", "summary"]) assert.ok(k in result);
});

test("API returns friendly 400 errors for invalid input", async () => {
  const r1 = await runAlgorithm(post({ input: { text: "", pattern: "a" } }), ctx("kmp"));
  assert.equal(r1.status, 400);
  assert.match((await r1.json()).error, /must not be empty/);
  const r2 = await runAlgorithm(post("not json"), ctx("kmp"));
  assert.equal(r2.status, 400);
  const r3 = await visualize(post({ algorithmId: "kmp", input: { text: "a".repeat(1000), pattern: "a" } }));
  assert.equal(r3.status, 400);
});

test("POST /api/visualizer/run returns steps", async () => {
  const { result } = await (await visualize(post({ algorithmId: "kmp", input: { text: "ABABDABACDABABCABAB", pattern: "ABABCABAB" } }))).json();
  assert.ok(result.steps.length > 10);
  assert.ok(result.steps.some((s: { arrays?: { label: string }[] }) => s.arrays?.some((a) => a.label === "LPS")));
});

test("POST /api/recommendation and /api/benchmark/run", async () => {
  const r = await (await recommendRoute(post({ task: "single-pattern", textSize: 1000 }))).json();
  assert.ok(r.recommendations.length === 12);
  const b = await (await benchRun(post({ algorithmId: "naive", source: { kind: "workload", workload: { type: "small" } }, repetitions: 1 }))).json();
  assert.equal(b.entry.status, "ok");
});
