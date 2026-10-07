import { handle, readJson } from "@/lib/api";
import { stress } from "@/lib/services/benchmark";
import { benchmarkRepository } from "@/lib/repositories/experiment-repository";
import { WorkloadType } from "@/lib/services/workloads";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const algorithms = Array.isArray(b.algorithms) ? b.algorithms.map(String) : [];
    const workloads = (Array.isArray(b.workloads) ? b.workloads.map(String) : []) as WorkloadType[];
    const result = stress({ algorithms, workloads, size: clampInt(b.size, 100, 2_000_000, 50_000), patternLength: clampInt(b.patternLength, 1, 1000, 8), patternCount: clampInt(b.patternCount, 1, 500, 10), repetitions: clampInt(b.repetitions, 1, 10, 2), seed: clampInt(b.seed, 0, 1e9, 42) });
    await benchmarkRepository.record("stress", algorithms, { workloads, size: result.size }, result.rows.map((r) => ({ workload: r.workload, medians: Object.fromEntries(Object.entries(r.results).map(([k, v]) => [k, v.runtimeMs.median])) })));
    return Response.json(result);
  });
}
