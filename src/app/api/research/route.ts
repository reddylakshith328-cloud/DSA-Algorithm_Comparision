import { handle } from "@/lib/api";
import { listMeta } from "@/lib/algorithms/registry";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { benchmarkRepository, experimentRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";

/** Aggregated, measured data for research analysis (no conclusions are computed server-side). */
export async function GET() {
  return handle(async () => {
    const [runs, experiments, datasets, benchmarks] = await Promise.all([experimentRepository.recentRuns(500), experimentRepository.list(200, 0), datasetRepository.list(), benchmarkRepository.recent(50)]);
    const expMap = new Map(experiments.map((e) => [e.id, e]));
    return Response.json({
      algorithms: listMeta().map((m) => ({ id: m.id, name: m.name, category: m.category, complexity: m.complexity, model: m.model })),
      runs: runs.map((r) => ({ ...r, datasetId: expMap.get(r.experimentId)?.datasetId ?? null, datasetVersion: expMap.get(r.experimentId)?.datasetVersion ?? null, config: expMap.get(r.experimentId)?.config ?? null })),
      datasets: datasets.map((d) => ({ id: d.id, name: d.name, version: d.currentVersion, stats: d.stats })),
      scalingHistory: benchmarks.filter((b) => b.kind === "scaling").map((b) => ({ at: b.createdAt, config: b.config, summary: b.summary })),
    });
  });
}
