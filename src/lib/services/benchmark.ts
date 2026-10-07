import { executeDefinition } from "@/lib/algorithms/engine";
import { getAlgorithm } from "@/lib/algorithms/registry";
import { AlgorithmInput, AlgorithmMeta, ExecutionResult, ValidationError } from "@/lib/algorithms/types";
import { referenceMatches } from "@/lib/algorithms/string-matching/common";
import { levenshtein } from "@/lib/algorithms/text-analytics/edit-distance";
import { adaptInput, generateWorkload, Workload, WORKLOAD_TYPES, WorkloadSpec, WorkloadType } from "./workloads";

export interface Correctness {
  status: "verified" | "failed" | "not-applicable" | "skipped";
  detail: string;
}

export interface BenchmarkEntry {
  algorithmId: string;
  algorithm: string;
  status: "ok" | "skipped" | "error";
  message?: string;
  runs: number;
  runtimeMs: { median: number; mean: number; min: number; max: number; stdev: number };
  comparisons: number;
  operations: number;
  throughputCharsPerSec: number;
  memoryBytes: number;
  heapDeltaBytes: number;
  inputSize: number;
  patternSize: number;
  itemCount: number;
  resultCount: number | null;
  correctness: Correctness;
  summary: string;
}

const TIME_BUDGET_MS = 25_000;
const SLOW_RUN_MS = 2_000;

function stats(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const median = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const stdev = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return { median, mean, min: s[0], max: s[s.length - 1], stdev };
}

function resultCount(r: ExecutionResult): number | null {
  const o = r.output as Record<string, unknown> | null;
  if (o && typeof o.totalMatches === "number") return o.totalMatches;
  return null;
}

function verify(id: string, input: AlgorithmInput, r: ExecutionResult): Correctness {
  const meta = getAlgorithm(id)!.meta;
  if (meta.category === "string-matching") {
    const ref = referenceMatches(input.text!, input.pattern!);
    const got = r.matches ?? [];
    const ok = ref.length === got.length && ref.every((v, i) => v === got[i]);
    return ok ? { status: "verified", detail: `${got.length} matches equal the reference (String.indexOf scan).` } : { status: "failed", detail: `Expected ${ref.length} matches, got ${got.length}.` };
  }
  if (id === "aho-corasick") {
    const expected = input.patterns!.reduce((s, p) => s + referenceMatches(input.text!, p).length, 0);
    const got = resultCount(r) ?? -1;
    return expected === got ? { status: "verified", detail: `${got} total occurrences equal per-pattern reference scans.` } : { status: "failed", detail: `Expected ${expected}, got ${got}.` };
  }
  if (id === "edit-distance") {
    if ((input.text!.length + 1) * (input.textB!.length + 1) > 4_000_000) return { status: "skipped", detail: "Reference check skipped for large inputs." };
    const d = levenshtein(input.text!, input.textB!);
    const got = (r.output as { distance: number }).distance;
    return d === got ? { status: "verified", detail: `Distance ${got} equals the O(m)-memory reference.` } : { status: "failed", detail: `Expected ${d}, got ${got}.` };
  }
  if (id === "suffix-array" || id === "kasai") {
    const t = input.text!;
    if (t.length > 20_000) return { status: "skipped", detail: "Order check skipped for inputs > 20K chars." };
    const sa = (r.output as { suffixArray: number[] }).suffixArray;
    for (let i = 1; i < Math.min(sa.length, 1000); i++) if (t.slice(sa[i - 1]) >= t.slice(sa[i])) return { status: "failed", detail: `Suffixes ${sa[i - 1]} and ${sa[i]} out of order.` };
    return { status: "verified", detail: "Adjacent suffixes are in strictly increasing lexicographic order." };
  }
  return { status: "not-applicable", detail: "No independent reference implementation; output is deterministic." };
}

