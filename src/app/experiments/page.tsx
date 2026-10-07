"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Download, FileText, GitCompare, RefreshCw, Trash2 } from "lucide-react";
import { api, download, fmtBytes, fmtDate, fmtMs, fmtNum, fmtRate, useApi } from "@/lib/client/api";
import { Alert, Badge, Button, Card, DataTable, Empty, PageHeader, Spinner } from "@/components/ui";
import { BenchmarkChart } from "@/components/charts";
import { BattleResults, BenchmarkEntry } from "@/components/benchmark/shared";
import { ScalingResult, ScalingView } from "@/components/benchmark/Scaling";
import { StressResult, StressView } from "@/components/benchmark/Stress";

interface SummaryRow {
  algorithmId: string;
  algorithm: string;
  label?: string;
  runtimeMs: number | null;
  comparisons: number | null;
  operations: number | null;
  throughput: number | null;
  memoryBytes: number | null;
  correctness?: string;
  exponent?: number | null;
}
interface Run {
  id: number;
  createdAt: string;
  summary: { rows: SummaryRow[]; inputSize: number | null; dataset: { id: number; name: string; version: number } | null };
  results: unknown;
}
interface Experiment {
  id: number;
  name: string;
  description: string;
  mode: string;
  algorithms: string[];
  config: Record<string, unknown>;
  datasetId: number | null;
  datasetVersion: number | null;
  parentId: number | null;
  environment: Record<string, unknown>;
  createdAt: string;
  runs: Run[];
  runCount?: number;
}

function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  return (
    <DataTable
      headers={["Algorithm", "Label", "Runtime", "Comparisons", "Operations", "Throughput", "Aux. memory", "Exponent / status"]}
      rows={rows.map((r) => [r.algorithm.replace(/ \(.*\)/, ""), r.label ?? "", fmtMs(r.runtimeMs), fmtNum(r.comparisons), fmtNum(r.operations), fmtRate(r.throughput), fmtBytes(r.memoryBytes), r.exponent !== undefined && r.exponent !== null ? `k = ${r.exponent.toFixed(2)}` : <span key="c" className="whitespace-normal text-xs">{r.correctness ?? ""}</span>])}
    />
  );
}

function RunResults({ exp, run }: { exp: Experiment; run: Run }) {
  const res = run.results as Record<string, unknown>;
  if (exp.mode === "compare" && Array.isArray(res.entries)) return <BattleResults entries={res.entries as BenchmarkEntry[]} title={`experiment_${exp.id}_run_${run.id}`} />;
  if (exp.mode === "scaling" && res.series) return <ScalingView result={res as unknown as ScalingResult} algorithms={exp.algorithms} />;
  if (exp.mode === "stress" && res.rows) return <StressView result={res as unknown as StressResult} algorithms={exp.algorithms} />;
  const runs = (res.runs ?? []) as { ok: boolean; result?: { algorithm: string; summary: string }; error?: string }[];
  return (
    <Card title="Execution results">
      <ul className="space-y-1 text-sm">
        {runs.map((r, i) => (
          <li key={i}>{r.ok ? <><b>{r.result!.algorithm}:</b> {r.result!.summary}</> : <span className="text-red-700">{r.error}</span>}</li>
        ))}
      </ul>
    </Card>
  );
}

