import { AlgorithmInput, ValidationError } from "@/lib/algorithms/types";
import { sanitizeInput } from "@/lib/utils/validators";
import type { PreprocessConfig } from "@/lib/utils/preprocessing";
import { resolveInput } from "./experiment-service";
import { WorkloadSpec, WORKLOAD_TYPES, WorkloadType } from "./workloads";

/** Resolves a benchmark request body into either concrete input or a workload spec. */
export async function resolveBenchmarkSource(body: Record<string, unknown>): Promise<{ input?: AlgorithmInput; workload?: WorkloadSpec; dataset?: { id: number; name: string; version: number } }> {
  const src = (body.source ?? {}) as Record<string, unknown>;
  if (src.kind === "workload") {
    const w = (src.workload ?? {}) as Record<string, unknown>;
    if (!WORKLOAD_TYPES.some((t) => t.id === w.type)) throw new ValidationError("Unknown workload type.");
    return { workload: { type: w.type as WorkloadType, size: Number(w.size) || undefined, patternLength: Number(w.patternLength) || undefined, patternCount: Number(w.patternCount) || undefined, seed: Number(w.seed) || 42 } };
  }
  if (src.kind === "dataset") {
    const r = await resolveInput({ kind: "dataset", datasetId: Number(src.datasetId), version: src.version ? Number(src.version) : undefined, params: sanitizeInput(src.params) }, (body.preprocessing as PreprocessConfig) ?? null);
    return r;
  }
  return { input: sanitizeInput(src.input ?? body.input) };
}