export function benchmarkOne(id: string, input: AlgorithmInput, repetitions: number, sizeOverride?: number): BenchmarkEntry {
  const def = getAlgorithm(id);
  const empty = { median: 0, mean: 0, min: 0, max: 0, stdev: 0 };
  const base = { algorithmId: id, algorithm: def?.meta.name ?? id, runs: 0, runtimeMs: empty, comparisons: 0, operations: 0, throughputCharsPerSec: 0, memoryBytes: 0, heapDeltaBytes: 0, inputSize: 0, patternSize: 0, itemCount: 0, resultCount: null, summary: "" };
  if (!def) return { ...base, status: "error", message: "Unknown algorithm", correctness: { status: "skipped", detail: "" } };
  if (!def.meta.benchmark) return { ...base, status: "skipped", message: "Benchmarking not supported", correctness: { status: "skipped", detail: "" } };
  try {
    const size = def.inputSize(def.validate(input));
    if ((sizeOverride ?? size.n) > def.meta.maxBenchmarkSize) {
      return { ...base, inputSize: size.n, status: "skipped", message: `Input size ${size.n.toLocaleString()} exceeds this algorithm's benchmark limit (${def.meta.maxBenchmarkSize.toLocaleString()}).`, correctness: { status: "skipped", detail: "" } };
    }
    // warm-up run (JIT) not counted — unless it is already slow, in which case it becomes the only sample
    const warm = executeDefinition(def, input, { record: false });
    const times: number[] = [];
    let last: ExecutionResult | null = null;
    let heap = 0;
    if (warm.metrics.runtimeMs > SLOW_RUN_MS) {
      times.push(warm.metrics.runtimeMs);
      last = warm;
      repetitions = 1;
    }
    for (let r = times.length; r < repetitions; r++) {
      last = executeDefinition(def, input, { record: false });
      times.push(last.metrics.runtimeMs);
      heap = Math.max(heap, last.metrics.heapDeltaBytes);
    }
    const st = stats(times);
    const m = last!.metrics;
    return {
      ...base,
      status: "ok",
      runs: repetitions,
      runtimeMs: st,
      comparisons: m.comparisons,
      operations: m.operations,
      throughputCharsPerSec: st.median > 0 ? (m.inputSize / st.median) * 1000 : 0,
      memoryBytes: m.memoryBytes,
      heapDeltaBytes: heap,
      inputSize: m.inputSize,
      patternSize: m.patternSize,
      itemCount: m.itemCount,
      resultCount: resultCount(last!),
      correctness: verify(id, input, last!),
      summary: last!.summary,
    };
  } catch (e) {
    return { ...base, status: "error", message: e instanceof Error ? e.message : String(e), correctness: { status: "skipped", detail: "" } };
  }
}

export interface CompareRequest {
  algorithms: string[];
  input?: AlgorithmInput;
  workload?: WorkloadSpec;
  repetitions?: number;
}

function checkAlgorithms(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) throw new ValidationError("Select at least one algorithm.");
  if (ids.length > 12) throw new ValidationError("At most 12 algorithms per benchmark.");
  for (const id of ids) if (!getAlgorithm(id)) throw new ValidationError(`Unknown algorithm "${id}".`);
}

/** Run several algorithms against the same input. */
export function compare(req: CompareRequest) {
  checkAlgorithms(req.algorithms);
  const reps = Math.max(1, Math.min(20, req.repetitions ?? 3));
  const workload: Workload | null = req.workload ? generateWorkload(req.workload) : null;
  const source = workload ?? { ...(req.input ?? {}), words: undefined };
  const started = Date.now();
  const entries: BenchmarkEntry[] = [];
  for (const id of req.algorithms) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      entries.push({ ...benchmarkOne("__none__", {}, 1), algorithmId: id, algorithm: getAlgorithm(id)!.meta.name, status: "skipped", message: "Time budget exceeded" });
      continue;
    }
    const def = getAlgorithm(id)!;
    const input = workload ? adaptInput(id, workload, def.meta.maxBenchmarkSize) : adaptInput(id, source, Number.MAX_SAFE_INTEGER);
    entries.push(benchmarkOne(id, input, reps));
  }
  return { entries, repetitions: reps, workload: workload?.spec ?? null, inputPreview: (source.text ?? source.documents?.join(" ") ?? "").slice(0, 200) };
}

function modelValue(model: AlgorithmMeta["model"], n: number, m: number): number {
  const lg = Math.log2(Math.max(2, n));
  switch (model) {
    case "nm":
      return n * Math.max(1, m);
    case "n/m":
      return n / Math.max(1, m);
    case "n+m":
      return n + m;
    case "nlogn":
      return n * lg;
    case "nlog2n":
      return n * lg * lg;
    case "mn":
      return n * Math.max(1, m);
    default:
      return n;
  }
}

export interface ScalingRequest {
  algorithms: string[];
  sizes: number[];
  workload: WorkloadType;
  patternLength?: number;
  patternCount?: number;
  repetitions?: number;
  seed?: number;
}