function ExperimentDetail({ id, onChanged }: { id: number; onChanged: (deleted?: boolean) => void }) {
  const [exp, setExp] = useState<Experiment | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runIdx, setRunIdx] = useState(0);
  const router = useRouter();
  const load = async () => {
    const r = await api<{ experiment: Experiment }>(`/api/experiments/${id}`);
    if (r.error) setErr(r.error);
    else {
      setErr(null);
      setExp(r.data!.experiment);
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    setRunIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const act = async (kind: "rerun" | "duplicate" | "delete") => {
    if (kind === "delete" && !confirm("Delete this experiment and all its runs?")) return;
    setBusy(kind);
    const r = kind === "delete" ? await api(`/api/experiments/${id}`, { method: "DELETE" }) : await api<{ experiment: Experiment }>(`/api/experiments/${id}/${kind}`, { method: "POST" });
    setBusy(null);
    if (r.error) return setErr(r.error);
    if (kind === "delete") return onChanged(true);
    if (kind === "duplicate") {
      onChanged();
      router.replace(`/experiments?id=${(r.data as { experiment: Experiment }).experiment.id}`);
      return;
    }
    await load();
    setRunIdx(0);
    onChanged();
  };
  if (err) return <Alert>{err}</Alert>;
  if (!exp) return <Spinner />;
  const run = exp.runs[runIdx];
  // reproducibility: runtime per algorithm across runs
  const repro = exp.runs
    .slice()
    .reverse()
    .map((r, i) => {
      const row: Record<string, string | number | null> = { name: `run ${i + 1}` };
      for (const s of r.summary.rows ?? []) row[`${s.algorithm.replace(/ \(.*\)/, "")}${s.label ? ` [${s.label}]` : ""}`] = s.runtimeMs;
      return row;
    });
  const reproKeys = Array.from(new Set(repro.flatMap((r) => Object.keys(r).filter((k) => k !== "name")))).slice(0, 12);
  const exportErr = async (format: "json" | "csv") => {
    const e = await download("/api/reports/export", { experimentId: exp.id, format }, `experiment_${exp.id}.${format}`);
    if (e) setErr(e);
  };
  return (
    <div className="space-y-4">
      <Card
        title={<span className="text-base">{exp.name}</span>}
        subtitle={exp.description || `Created ${fmtDate(exp.createdAt)}${exp.parentId ? ` · duplicated from #${exp.parentId}` : ""}`}
        actions={
          <>
            <Button onClick={() => act("rerun")} loading={busy === "rerun"}><RefreshCw className="h-4 w-4" /> Re-run</Button>
            <Button variant="secondary" onClick={() => act("duplicate")} loading={busy === "duplicate"}><Copy className="h-4 w-4" /> Duplicate</Button>
            <Button variant="secondary" onClick={() => exportErr("json")}><Download className="h-4 w-4" /> JSON</Button>
            <Button variant="secondary" onClick={() => exportErr("csv")}><Download className="h-4 w-4" /> CSV</Button>
            <Link href={`/reports/${exp.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><FileText className="h-4 w-4" /> PDF report</Link>
            <Button variant="danger" onClick={() => act("delete")} loading={busy === "delete"}><Trash2 className="h-4 w-4" /></Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Configuration (reproducible)</div>
            <pre className="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">{JSON.stringify({ mode: exp.mode, algorithms: exp.algorithms, dataset: exp.datasetId ? { id: exp.datasetId, version: exp.datasetVersion } : null, ...exp.config }, null, 2)}</pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Environment</div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
              {Object.entries(exp.environment).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-mono text-slate-800">{String(v)}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-slate-500">Datasets are pinned to a version and generated workloads use a fixed seed, so re-runs use identical input. Runtimes vary with machine load.</p>
          </div>
        </div>
      </Card>
      {exp.runs.length === 0 ? (
        <Empty title="No runs yet">Click Re-run to execute this configuration.</Empty>
      ) : (
        <>
          <Card title={`Runs (${exp.runs.length})`} padded={false}>
            <div className="flex flex-wrap gap-1 p-3">
              {exp.runs.map((r, i) => (
                <button key={r.id} onClick={() => setRunIdx(i)} className={`rounded px-2 py-1 text-xs ${i === runIdx ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  #{exp.runs.length - i} · {fmtDate(r.createdAt)}
                </button>
              ))}
            </div>
            {run && <SummaryTable rows={run.summary.rows ?? []} />}
          </Card>
          {exp.runs.length > 1 && reproKeys.length > 0 && (
            <Card title="Run-to-run reproducibility" subtitle="Measured runtime (ms) of each algorithm across re-runs of the identical configuration.">
              <BenchmarkChart data={repro} keys={reproKeys.map((k) => ({ key: k, label: k }))} height={260} />
            </Card>
          )}
          {run && <RunResults exp={exp} run={run} />}
        </>
      )}
    </div>
  );
}

