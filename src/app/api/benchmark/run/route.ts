import { handle, readJson } from "@/lib/api";
import { benchmarkOne } from "@/lib/services/benchmark";
import { resolveBenchmarkSource } from "@/lib/services/benchmark-source";
import { adaptInput, generateWorkload } from "@/lib/services/workloads";
import { getAlgorithm } from "@/lib/algorithms/registry";
import { ValidationError } from "@/lib/algorithms/types";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const def = getAlgorithm(String(body.algorithmId));
    if (!def) throw new ValidationError("Unknown algorithm.");
    const src = await resolveBenchmarkSource(body);
    const input = src.workload ? adaptInput(def.meta.id, generateWorkload(src.workload), def.meta.maxBenchmarkSize) : adaptInput(def.meta.id, src.input ?? {}, Number.MAX_SAFE_INTEGER);
    return Response.json({ entry: benchmarkOne(def.meta.id, input, clampInt(body.repetitions, 1, 20, 3)) });
  });
}
