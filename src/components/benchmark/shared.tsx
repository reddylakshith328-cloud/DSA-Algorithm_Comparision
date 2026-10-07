"use client";

import { Download } from "lucide-react";
import type { AlgorithmMeta } from "@/lib/algorithms/types";
import { download, fmtBytes, fmtMs, fmtNum, fmtRate } from "@/lib/client/api";
import { Badge, Button, Card, DataTable, Field, inputCls } from "@/components/ui";
import { BenchmarkChart } from "@/components/charts";
import { CorrectnessBadge, type Category } from "@/components/lab";
import type { BenchmarkEntry } from "@/lib/services/benchmark";

export type { BenchmarkEntry };

export const WORKLOADS = [
  ["small", "Small (≈1K)"],
  ["medium", "Medium (≈100K)"],
  ["large", "Large (≈1M)"],
  ["random", "Random letters"],
  ["repetitive", "Repetitive"],
  ["best-case", "Best-case-like"],
  ["worst-case", "Worst-case-like"],
  ["pattern-heavy", "Pattern-heavy"],
  ["adversarial", "Adversarial"],
] as const;

export function AlgoSelector({ algorithms, categories, value, onChange }: { algorithms: AlgorithmMeta[]; categories: Category[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      {categories.map((c) => {
        const items = algorithms.filter((a) => a.category === c.id && a.benchmark);
        const all = items.every((i) => value.includes(i.id));
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.name}</span>
              <button className="text-[11px] text-indigo-600 hover:underline" onClick={() => onChange(all ? value.filter((v) => !items.some((i) => i.id === v)) : Array.from(new Set([...value, ...items.map((i) => i.id)])))}>
                {all ? "none" : "all"}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {items.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs ${value.includes(a.id) ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-600"}`}>
                  <input type="checkbox" className="sr-only" checked={value.includes(a.id)} onChange={() => toggle(a.id)} />
                  {a.name.replace(/ \(.*\)/, "")}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface WorkloadForm {
  type: string;
  size: number;
  patternLength: number;
  patternCount: number;
  seed: number;
}

export function WorkloadFields({ value, onChange, showType = true, showSize = true }: { value: WorkloadForm; onChange: (v: WorkloadForm) => void; showType?: boolean; showSize?: boolean }) {
  const set = (k: keyof WorkloadForm, v: string) => onChange({ ...value, [k]: k === "type" ? v : Number(v) });
  return (
    <div className="grid grid-cols-2 gap-2">
      {showType && (
        <Field label="Workload type">
          <select className={inputCls} value={value.type} onChange={(e) => set("type", e.target.value)}>
            {WORKLOADS.map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}
      {showSize && (
        <Field label="Size (chars)" hint={["small", "medium", "large"].includes(value.type) ? "Preset size is used for this type" : undefined}>
          <input type="number" className={inputCls} value={value.size} min={10} max={5000000} onChange={(e) => set("size", e.target.value)} />
        </Field>
      )}
      <Field label="Pattern length">
        <input type="number" className={inputCls} value={value.patternLength} min={1} max={1000} onChange={(e) => set("patternLength", e.target.value)} />
      </Field>
      <Field label="Pattern count">
        <input type="number" className={inputCls} value={value.patternCount} min={1} max={500} onChange={(e) => set("patternCount", e.target.value)} />
      </Field>
      <Field label="Seed" hint="Same seed → same data">
        <input type="number" className={inputCls} value={value.seed} onChange={(e) => set("seed", e.target.value)} />
      </Field>
    </div>
  );
}

export function entryRows(entries: BenchmarkEntry[]) {
  return entries.map((e) => ({ algorithm: e.algorithm, status: e.status, message: e.message ?? "", runs: e.runs, medianMs: e.runtimeMs.median, meanMs: e.runtimeMs.mean, minMs: e.runtimeMs.min, maxMs: e.runtimeMs.max, stdevMs: e.runtimeMs.stdev, comparisons: e.comparisons, operations: e.operations, throughputCharsPerSec: e.throughputCharsPerSec, memoryBytes: e.memoryBytes, inputSize: e.inputSize, patternSize: e.patternSize, results: e.resultCount, correctness: e.correctness.status }));
}

export function ExportButtons({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" onClick={() => download("/api/reports/export", { format: "csv", payload: { title, rows } }, `${title}.csv`)}>
        <Download className="h-4 w-4" /> CSV
      </Button>
      <Button variant="ghost" onClick={() => download("/api/reports/export", { format: "json", payload: { title, rows } }, `${title}.json`)}>
        <Download className="h-4 w-4" /> JSON
      </Button>
    </div>
  );
}

/** Measured comparison results — no winner is declared; the user interprets the data. */
export function BattleResults({ entries, title = "battle" }: { entries: BenchmarkEntry[]; title?: string }) {
  const ok = entries.filter((e) => e.status === "ok");
  const short = (n: string) => n.replace(/ \(.*\)/, "");
  return (
    <div className="space-y-4">
      <Card title="Measured results" subtitle="Median of repeated runs after one warm-up run. Correctness is verified against an independent reference where one exists." actions={<ExportButtons title={title} rows={entryRows(entries)} />} padded={false}>
        <DataTable
          headers={["Algorithm", "Median", "± stdev", "Min", "Comparisons", "Operations", "Throughput", "Aux. memory", "n", "Results", "Correctness"]}
          rows={entries.map((e) =>
            e.status === "ok"
              ? [short(e.algorithm), fmtMs(e.runtimeMs.median), fmtMs(e.runtimeMs.stdev), fmtMs(e.runtimeMs.min), fmtNum(e.comparisons), fmtNum(e.operations), fmtRate(e.throughputCharsPerSec), fmtBytes(e.memoryBytes), fmtNum(e.inputSize), e.resultCount ?? "—", <span key="c" title={e.correctness.detail}><CorrectnessBadge status={e.correctness.status} /></span>]
              : [short(e.algorithm), <Badge key="s" tone={e.status === "error" ? "red" : "amber"}>{e.status}</Badge>, <span key="m" className="whitespace-normal text-xs text-slate-500">{e.message}</span>, "", "", "", "", "", "", "", ""],
          )}
        />
      </Card>
      {ok.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Runtime (median, ms)">
            <BenchmarkChart data={ok.map((e) => ({ name: short(e.algorithm), ms: +e.runtimeMs.median.toFixed(4) }))} keys={[{ key: "ms", label: "ms" }]} height={230} />
          </Card>
          <Card title="Character comparisons">
            <BenchmarkChart data={ok.map((e) => ({ name: short(e.algorithm), comparisons: e.comparisons }))} keys={[{ key: "comparisons", label: "comparisons" }]} height={230} />
          </Card>
          <Card title="Throughput (K chars/s)">
            <BenchmarkChart data={ok.map((e) => ({ name: short(e.algorithm), throughput: Math.round(e.throughputCharsPerSec / 1000) }))} keys={[{ key: "throughput", label: "K chars/s" }]} height={230} />
          </Card>
        </div>
      )}
    </div>
  );
}
