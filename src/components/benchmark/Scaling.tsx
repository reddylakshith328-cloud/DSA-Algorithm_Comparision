"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { AlgorithmMeta, Complexity } from "@/lib/algorithms/types";
import { api, fmtMs, PALETTE } from "@/lib/client/api";
import { Alert, Button, Card, DataTable, Field, inputCls } from "@/components/ui";
import type { Category } from "@/components/lab";
import { ComplexityChart } from "@/components/charts";
import { SaveExperiment } from "@/components/experiment-tools";
import { AlgoSelector, ExportButtons, WorkloadFields, WorkloadForm } from "./shared";

export interface ScalingResult {
  sizes: number[];
  series: Record<string, number | null>[];
  analysis: { algorithmId: string; algorithm: string; theoretical: Complexity; model: string; empiricalExponent: number | null; fitted: { n: number; measured: number; theoretical: number }[] }[];
  budgetExceeded: boolean;
}

export function ScalingView({ result, algorithms }: { result: ScalingResult; algorithms: string[] }) {
  const [showTheory, setShowTheory] = useState(true);
  const [log, setLog] = useState(false);
  const [metric, setMetric] = useState<"runtime" | "comparisons">("runtime");
  const name = (id: string) => result.analysis.find((a) => a.algorithmId === id)?.algorithm.replace(/ \(.*\)/, "") ?? id;
  const lines = algorithms.flatMap((id, i) => {
    const base = [{ key: metric === "runtime" ? id : `${id}__cmp`, label: name(id), color: PALETTE[i % PALETTE.length] }];
    if (metric === "runtime" && showTheory) base.push({ key: `${id}__theory`, label: `${name(id)} (theory fit)`, color: PALETTE[i % PALETTE.length], dashed: true } as (typeof base)[number] & { dashed: boolean });
    return base;
  });
  return (
    <div className="space-y-4">
      {result.budgetExceeded && <Alert tone="warning">The time budget was reached; some measurements were skipped. Use smaller sizes or fewer algorithms.</Alert>}
      <Card
        title="Theoretical vs empirical scaling"
        subtitle="Solid = measured median runtime. Dashed = theoretical model c·f(n), with c fitted to the measurements by least squares."
        actions={
          <>
            <select className={`${inputCls} w-auto py-1 text-xs`} value={metric} onChange={(e) => setMetric(e.target.value as "runtime" | "comparisons")}>
              <option value="runtime">Runtime</option>
              <option value="comparisons">Comparisons</option>
            </select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showTheory} onChange={(e) => setShowTheory(e.target.checked)} /> theory</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> log–log</label>
            <ExportButtons title="scaling" rows={result.series} />
          </>
        }
      >
        <ComplexityChart data={result.series} lines={lines} yUnit={metric === "runtime" ? " ms" : ""} logScale={log} />
      </Card>
      <Card title="Complexity analysis" subtitle="Empirical exponent k from a log–log regression of runtime ≈ a·nᵏ. Compare it to the theoretical bound — k ≈ 1 suggests linear growth, k ≈ 2 quadratic." padded={false}>
        <DataTable
          headers={["Algorithm", "Theoretical (worst)", "Average", "Model f(n)", "Empirical exponent k", "Largest n", "Runtime at largest n"]}
          rows={result.analysis.map((a) => {
            const last = a.fitted[a.fitted.length - 1];
            return [a.algorithm, <code key="w">{a.theoretical.worst}</code>, <code key="a">{a.theoretical.average}</code>, <code key="m">{a.model}</code>, a.empiricalExponent === null ? "—" : a.empiricalExponent.toFixed(2), last?.n.toLocaleString() ?? "—", fmtMs(last?.measured)];
          })}
        />
      </Card>
    </div>
  );
}

export function Scaling({ algorithms, categories }: { algorithms: AlgorithmMeta[]; categories: Category[] }) {
  const [selected, setSelected] = useState<string[]>(["naive", "kmp", "boyer-moore"]);
  const [wl, setWl] = useState<WorkloadForm>({ type: "random", size: 0, patternLength: 8, patternCount: 10, seed: 42 });
  const [sizes, setSizes] = useState("10000, 50000, 100000, 250000, 500000");
  const [reps, setReps] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ScalingResult | null>(null);
  const [ran, setRan] = useState<string[]>([]);
  const sizeList = () => sizes.split(/[,\s]+/).map(Number).filter((n) => n > 0);
  const run = async () => {
    setBusy(true);
    setErr(null);
    const r = await api<ScalingResult>("/api/benchmark/scaling", { body: { algorithms: selected, sizes: sizeList(), workload: wl.type, patternLength: wl.patternLength, patternCount: wl.patternCount, repetitions: reps, seed: wl.seed } });
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
        <Card title="Input-size scaling">
          <div className="space-y-3">
            <WorkloadFields value={wl} onChange={setWl} showSize={false} />
            <Field label="Input sizes (comma-separated)" hint="2–10 sizes. Each algorithm skips sizes above its benchmark limit.">
              <input className={`${inputCls} font-mono`} value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </Field>
            <div className="flex items-end gap-2">
              <Field label="Repetitions">
                <input type="number" min={1} max={10} className={`${inputCls} w-24`} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
              </Field>
              <Button onClick={run} loading={busy}>
                <TrendingUp className="h-4 w-4" /> Run scaling test
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {result && (
        <>
          <ScalingView result={result} algorithms={ran} />
          <SaveExperiment defaultName={`Scaling (${wl.type}): ${ran.join(", ")}`} config={() => ({ mode: "scaling", algorithms: ran, source: { kind: "workload", workload: { type: wl.type, seed: wl.seed } }, parameters: { sizes: sizeList(), workload: wl.type, patternLength: wl.patternLength, patternCount: wl.patternCount, repetitions: reps, seed: wl.seed } })} />
        </>
      )}
    </div>
  );
}
