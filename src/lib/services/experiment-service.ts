import os from "os";
import { compactResult, executeAlgorithm } from "@/lib/algorithms/engine";
import { getAlgorithm } from "@/lib/algorithms/registry";
import { AlgorithmInput, ValidationError } from "@/lib/algorithms/types";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { experimentRepository } from "@/lib/repositories/experiment-repository";
import { LIMITS, sanitizeInput } from "@/lib/utils/validators";
import { preprocess, PreprocessConfig, splitDocuments } from "@/lib/utils/preprocessing";
import { compare, scaling, stress } from "./benchmark";
import { WorkloadSpec, WorkloadType, WORKLOAD_TYPES } from "./workloads";

export const APP_VERSION = "1.0.0";

export type ExperimentMode = "run" | "compare" | "scaling" | "stress";

export type InputSource =
  | { kind: "inline"; input: AlgorithmInput }
  | { kind: "dataset"; datasetId: number; version?: number; params?: AlgorithmInput }
  | { kind: "workload"; workload: WorkloadSpec };

export interface ExperimentConfig {
  mode: ExperimentMode;
  algorithms: string[];
  source: InputSource;
  parameters: { repetitions?: number; sizes?: number[]; workloads?: WorkloadType[]; size?: number; patternLength?: number; patternCount?: number; seed?: number; workload?: WorkloadType };
  preprocessing?: PreprocessConfig | null;
}

export function environment() {
  return { app: "Advanced Algorithm Laboratory", appVersion: APP_VERSION, runtime: `Node.js ${process.version}`, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model ?? "unknown", cpus: os.cpus().length, memoryGB: Math.round(os.totalmem() / 1e9) };
}

export function parseConfig(raw: unknown): ExperimentConfig {
  if (!raw || typeof raw !== "object") throw new ValidationError("Experiment configuration is missing.");
  const c = raw as Record<string, unknown>;
  const mode = c.mode as ExperimentMode;
  if (!["run", "compare", "scaling", "stress"].includes(mode)) throw new ValidationError("Invalid experiment mode.");
  const algorithms = Array.isArray(c.algorithms) ? c.algorithms.map(String) : [];
  if (!algorithms.length) throw new ValidationError("Experiment must include at least one algorithm.");
  for (const a of algorithms) if (!getAlgorithm(a)) throw new ValidationError(`Unknown algorithm "${a}".`);
  const s = (c.source ?? {}) as Record<string, unknown>;
  let source: InputSource;
  if (s.kind === "dataset") {
    const id = Number(s.datasetId);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError("Invalid dataset reference.");
    source = { kind: "dataset", datasetId: id, version: s.version ? Number(s.version) : undefined, params: sanitizeInput(s.params) };
  } else if (s.kind === "workload") {
    const w = (s.workload ?? {}) as Record<string, unknown>;
    if (!WORKLOAD_TYPES.some((t) => t.id === w.type)) throw new ValidationError("Invalid workload type.");
    source = { kind: "workload", workload: { type: w.type as WorkloadType, size: Number(w.size) || undefined, patternLength: Number(w.patternLength) || undefined, patternCount: Number(w.patternCount) || undefined, seed: Number(w.seed) || 42 } };
  } else {
    const input = sanitizeInput(s.input);
    const size = JSON.stringify(input).length;
    if (size > LIMITS.maxInlineStoreChars) throw new ValidationError(`Inline input is too large to store in an experiment (${size.toLocaleString()} chars). Save it as a dataset first.`);
    source = { kind: "inline", input };
  }
  const p = (c.parameters ?? {}) as ExperimentConfig["parameters"];
  return { mode, algorithms, source, parameters: p, preprocessing: (c.preprocessing as PreprocessConfig) ?? null };
}

/** Resolves an input source to concrete algorithm input (loads datasets, applies preprocessing). */
export async function resolveInput(source: InputSource, pre?: PreprocessConfig | null): Promise<{ input: AlgorithmInput; dataset?: { id: number; name: string; version: number } }> {
  if (source.kind === "inline") {
    const input = { ...source.input };
    if (pre && input.text) input.text = preprocess(input.text, pre).text;
    return { input };
  }
  if (source.kind === "dataset") {
    const found = await datasetRepository.getVersion(source.datasetId, source.version);
    if (!found) throw new ValidationError(`Dataset #${source.datasetId}${source.version ? ` version ${source.version}` : ""} not found. It may have been deleted.`);
    let content = found.version.content;
    if (pre) content = preprocess(content, pre).text;
    const params = source.params ?? {};
    return {
      input: { ...params, text: content, documents: splitDocuments(content), textB: params.textB ?? params.pattern },
      dataset: { id: found.dataset.id, name: found.dataset.name, version: found.version.version },
    };
  }
  return { input: {} };
}

