"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import type { AlgorithmMeta } from "@/lib/algorithms/types";
import { api, fmtBytes, fmtDate, fmtMs, fmtNum, fmtRate } from "@/lib/client/api";
import { BenchmarkChart } from "@/components/charts";

interface Row {
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
interface Exp {
  id: number;
  name: string;
  description: string;
  mode: string;
  algorithms: string[];
  config: Record<string, unknown>;
  datasetId: number | null;
  datasetVersion: number | null;
  environment: Record<string, unknown>;
  createdAt: string;
  runs: { id: number; createdAt: string; summary: { rows: Row[]; inputSize: number | null; dataset: { name: string; version: number } | null } }[];
}

/** Print-optimised report. Use the browser's "Save as PDF" to export a PDF. */
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [exp, setExp] = useState<Exp | null>(null);
  const [metas, setMetas] = useState<AlgorithmMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ experiment: Exp }>(`/api/experiments/${id}`).then((r) => (r.error ? setErr(r.error) : setExp(r.data!.experiment)));
    api<{ algorithms: AlgorithmMeta[] }>("/api/algorithms").then((r) => r.data && setMetas(r.data.algorithms));
  }, [id]);
  if (err) return <div className="p-8 text-red-700">{err}</div>;
  if (!exp) return <div className="p-8 text-slate-500">Loading report…</div>;
  const latest = exp.runs[0];
  const rows = latest?.summary.rows ?? [];
  const label = (r: Row) => `${r.algorithm.replace(/ \(.*\)/, "")}${r.label ? ` [${r.label}]` : ""}`;
  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-900 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <span>Use your browser&apos;s print dialog and choose “Save as PDF”.</span>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-white"><Printer className="h-4 w-4" /> Print / Save as PDF</button>
      </div>
      <header className="border-b-2 border-slate-900 pb-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">Advanced Algorithm Laboratory for Large-Scale Text Analytics</p>
        <h1 className="mt-1 text-2xl font-bold">Experiment Report #{exp.id}: {exp.name}</h1>
        <p className="text-sm text-slate-600">Generated {new Date().toLocaleString()} · Experiment created {fmtDate(exp.createdAt)}</p>
      </header>
      <section className="mt-5">
        <h2 className="text-lg font-semibold">1. Experiment information</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <tr><td className="w-48 py-0.5 text-slate-500">Mode</td><td>{exp.mode}</td></tr>
            <tr><td className="py-0.5 text-slate-500">Description</td><td>{exp.description || "—"}</td></tr>
            <tr><td className="py-0.5 text-slate-500">Dataset</td><td>{latest?.summary.dataset ? `${latest.summary.dataset.name} (v${latest.summary.dataset.version})` : exp.datasetId ? `#${exp.datasetId} v${exp.datasetVersion}` : "Inline input / generated workload"}</td></tr>
            <tr><td className="py-0.5 text-slate-500">Input size</td><td>{fmtNum(latest?.summary.inputSize)} characters</td></tr>
            <tr><td className="py-0.5 text-slate-500">Runs recorded</td><td>{exp.runs.length}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="mt-5">
        <h2 className="text-lg font-semibold">2. Parameters & configuration</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">{JSON.stringify(exp.config, (k, v) => (typeof v === "string" && v.length > 400 ? v.slice(0, 400) + "…" : v), 2)}</pre>
      </section>
      <section className="mt-5">
        <h2 className="text-lg font-semibold">3. Algorithms & theoretical complexity</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead><tr className="border-b border-slate-300 text-left"><th className="py-1">Algorithm</th><th>Best</th><th>Average</th><th>Worst</th><th>Space</th></tr></thead>
          <tbody>
            {exp.algorithms.map((a) => {
              const m = metas.find((x) => x.id === a);
              return <tr key={a} className="border-b border-slate-100"><td className="py-1">{m?.name ?? a}</td><td className="font-mono text-xs">{m?.complexity.best}</td><td className="font-mono text-xs">{m?.complexity.average}</td><td className="font-mono text-xs">{m?.complexity.worst}</td><td className="font-mono text-xs">{m?.complexity.space}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
      <section className="mt-5">
        <h2 className="text-lg font-semibold">4. Measured results (latest run{latest ? `, ${fmtDate(latest.createdAt)}` : ""})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No runs recorded.</p>
        ) : (
          <>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead><tr className="border-b border-slate-300 text-left"><th className="py-1">Algorithm</th><th>Runtime</th><th>Comparisons</th><th>Operations</th><th>Throughput</th><th>Memory</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100"><td className="py-1">{label(r)}</td><td>{fmtMs(r.runtimeMs)}</td><td>{fmtNum(r.comparisons)}</td><td>{fmtNum(r.operations)}</td><td>{fmtRate(r.throughput)}</td><td>{fmtBytes(r.memoryBytes)}</td><td className="text-xs">{r.exponent !== undefined && r.exponent !== null ? `k=${r.exponent.toFixed(2)}` : r.correctness ?? ""}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 break-inside-avoid">
              <h3 className="text-sm font-semibold">Runtime chart (ms)</h3>
              <BenchmarkChart data={rows.filter((r) => r.runtimeMs !== null).map((r) => ({ name: label(r), ms: r.runtimeMs }))} keys={[{ key: "ms", label: "ms" }]} height={260} />
            </div>
            {rows.some((r) => r.comparisons) && (
              <div className="mt-2 break-inside-avoid">
                <h3 className="text-sm font-semibold">Comparisons chart</h3>
                <BenchmarkChart data={rows.filter((r) => r.comparisons !== null).map((r) => ({ name: label(r), comparisons: r.comparisons }))} keys={[{ key: "comparisons", label: "comparisons" }]} height={240} />
              </div>
            )}
          </>
        )}
      </section>
      {exp.runs.length > 1 && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-semibold">5. Run history</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead><tr className="border-b border-slate-300 text-left"><th className="py-1">Run</th><th>When</th>{rows.map((r, i) => <th key={i}>{label(r)}</th>)}</tr></thead>
            <tbody>
              {exp.runs.map((run, i) => (
                <tr key={run.id} className="border-b border-slate-100"><td className="py-1">#{exp.runs.length - i}</td><td className="text-xs">{fmtDate(run.createdAt)}</td>{rows.map((r, j) => <td key={j}>{fmtMs(run.summary.rows.find((x) => label(x) === label(r))?.runtimeMs)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="mt-5">
        <h2 className="text-lg font-semibold">{exp.runs.length > 1 ? "6" : "5"}. Environment & reproducibility</h2>
        <table className="mt-2 w-full text-sm"><tbody>{Object.entries(exp.environment).map(([k, v]) => <tr key={k}><td className="w-48 py-0.5 text-slate-500">{k}</td><td className="font-mono text-xs">{String(v)}</td></tr>)}</tbody></table>
        <p className="mt-3 text-xs text-slate-500">Theoretical complexity is reported separately from empirical measurements. Runtimes are wall-clock medians measured on the environment above and will vary across machines; comparison and operation counts are deterministic for the pinned input.</p>
      </section>
    </div>
  );
}
