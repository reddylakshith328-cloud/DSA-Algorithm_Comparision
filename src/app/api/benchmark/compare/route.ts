import { handle, readJson } from "@/lib/api";
import { compare } from "@/lib/services/benchmark";
import { resolveBenchmarkSource } from "@/lib/services/benchmark-source";
import { benchmarkRepository } from "@/lib/repositories/experiment-repository";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

/** Algorithm battle: run several algorithms on the same input and collect measured metrics. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const algorithms = Array.isArray(body.algorithms) ? body.algorithms.map(String) : [];
    const src = await resolveBenchmarkSource(body);
    const result = compare({ algorithms, input: src.input, workload: src.workload, repetitions: clampInt(body.repetitions, 1, 20, 3) });
    await benchmarkRepository.record("compare", algorithms, { source: body.source ?? null, repetitions: result.repetitions }, result.entries.map((e) => ({ id: e.algorithmId, status: e.status, median: e.runtimeMs.median, comparisons: e.comparisons, n: e.inputSize })));
    return Response.json({ ...result, dataset: src.dataset ?? null });
  });
}
