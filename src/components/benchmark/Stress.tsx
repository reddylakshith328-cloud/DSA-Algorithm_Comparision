"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import type { AlgorithmMeta } from "@/lib/algorithms/types";
import { api, fmtMs, fmtNum } from "@/lib/client/api";
import { Alert, Button, Card, DataTable, Field, inputCls } from "@/components/ui";
import { CorrectnessBadge, type Category } from "@/components/lab";
import { BenchmarkChart } from "@/components/charts";
import { SaveExperiment } from "@/components/experiment-tools";
import { AlgoSelector, BenchmarkEntry, ExportButtons, WORKLOADS, WorkloadFields, WorkloadForm } from "./shared";

export interface StressResult {
  size: number;
  rows: { workload: string; results: Record<string, BenchmarkEntry> }[];
  budgetExceeded: boolean;
}

export function StressView({ result, algorithms }: { result: StressResult; algorithms: string[] }) {
  const short = (id: string) => {
    for (const r of result.rows) if (r.results[id]) return r.results[id].algorithm.replace(/ \(.*\)/, "");
    return id;
  };
  const chart = (key: "runtime" | "comparisons") =>
    result.rows.map((r) => {
      const row: Record<string, string | number | null> = { name: r.workload };
      for (const id of algorithms) {
        const e = r.results[id];
        row[id] = e?.status === "ok" ? (key === "runtime" ? +e.runtimeMs.median.toFixed(4) : e.comparisons) : null;
      }
      return row;
    });
  const flat = result.rows.flatMap((r) => Object.values(r.results).map((e) => ({ workload: r.workload, algorithm: e.algorithm, status: e.status, medianMs: e.runtimeMs.median, comparisons: e.comparisons, operations: e.operations, throughput: e.throughputCharsPerSec, inputSize: e.inputSize, correctness: e.correctness.status })));
  return (
    <div className="space-y-4">
      {result.budgetExceeded && <Alert tone="warning">Time budget reached; some combinations were skipped.</Alert>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Median runtime by workload (ms)">
          <BenchmarkChart data={chart("runtime")} keys={algorithms.map((id) => ({ key: id, label: short(id) }))} height={300} />
        </Card>
        <Card title="Comparisons by workload">
          <BenchmarkChart data={chart("comparisons")} keys={algorithms.map((id) => ({ key: id, label: short(id) }))} height={300} />
        </Card>
      </div>
      <Card title="Workload × algorithm matrix (median runtime / comparisons)" actions={<ExportButtons title="stress_test" rows={flat} />} padded={false}>
        <DataTable
          headers={["Workload", ...algorithms.map(short)]}
          rows={result.rows.map((r) => [
            <b key="w">{r.workload}</b>,
            ...algorithms.map((id) => {
              const e = r.results[id];
              if (!e) return "—";
              if (e.status !== "ok") return <span key={id} className="text-xs text-amber-700" title={e.message}>{e.status}</span>;
              return (
                <div key={id} className="space-y-0.5">
                  <div>{fmtMs(e.runtimeMs.median)}</div>
                  <div className="text-[11px] text-slate-500">{fmtNum(e.comparisons)} cmp · n={fmtNum(e.inputSize)}</div>
                  <CorrectnessBadge status={e.correctness.status} />
                </div>
              );
            }),
          ])}
        />
      </Card>
    </div>
  );
}

export function Stress({ algorithms, categories }: { algorithms: AlgorithmMeta[]; categories: Category[] }) {
  const [selected, setSelected] = useState<string[]>(["naive", "kmp", "rabin-karp", "boyer-moore"]);
  const [workloads, setWorkloads] = useState<string[]>(["random", "repetitive", "best-case", "worst-case", "adversarial"]);
  const [wl, setWl] = useState<WorkloadForm>({ type: "random", size: 100_000, patternLength: 8, patternCount: 10, seed: 42 });
  const [reps, setReps] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<StressResult | null>(null);
  const [ran, setRan] = useState<string[]>([]);
  const run = async () => {
    setBusy(true);
    setErr(null);
    const r = await api<StressResult>("/api/benchmark/stress", { body: { algorithms: selected, workloads, size: wl.size, patternLength: wl.patternLength, patternCount: wl.patternCount, repetitions: reps, seed: wl.seed } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else {
      setResult(r.data);
      setRan(selected);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Algorithms">
          <AlgoSelector algorithms={algorithms} categories={categories} value={selected} onChange={setSelected} />
        </Card>
        <Card title="Stress configuration">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Workload types</div>
              <div className="flex flex-wrap gap-1">
                {WORKLOADS.map(([id, label]) => (
                  <label key={id} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs ${workloads.includes(id) ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-600"}`}>
                    <input type="checkbox" className="sr-only" checked={workloads.includes(id)} onChange={() => setWorkloads(workloads.includes(id) ? workloads.filter((w) => w !== id) : [...workloads, id])} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <WorkloadFields value={wl} onChange={setWl} showType={false} />
            <div className="flex items-end gap-2">
              <Field label="Repetitions">
                <input type="number" min={1} max={10} className={`${inputCls} w-24`} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
              </Field>
              <Button onClick={run} loading={busy}>
                <Zap className="h-4 w-4" /> Run stress test
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {result && (
        <>
          <StressView result={result} algorithms={ran} />
          <SaveExperiment defaultName={`Stress test: ${ran.join(", ")}`} config={() => ({ mode: "stress", algorithms: ran, source: { kind: "workload", workload: { type: "random", seed: wl.seed } }, parameters: { workloads, size: wl.size, patternLength: wl.patternLength, patternCount: wl.patternCount, repetitions: reps, seed: wl.seed } })} />
        </>
      )}
    </div>
  );
}
