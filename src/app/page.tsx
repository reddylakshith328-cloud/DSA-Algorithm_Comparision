"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Database, FileText, FlaskConical, Gauge, MonitorPlay, Trophy } from "lucide-react";
import { fmtDate, fmtMs, fmtRate, useApi } from "@/lib/client/api";
import { Alert, Badge, Card, DataTable, Empty, MetricCard, Spinner } from "@/components/ui";
import { BenchmarkChart } from "@/components/charts";

interface Stats {
  totals: { algorithms: number; categories: number; datasets: number; experiments: number; benchmarks: number; visualizable: number };
  categories: { id: string; name: string; description: string; count: number; algorithms: { id: string; name: string }[] }[];
  recentExperiments: { id: number; name: string; mode: string; algorithms: string[]; createdAt: string; runCount: number }[];
  activity: { type: string; label: string; at: string }[];
  benchmarkSummary: { id: string; name: string; runs: number; avgThroughput: number; avgMedianMs: number }[];
}

const MODULES = [
  { href: "/algorithms", title: "Algorithm Lab", icon: FlaskConical, desc: "Execute any algorithm on your text and inspect output, metrics and complexity." },
  { href: "/visualizer", title: "Visualizer", icon: MonitorPlay, desc: "Step through internal states: comparisons, LPS, automata, DP tables." },
  { href: "/benchmark", title: "Benchmark Lab", icon: Gauge, desc: "Battles, input-size scaling, stress tests and recommendations." },
  { href: "/datasets", title: "Dataset Lab", icon: Database, desc: "Upload TXT/CSV, generate synthetic corpora, preprocess and version." },
  { href: "/experiments", title: "Experiments", icon: FileText, desc: "Save, re-run, duplicate, compare and export reproducible experiments." },
  { href: "/learning", title: "Learning Lab", icon: BookOpen, desc: "Explanations with interactive examples for each algorithm." },
];

export default function Dashboard() {
  const { data, error, loading } = useApi<Stats>("/api/stats");
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Advanced Algorithm Laboratory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">Large-Scale Text Analytics</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Explore algorithms. Understand their behaviour. Measure their performance. Every number shown in this laboratory comes from an actual execution on the server.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/visualizer?algo=kmp" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            <MonitorPlay className="h-4 w-4" /> Visualize KMP
          </Link>
          <Link href="/benchmark" className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Gauge className="h-4 w-4" /> Run a benchmark battle
          </Link>
          <Link href="/datasets" className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Database className="h-4 w-4" /> Add a dataset
          </Link>
          <Link href="/challenges" className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Trophy className="h-4 w-4" /> Solve a challenge
          </Link>
        </div>
      </section>

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Algorithm Lab" value={`${data.totals.algorithms} algorithms`} hint={`${data.totals.categories} categories · ${data.totals.visualizable} visualizable`} />
            <MetricCard label="Dataset Lab" value={`${data.totals.datasets} datasets`} hint="Versioned corpora" />
            <MetricCard label="Benchmark Lab" value={`${data.totals.benchmarks} runs`} hint="Measured benchmark executions" />
            <MetricCard label="Experiments" value={`${data.totals.experiments} saved`} hint="Reproducible configurations" />
          </div>

          <Card title="Laboratory modules">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <Link key={m.href} href={m.href} className="group rounded-md border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <m.icon className="h-4 w-4 text-indigo-600" /> {m.title}
                    <ArrowRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{m.desc}</p>
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Algorithm categories">
              <div className="space-y-3">
                {data.categories.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      <Badge tone="indigo">{c.count}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{c.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.algorithms.map((a) => (
                        <Link key={a.id} href={`/algorithms?algo=${a.id}`} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-indigo-100">
                          {a.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Performance overview" subtitle="Average measured throughput from recent Battle runs (depends on workloads chosen)">
              {data.benchmarkSummary.length === 0 ? (
                <Empty title="No benchmark data yet">Run a battle in the Benchmark Lab to populate this chart.</Empty>
              ) : (
                <>
                  <BenchmarkChart data={data.benchmarkSummary.map((b) => ({ name: b.name.split(" (")[0], throughput: Math.round(b.avgThroughput / 1000) }))} keys={[{ key: "throughput", label: "K chars/s" }]} height={220} />
                  <DataTable headers={["Algorithm", "Runs", "Avg median", "Avg throughput"]} rows={data.benchmarkSummary.map((b) => [b.name, b.runs, fmtMs(b.avgMedianMs), fmtRate(b.avgThroughput)])} />
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Recent experiments" actions={<Link href="/experiments" className="text-xs text-indigo-600 hover:underline">View all</Link>}>
              {data.recentExperiments.length === 0 ? (
                <Empty title="No experiments yet">Use “Save as experiment” in the Algorithm or Benchmark Lab.</Empty>
              ) : (
                <DataTable headers={["Name", "Mode", "Algorithms", "Runs", "Created"]} rows={data.recentExperiments.map((e) => [<Link key={e.id} className="text-indigo-600 hover:underline" href={`/experiments?id=${e.id}`}>{e.name}</Link>, <Badge key="m">{e.mode}</Badge>, e.algorithms.join(", "), e.runCount, fmtDate(e.createdAt)])} />
              )}
            </Card>
            <Card title="Recent activity">
              {data.activity.length === 0 ? (
                <Empty title="No activity yet" />
              ) : (
                <ul className="space-y-2">
                  {data.activity.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Badge tone={a.type === "experiment" ? "indigo" : a.type === "benchmark" ? "cyan" : a.type === "challenge" ? "amber" : "green"}>{a.type}</Badge>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{a.label}</span>
                      <span className="shrink-0 text-xs text-slate-400">{fmtDate(a.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