/** Input-size scaling: empirical runtime vs size plus fitted theoretical curve and log-log slope. */
export function scaling(req: ScalingRequest) {
  checkAlgorithms(req.algorithms);
  const sizes = Array.from(new Set((req.sizes ?? []).map((s) => Math.floor(s)).filter((s) => s >= 10 && s <= 5_000_000))).sort((a, b) => a - b);
  if (sizes.length < 2) throw new ValidationError("Provide at least two distinct input sizes between 10 and 5,000,000.");
  if (sizes.length > 10) throw new ValidationError("At most 10 input sizes.");
  if (!WORKLOAD_TYPES.some((w) => w.id === req.workload)) throw new ValidationError("Unknown workload type.");
  const reps = Math.max(1, Math.min(10, req.repetitions ?? 3));
  const started = Date.now();
  const points: { size: number; results: Record<string, BenchmarkEntry> }[] = [];
  let budgetHit = false;
  for (const size of sizes) {
    const w = generateWorkload({ type: req.workload, size, patternLength: req.patternLength, patternCount: req.patternCount, seed: req.seed ?? 42 });
    const results: Record<string, BenchmarkEntry> = {};
    for (const id of req.algorithms) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        budgetHit = true;
        continue;
      }
      const def = getAlgorithm(id)!;
      if (size > def.meta.maxBenchmarkSize) continue;
      results[id] = benchmarkOne(id, adaptInput(id, w, def.meta.maxBenchmarkSize), reps, size);
    }
    points.push({ size, results });
  }
  const analysis = req.algorithms.map((id) => {
    const def = getAlgorithm(id)!;
    const pts = points.filter((p) => p.results[id]?.status === "ok").map((p) => ({ n: p.results[id].inputSize, m: p.results[id].patternSize, t: p.results[id].runtimeMs.median }));
    // least-squares constant c for t ≈ c·f(n)
    let num = 0;
    let den = 0;
    for (const p of pts) {
      const f = modelValue(def.meta.model, p.n, p.m);
      num += f * p.t;
      den += f * f;
    }
    const c = den ? num / den : 0;
    // empirical growth exponent from log-log regression
    const valid = pts.filter((p) => p.t > 0 && p.n > 0);
    let slope: number | null = null;
    if (valid.length >= 2) {
      const xs = valid.map((p) => Math.log(p.n));
      const ys = valid.map((p) => Math.log(p.t));
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let sxy = 0;
      let sxx = 0;
      xs.forEach((x, i) => {
        sxy += (x - mx) * (ys[i] - my);
        sxx += (x - mx) ** 2;
      });
      slope = sxx ? sxy / sxx : null;
    }
    return {
      algorithmId: id,
      algorithm: def.meta.name,
      theoretical: def.meta.complexity,
      model: def.meta.model,
      empiricalExponent: slope,
      fitted: pts.map((p) => ({ n: p.n, measured: p.t, theoretical: c * modelValue(def.meta.model, p.n, p.m) })),
    };
  });
  const series = points.map((p) => {
    const row: Record<string, number | null> = { size: p.size };
    for (const id of req.algorithms) {
      const e = p.results[id];
      row[id] = e?.status === "ok" ? e.runtimeMs.median : null;
      row[`${id}__cmp`] = e?.status === "ok" ? e.comparisons : null;
      const fit = analysis.find((a) => a.algorithmId === id)?.fitted.find((f) => f.n === e?.inputSize);
      row[`${id}__theory`] = fit ? fit.theoretical : null;
    }
    return row;
  });
  return { sizes, workload: req.workload, repetitions: reps, seed: req.seed ?? 42, points, series, analysis, budgetExceeded: budgetHit };
}

export interface StressRequest {
  algorithms: string[];
  workloads: WorkloadType[];
  size: number;
  patternLength?: number;
  patternCount?: number;
  repetitions?: number;
  seed?: number;
}

/** Runs algorithms across several workload types at a fixed size. */
export function stress(req: StressRequest) {
  checkAlgorithms(req.algorithms);
  const wls = (req.workloads ?? []).filter((w) => WORKLOAD_TYPES.some((t) => t.id === w));
  if (!wls.length) throw new ValidationError("Select at least one workload type.");
  const size = Math.max(100, Math.min(2_000_000, Math.floor(req.size || 50_000)));
  const reps = Math.max(1, Math.min(10, req.repetitions ?? 2));
  const started = Date.now();
  const rows: { workload: string; results: Record<string, BenchmarkEntry> }[] = [];
  let budgetHit = false;
  for (const wt of wls) {
    const sized = wt === "small" || wt === "medium" || wt === "large" ? undefined : size;
    const w = generateWorkload({ type: wt, size: sized, patternLength: req.patternLength, patternCount: req.patternCount, seed: req.seed ?? 42 });
    const results: Record<string, BenchmarkEntry> = {};
    for (const id of req.algorithms) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        budgetHit = true;
        continue;
      }
      const def = getAlgorithm(id)!;
      results[id] = benchmarkOne(id, adaptInput(id, w, def.meta.maxBenchmarkSize), reps);
    }
    rows.push({ workload: wt, results });
  }
  return { size, repetitions: reps, seed: req.seed ?? 42, rows, budgetExceeded: budgetHit };
}