function CompareExperiments({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const [exps, setExps] = useState<Experiment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all(ids.map((id) => api<{ experiment: Experiment }>(`/api/experiments/${id}`))).then((rs) => {
      const e = rs.find((r) => r.error);
      if (e) setErr(e.error);
      else setExps(rs.map((r) => r.data!.experiment));
    });
  }, [ids]);
  if (err) return <Alert>{err}</Alert>;
  if (!exps) return <Spinner />;
  const keys = Array.from(new Set(exps.flatMap((e) => (e.runs[0]?.summary.rows ?? []).map((r) => `${r.algorithm.replace(/ \(.*\)/, "")}${r.label ? ` [${r.label}]` : ""}`))));
  const chart = keys.map((k) => {
    const row: Record<string, string | number | null> = { name: k };
    for (const e of exps) {
      const r = (e.runs[0]?.summary.rows ?? []).find((x) => `${x.algorithm.replace(/ \(.*\)/, "")}${x.label ? ` [${x.label}]` : ""}` === k);
      row[`#${e.id}`] = r?.runtimeMs ?? null;
    }
    return row;
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Comparing {exps.length} experiments (latest run of each)</h2>
        <Button variant="ghost" onClick={onClose}>Close comparison</Button>
      </div>
      <Card title="Median runtime by algorithm (ms)">
        <BenchmarkChart data={chart} keys={exps.map((e) => ({ key: `#${e.id}`, label: `#${e.id} ${e.name}` }))} height={300} />
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {exps.map((e) => (
          <Card key={e.id} title={`#${e.id} ${e.name}`} subtitle={`${e.mode} · input ${fmtNum(e.runs[0]?.summary.inputSize)} · ${e.datasetId ? `dataset #${e.datasetId} v${e.datasetVersion}` : "inline / workload"}`} padded={false}>
            {e.runs[0] ? <SummaryTable rows={e.runs[0].summary.rows} /> : <div className="p-4"><Empty title="No runs" /></div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExperimentsManager() {
  const { data, loading, error, reload } = useApi<{ experiments: Experiment[]; total: number }>("/api/experiments");
  const params = useSearchParams();
  const router = useRouter();
  const [checked, setChecked] = useState<number[]>([]);
  const [comparing, setComparing] = useState<number[] | null>(null);
  const list = data?.experiments ?? [];
  const selected = params.get("id") ? Number(params.get("id")) : list[0]?.id ?? null;
  return (
    <div>
      <PageHeader title="Experiments" description="Every experiment stores its algorithm(s), input source, parameters, preprocessing and environment. Re-run to reproduce, duplicate to branch, compare to analyse, export for reports." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card title={`Saved experiments (${data?.total ?? 0})`} padded={false} actions={<Button variant="secondary" disabled={checked.length < 2} onClick={() => setComparing(checked)}><GitCompare className="h-4 w-4" /> Compare ({checked.length})</Button>}>
          {loading && <div className="px-4"><Spinner /></div>}
          {error && <div className="p-4"><Alert>{error}</Alert></div>}
          {!loading && list.length === 0 && <div className="p-4"><Empty title="No experiments yet">Run something in the Algorithm or Benchmark Lab and click “Save as experiment”.</Empty></div>}
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {list.map((e) => (
              <li key={e.id} className={`flex items-start gap-2 px-3 py-2.5 ${selected === e.id && !comparing ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                <input type="checkbox" className="mt-1" checked={checked.includes(e.id)} onChange={() => setChecked(checked.includes(e.id) ? checked.filter((x) => x !== e.id) : [...checked, e.id])} aria-label={`Select ${e.name} for comparison`} />
                <button className="min-w-0 flex-1 text-left" onClick={() => { setComparing(null); router.replace(`/experiments?id=${e.id}`); }}>
                  <div className="truncate text-sm font-medium text-slate-800">#{e.id} {e.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <Badge tone="indigo">{e.mode}</Badge> {e.runCount ?? 0} run(s) · {fmtDate(e.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="min-w-0">
          {comparing ? (
            <CompareExperiments ids={comparing} onClose={() => setComparing(null)} />
          ) : selected ? (
            <ExperimentDetail key={selected} id={selected} onChanged={(deleted) => { reload(); if (deleted) router.replace("/experiments"); }} />
          ) : (
            !loading && <Empty title="Select an experiment" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ExperimentsManager />
    </Suspense>
  );
}
