import { handle, readJson } from "@/lib/api";
import { scaling } from "@/lib/services/benchmark";
import { benchmarkRepository } from "@/lib/repositories/experiment-repository";
import { WorkloadType } from "@/lib/services/workloads";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const algorithms = Array.isArray(b.algorithms) ? b.algorithms.map(String) : [];
    const sizes = Array.isArray(b.sizes) ? b.sizes.map(Number) : [];
    const result = scaling({ algorithms, sizes, workload: String(b.workload ?? "random") as WorkloadType, patternLength: clampInt(b.patternLength, 1, 1000, 8), patternCount: clampInt(b.patternCount, 1, 500, 10), repetitions: clampInt(b.repetitions, 1, 10, 3), seed: clampInt(b.seed, 0, 1e9, 42) });
    await benchmarkRepository.record("scaling", algorithms, { sizes: result.sizes, workload: result.workload }, result.analysis.map((a) => ({ id: a.algorithmId, exponent: a.empiricalExponent })));
    return Response.json(result);
  });
}
