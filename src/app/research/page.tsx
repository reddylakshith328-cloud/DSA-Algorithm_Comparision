"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Complexity } from "@/lib/algorithms/types";
import { fmtDate, fmtMs, fmtNum, PALETTE, useApi } from "@/lib/client/api";
import { Alert, Badge, Card, DataTable, Empty, PageHeader, Spinner, Tabs } from "@/components/ui";
import { BenchmarkChart } from "@/components/charts";
import { categoryName } from "@/lib/algorithms/categories";

interface Row {
  algorithmId: string;
  algorithm: string;
  label?: string;
  runtimeMs: number | null;
  comparisons: number | null;
  throughput: number | null;
  exponent?: number | null;
}
interface ResearchData {
  algorithms: { id: string; name: string; category: string; complexity: Complexity; model: string }[];
  runs: { id: number; experimentId: number; name: string; mode: string; createdAt: string; datasetId: number | null; datasetVersion: number | null; summary: { rows: Row[]; inputSize: number | null } }[];
  datasets: { id: number; name: string; version: number; stats: { characters: number; words: number; documents: number; vocabularySize: number } | null }[];
  scalingHistory: { at: string; config: { sizes: number[]; workload: string }; summary: { id: string; exponent: number | null }[] }[];
}

type Tab = "complexity" | "trends" | "datasets" | "reproducibility" | "history";

