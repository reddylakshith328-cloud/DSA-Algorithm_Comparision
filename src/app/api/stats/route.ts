import { handle } from "@/lib/api";
import { listMeta, CATEGORIES } from "@/lib/algorithms/registry";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { benchmarkRepository, challengeRepository, experimentRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";

/** Dashboard overview aggregated from persisted records. */
export async function GET() {
  return handle(async () => {
    const [datasets, experiments, benchmarks, recentExperiments, recentBenchmarks, recentAttempts, datasetList] = await Promise.all([
      datasetRepository.count(),
      experimentRepository.count(),
      benchmarkRepository.count(),
      experimentRepository.list(6, 0),
      benchmarkRepository.recent(20),
      challengeRepository.recent(10),
      datasetRepository.list(),
    ]);
    const meta = listMeta();
    const activity = [
      ...recentExperiments.map((e) => ({ type: "experiment", label: `Experiment "${e.name}" (${e.mode})`, at: e.createdAt })),
      ...recentBenchmarks.map((b) => ({ type: "benchmark", label: `${b.kind} benchmark: ${(b.algorithms as string[]).join(", ")}`, at: b.createdAt })),
      ...recentAttempts.map((a) => ({ type: "challenge", label: `Challenge ${a.challengeId}: ${a.correct ? "solved" : "attempted"}`, at: a.createdAt })),
      ...datasetList.slice(0, 5).map((d) => ({ type: "dataset", label: `Dataset "${d.name}" v${d.currentVersion}`, at: d.updatedAt })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);
    // Aggregate measured medians from recorded compare benchmarks
    const perAlg = new Map<string, { runs: number; totalMs: number; totalN: number }>();
    for (const b of recentBenchmarks.filter((x) => x.kind === "compare")) {
      for (const s of b.summary as { id: string; status: string; median: number; n: number }[]) {
        if (s.status !== "ok") continue;
        const a = perAlg.get(s.id) ?? { runs: 0, totalMs: 0, totalN: 0 };
        a.runs++;
        a.totalMs += s.median;
        a.totalN += s.n;
        perAlg.set(s.id, a);
      }
    }
    return Response.json({
      totals: { algorithms: meta.length, categories: CATEGORIES.length, datasets, experiments, benchmarks, visualizable: meta.filter((m) => m.visualization).length },
      categories: CATEGORIES.map((c) => ({ ...c, count: meta.filter((m) => m.category === c.id).length, algorithms: meta.filter((m) => m.category === c.id).map((m) => ({ id: m.id, name: m.name })) })),
      recentExperiments,
      activity,
      benchmarkSummary: Array.from(perAlg.entries()).map(([id, a]) => ({ id, name: meta.find((m) => m.id === id)?.name ?? id, runs: a.runs, avgThroughput: a.totalMs > 0 ? (a.totalN / a.totalMs) * 1000 : 0, avgMedianMs: a.totalMs / a.runs })),
    });
  });
}
