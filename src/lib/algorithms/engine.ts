import { AlgorithmDefinition, AlgorithmInput, ExecutionResult, RunContext, Step, ValidationError } from "./types";
import { getAlgorithm } from "./registry";

export interface ExecuteOptions {
  record?: boolean;
  maxSteps?: number;
}

export function createContext(record: boolean, maxSteps = 2500): RunContext {
  const ctx: RunContext = {
    record,
    maxSteps,
    counters: { comparisons: 0, operations: 0 },
    steps: [],
    truncated: false,
    step(build: () => Step) {
      if (!ctx.record) return;
      if (ctx.steps.length >= ctx.maxSteps) {
        ctx.truncated = true;
        return;
      }
      ctx.steps.push(build());
    },
  };
  return ctx;
}

function now(): number {
  return Number(process.hrtime.bigint()) / 1e6;
}

export function executeDefinition(def: AlgorithmDefinition, rawInput: AlgorithmInput, opts: ExecuteOptions = {}): ExecutionResult {
  const input = def.validate(rawInput);
  const record = opts.record ?? false;
  if (record) {
    const size = def.inputSize(input);
    const lim = def.meta.vizLimits;
    if (size.n > lim.text)
      throw new ValidationError(
        `Input is too large for step-by-step visualization (${size.n} > ${lim.text}). Use a smaller example or run it in the Algorithm Lab / Benchmark Lab.`,
      );
    if (lim.pattern && size.m > lim.pattern)
      throw new ValidationError(`Pattern is too long for visualization (max ${lim.pattern}).`);
    if (lim.items && size.k > lim.items) throw new ValidationError(`Too many items for visualization (max ${lim.items}).`);
  }
  const ctx = createContext(record, opts.maxSteps ?? 2500);
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = now();
  const out = def.run(input, ctx);
  const runtimeMs = now() - t0;
  const heapDelta = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
  const size = def.inputSize(input);
  const preview = (input.text ?? input.documents?.join(" | ") ?? input.patterns?.join(", ") ?? "").slice(0, 160);
  return {
    algorithmId: def.meta.id,
    algorithm: def.meta.name,
    category: def.meta.category,
    input: { ...size, preview },
    output: out.output,
    matches: out.matches,
    summary: out.summary,
    metrics: {
      runtimeMs,
      comparisons: ctx.counters.comparisons,
      operations: ctx.counters.operations,
      throughputCharsPerSec: runtimeMs > 0 ? (size.n / runtimeMs) * 1000 : 0,
      memoryBytes: out.memoryBytes,
      heapDeltaBytes: heapDelta,
      inputSize: size.n,
      patternSize: size.m,
      itemCount: size.k,
    },
    complexity: def.meta.complexity,
    steps: ctx.steps,
    stepsTruncated: ctx.truncated,
    pseudocode: def.meta.pseudocode,
    visualization: { tree: out.tree },
  };
}

export function executeAlgorithm(id: string, input: AlgorithmInput, opts: ExecuteOptions = {}): ExecutionResult {
  const def = getAlgorithm(id);
  if (!def) throw new ValidationError(`Unknown algorithm "${id}".`);
  return executeDefinition(def, input, opts);
}

/** Strip heavy fields when the caller does not need them (e.g. benchmarks). */
export function compactResult(r: ExecutionResult, maxMatches = 200): ExecutionResult {
  return {
    ...r,
    steps: [],
    matches: r.matches?.slice(0, maxMatches),
    visualization: {},
  };
}