export default function ResearchPage() {
  const { data, loading, error } = useApi<ResearchData>("/api/research");
  const [tab, setTab] = useState<Tab>("complexity");
  const name = (id: string) => data?.algorithms.find((a) => a.id === id)?.name.replace(/ \(.*\)/, "") ?? id;

  // Performance trends: every measured (inputSize, runtime) pair from compare/run experiments
  const trend = useMemo(() => {
    const byAlg = new Map<string, { n: number; t: number; exp: string }[]>();
    for (const r of data?.runs ?? []) {
      if (!r.summary?.inputSize || r.mode === "scaling" || r.mode === "stress") continue;
      for (const s of r.summary.rows ?? []) if (s.runtimeMs !== null) byAlg.set(s.algorithmId, [...(byAlg.get(s.algorithmId) ?? []), { n: r.summary.inputSize, t: s.runtimeMs, exp: r.name }]);
    }
    return byAlg;
  }, [data]);

  // Reproducibility: coefficient of variation of runtime across runs of the same experiment
  const repro = useMemo(() => {
    const g = new Map<string, { exp: string; alg: string; label: string; ts: number[] }>();
    for (const r of data?.runs ?? [])
      for (const s of r.summary?.rows ?? []) {
        if (s.runtimeMs === null) continue;
        const k = `${r.experimentId}|${s.algorithmId}|${s.label ?? ""}`;
        const cur = g.get(k) ?? { exp: `#${r.experimentId} ${r.name}`, alg: s.algorithm, label: s.label ?? "", ts: [] };
        cur.ts.push(s.runtimeMs);
        g.set(k, cur);
      }
    return Array.from(g.values())
      .filter((x) => x.ts.length > 1)
      .map((x) => {
        const mean = x.ts.reduce((a, b) => a + b, 0) / x.ts.length;
        const sd = Math.sqrt(x.ts.reduce((a, b) => a + (b - mean) ** 2, 0) / x.ts.length);
        return { ...x, mean, sd, cv: mean ? sd / mean : 0, min: Math.min(...x.ts), max: Math.max(...x.ts) };
      });
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Research" description="Inspect measured results across all experiments. This page aggregates data only — it does not draw conclusions. Theoretical complexity is kept separate from empirical measurements." />
      <Tabs tabs={[{ id: "complexity", label: "Complexity comparison" }, { id: "trends", label: "Performance trends" }, { id: "datasets", label: "Dataset comparison" }, { id: "reproducibility", label: "Reproducibility" }, { id: "history", label: "Experiment history" }]} value={tab} onChange={setTab} />
      <div className="space-y-4 pt-4">
        {tab === "complexity" && (
          <>
            <Card title="Theoretical complexity of all algorithms" padded={false}>
              <DataTable headers={["Algorithm", "Category", "Best", "Average", "Worst", "Space", "Cost model"]} rows={data.algorithms.map((a) => [a.name, categoryName(a.category), <code key="b">{a.complexity.best}</code>, <code key="a">{a.complexity.average}</code>, <code key="w">{a.complexity.worst}</code>, <code key="s">{a.complexity.space}</code>, <code key="m">{a.model}</code>])} />
            </Card>
            <Card title="Empirical growth exponents from scaling benchmarks" subtitle="k from log–log regression (runtime ≈ a·nᵏ), as recorded in each scaling run.">
              {data.scalingHistory.length === 0 ? (
                <Empty title="No scaling runs yet"><Link className="text-indigo-600 underline" href="/benchmark?tab=scaling">Run a scaling benchmark</Link></Empty>
              ) : (
                <DataTable headers={["When", "Workload", "Sizes", "Exponents (k)"]} rows={data.scalingHistory.map((h) => [fmtDate(h.at), h.config.workload, h.config.sizes.map((s) => s.toLocaleString()).join(", "), <div key="e" className="flex flex-wrap gap-1">{h.summary.map((s) => <Badge key={s.id} tone="indigo">{name(s.id)}: {s.exponent === null ? "—" : s.exponent.toFixed(2)}</Badge>)}</div>])} />
              )}
            </Card>
          </>
        )}
        {tab === "trends" && (
          <Card title="Runtime vs input size across saved experiments" subtitle="Each point is one measured algorithm execution from a saved 'run' or 'compare' experiment.">
            {trend.size === 0 ? (
              <Empty title="No data yet">Save experiments from the Algorithm Lab or Benchmark Battle.</Empty>
            ) : (
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="n" name="input size" tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString()} label={{ value: "input size (chars)", position: "insideBottom", offset: -10, fontSize: 11 }} />
                    <YAxis type="number" dataKey="t" name="runtime" unit=" ms" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {Array.from(trend.entries()).map(([id, pts], i) => (
                      <Scatter key={id} name={name(id)} data={pts} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
        {tab === "datasets" && (
          <>
            <Card title="Dataset characteristics">
              {data.datasets.length === 0 ? (
                <Empty title="No datasets" />
              ) : (
                <>
                  <BenchmarkChart data={data.datasets.map((d) => ({ name: d.name.slice(0, 18), vocabulary: d.stats?.vocabularySize ?? 0, documents: d.stats?.documents ?? 0 }))} keys={[{ key: "vocabulary", label: "vocabulary" }, { key: "documents", label: "documents" }]} height={260} />
                  <DataTable headers={["Dataset", "Version", "Characters", "Words", "Documents", "Vocabulary", "Type/token ratio"]} rows={data.datasets.map((d) => [d.name, `v${d.version}`, fmtNum(d.stats?.characters), fmtNum(d.stats?.words), fmtNum(d.stats?.documents), fmtNum(d.stats?.vocabularySize), d.stats?.words ? (d.stats.vocabularySize / d.stats.words).toFixed(3) : "—"])} />
                </>
              )}
            </Card>
            <Card title="Measured runs grouped by dataset" padded={false}>
              <DataTable
                headers={["Dataset", "Experiment", "Algorithm", "Runtime", "Comparisons", "When"]}
                rows={data.runs.filter((r) => r.datasetId).flatMap((r) => (r.summary.rows ?? []).map((s) => [`${data.datasets.find((d) => d.id === r.datasetId)?.name ?? `#${r.datasetId} (deleted)`} v${r.datasetVersion}`, r.name, s.algorithm, fmtMs(s.runtimeMs), fmtNum(s.comparisons), fmtDate(r.createdAt)]))}
              />
            </Card>
          </>
        )}
        {tab === "reproducibility" && (
          <Card title="Run-to-run variation" subtitle="Experiments re-run with identical configuration. CV = standard deviation / mean of runtime. Correctness and operation counts are deterministic; timing variation reflects the environment." padded={false}>
            {repro.length === 0 ? (
              <div className="p-4"><Empty title="No re-runs yet">Open an experiment and click Re-run to collect repeated measurements.</Empty></div>
            ) : (
              <DataTable headers={["Experiment", "Algorithm", "Label", "Runs", "Mean", "Std dev", "Min", "Max", "CV"]} rows={repro.map((r) => [r.exp, r.alg, r.label, r.ts.length, fmtMs(r.mean), fmtMs(r.sd), fmtMs(r.min), fmtMs(r.max), <Badge key="cv" tone={r.cv < 0.1 ? "green" : r.cv < 0.3 ? "amber" : "red"}>{(r.cv * 100).toFixed(1)}%</Badge>])} />
            )}
          </Card>
        )}
        {tab === "history" && (
          <Card title={`Experiment history (${data.runs.length} runs)`} padded={false}>
            {data.runs.length === 0 ? (
              <div className="p-4"><Empty title="No experiment runs yet" /></div>
            ) : (
              <DataTable headers={["Run", "Experiment", "Mode", "Input size", "Algorithms", "Dataset", "When"]} rows={data.runs.map((r) => [`#${r.id}`, <Link key="l" className="text-indigo-600 hover:underline" href={`/experiments?id=${r.experimentId}`}>{r.name}</Link>, <Badge key="m">{r.mode}</Badge>, fmtNum(r.summary.inputSize), Array.from(new Set((r.summary.rows ?? []).map((s) => name(s.algorithmId)))).join(", "), r.datasetId ? `#${r.datasetId} v${r.datasetVersion}` : "—", fmtDate(r.createdAt)])} />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