export async function executeConfig(cfg: ExperimentConfig) {
  const reps = cfg.parameters.repetitions ?? 3;
  const { input, dataset } = await resolveInput(cfg.source, cfg.preprocessing);
  const workload = cfg.source.kind === "workload" ? cfg.source.workload : undefined;
  let results: unknown;
  let summary: { algorithmId: string; algorithm: string; label?: string; runtimeMs: number | null; comparisons: number | null; operations: number | null; throughput: number | null; memoryBytes: number | null; correctness?: string; exponent?: number | null }[] = [];
  if (cfg.mode === "run") {
    const runs = cfg.algorithms.map((id) => {
      try {
        const r = compactResult(executeAlgorithm(id, input, { record: false }));
        return { ok: true as const, result: r };
      } catch (e) {
        return { ok: false as const, algorithmId: id, error: e instanceof Error ? e.message : String(e) };
      }
    });
    results = { runs };
    summary = runs.map((r) =>
      r.ok
        ? { algorithmId: r.result.algorithmId, algorithm: r.result.algorithm, runtimeMs: r.result.metrics.runtimeMs, comparisons: r.result.metrics.comparisons, operations: r.result.metrics.operations, throughput: r.result.metrics.throughputCharsPerSec, memoryBytes: r.result.metrics.memoryBytes }
        : { algorithmId: r.algorithmId, algorithm: getAlgorithm(r.algorithmId)?.meta.name ?? r.algorithmId, runtimeMs: null, comparisons: null, operations: null, throughput: null, memoryBytes: null, correctness: r.error },
    );
  } else if (cfg.mode === "compare") {
    const r = compare({ algorithms: cfg.algorithms, input: workload ? undefined : input, workload, repetitions: reps });
    results = r;
    summary = r.entries.map((e) => ({ algorithmId: e.algorithmId, algorithm: e.algorithm, runtimeMs: e.status === "ok" ? e.runtimeMs.median : null, comparisons: e.comparisons, operations: e.operations, throughput: e.throughputCharsPerSec, memoryBytes: e.memoryBytes, correctness: e.status === "ok" ? e.correctness.status : e.message }));
  } else if (cfg.mode === "scaling") {
    const r = scaling({ algorithms: cfg.algorithms, sizes: cfg.parameters.sizes ?? [1000, 10000, 100000], workload: cfg.parameters.workload ?? workload?.type ?? "medium", patternLength: cfg.parameters.patternLength, patternCount: cfg.parameters.patternCount, repetitions: reps, seed: cfg.parameters.seed });
    results = r;
    summary = r.analysis.map((a) => {
      const last = a.fitted[a.fitted.length - 1];
      return { algorithmId: a.algorithmId, algorithm: a.algorithm, label: `n = ${last?.n ?? "-"}`, runtimeMs: last?.measured ?? null, comparisons: null, operations: null, throughput: last ? (last.n / last.measured) * 1000 : null, memoryBytes: null, exponent: a.empiricalExponent };
    });
  } else {
    const r = stress({ algorithms: cfg.algorithms, workloads: cfg.parameters.workloads ?? ["random", "repetitive", "worst-case"], size: cfg.parameters.size ?? 50_000, patternLength: cfg.parameters.patternLength, patternCount: cfg.parameters.patternCount, repetitions: reps, seed: cfg.parameters.seed });
    results = r;
    summary = r.rows.flatMap((row) =>
      Object.values(row.results).map((e) => ({ algorithmId: e.algorithmId, algorithm: e.algorithm, label: row.workload, runtimeMs: e.status === "ok" ? e.runtimeMs.median : null, comparisons: e.comparisons, operations: e.operations, throughput: e.throughputCharsPerSec, memoryBytes: e.memoryBytes, correctness: e.status === "ok" ? e.correctness.status : e.message })),
    );
  }
  return { results, summary, dataset, inputSize: input.text?.length ?? input.documents?.join("").length ?? workload?.size ?? null };
}

export async function createAndRun(name: string, description: string, cfg: ExperimentConfig, runNow = true) {
  let datasetVersion: number | undefined;
  let datasetId: number | undefined;
  let exec: Awaited<ReturnType<typeof executeConfig>> | null = null;
  if (runNow) {
    exec = await executeConfig(cfg);
    datasetId = exec.dataset?.id;
    datasetVersion = exec.dataset?.version;
  } else if (cfg.source.kind === "dataset") {
    datasetId = cfg.source.datasetId;
    datasetVersion = cfg.source.version;
  }
  // pin dataset version for reproducibility
  if (cfg.source.kind === "dataset" && datasetVersion) cfg = { ...cfg, source: { ...cfg.source, version: datasetVersion } };
  const e = await experimentRepository.create({ name, description, mode: cfg.mode, algorithms: cfg.algorithms, config: cfg, datasetId: datasetId ?? null, datasetVersion: datasetVersion ?? null, environment: environment() });
  if (exec) await experimentRepository.addRun(e.id, exec.results, { rows: exec.summary, inputSize: exec.inputSize, dataset: exec.dataset ?? null, environment: environment() });
  return e;
}

export async function rerun(id: number) {
  const e = await experimentRepository.get(id);
  if (!e) throw new ValidationError("Experiment not found.");
  const cfg = parseConfig(e.config);
  const exec = await executeConfig(cfg);
  const run = await experimentRepository.addRun(id, exec.results, { rows: exec.summary, inputSize: exec.inputSize, dataset: exec.dataset ?? null, environment: environment() });
  return run;
}
