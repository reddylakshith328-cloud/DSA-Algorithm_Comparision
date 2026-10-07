import { handle, jsonError, readJson } from "@/lib/api";
import { getAlgorithm } from "@/lib/algorithms/registry";
import { experimentRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | null | undefined>;

function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

/**
 * Export experiment reports.
 * Body: { experimentId, format: "json" | "csv" } or { payload: { title, rows }, format } for ad-hoc benchmark results.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const format = b.format === "csv" ? "csv" : "json";
    if (b.payload && typeof b.payload === "object") {
      const p = b.payload as { title?: string; rows?: Row[] };
      const rows = Array.isArray(p.rows) ? p.rows.slice(0, 50_000) : [];
      const fname = (p.title ?? "benchmark").replace(/[^a-z0-9-_]+/gi, "_");
      if (format === "csv") return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fname}.csv"` } });
      return new Response(JSON.stringify({ title: p.title, exportedAt: new Date().toISOString(), rows }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${fname}.json"` } });
    }
    const id = Number(b.experimentId);
    if (!Number.isInteger(id) || id <= 0) return jsonError("Provide an experimentId or a payload to export.");
    const e = await experimentRepository.get(id);
    if (!e) return jsonError("Experiment not found.", 404);
    const algorithms = (e.algorithms as string[]).map((a) => {
      const m = getAlgorithm(a)?.meta;
      return m ? { id: m.id, name: m.name, category: m.category, complexity: m.complexity } : { id: a };
    });
    const fname = `experiment_${e.id}_${e.name.replace(/[^a-z0-9-_]+/gi, "_")}`;
    if (format === "csv") {
      const rows: Row[] = [];
      for (const run of e.runs) {
        const s = run.summary as { rows?: Row[]; inputSize?: number };
        for (const r of s.rows ?? []) rows.push({ experimentId: e.id, experiment: e.name, mode: e.mode, runId: run.id, runAt: new Date(run.createdAt).toISOString(), inputSize: s.inputSize ?? null, datasetId: e.datasetId, datasetVersion: e.datasetVersion, ...r });
      }
      return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fname}.csv"` } });
    }
    const report = {
      report: "Advanced Algorithm Laboratory — Experiment Report",
      exportedAt: new Date().toISOString(),
      experiment: { id: e.id, name: e.name, description: e.description, mode: e.mode, createdAt: e.createdAt, parentId: e.parentId },
      dataset: e.datasetId ? { id: e.datasetId, version: e.datasetVersion } : null,
      configuration: e.config,
      environment: e.environment,
      algorithms,
      runs: e.runs.map((r) => ({ id: r.id, createdAt: r.createdAt, summary: r.summary, results: r.results })),
      note: "Theoretical complexity is listed separately from measured results. Runtimes depend on hardware and runtime environment.",
    };
    return new Response(JSON.stringify(report, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${fname}.json"` } });
  });
}
