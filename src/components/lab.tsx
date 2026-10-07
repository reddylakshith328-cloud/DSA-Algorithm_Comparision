"use client";

import { useEffect, useState } from "react";
import type { AlgorithmInput, AlgorithmMeta, ExecutionResult } from "@/lib/algorithms/types";
import { api, fmtBytes, fmtMs, fmtNum, fmtRate } from "@/lib/client/api";
import { Badge, DataTable, Field, inputCls, MetricCard } from "@/components/ui";
import { Activity, Clock, Cpu, Gauge, HardDrive, Hash } from "lucide-react";

export interface Category {
  id: string;
  name: string;
  description: string;
}

let cache: { algorithms: AlgorithmMeta[]; categories: Category[] } | null = null;

export function useAlgorithms() {
  const [state, setState] = useState<{ algorithms: AlgorithmMeta[]; categories: Category[]; error: string | null; loading: boolean }>({ algorithms: cache?.algorithms ?? [], categories: cache?.categories ?? [], error: null, loading: !cache });
  useEffect(() => {
    if (cache) return;
    api<{ algorithms: AlgorithmMeta[]; categories: Category[] }>("/api/algorithms").then((r) => {
      if (r.data) cache = r.data;
      setState({ algorithms: r.data?.algorithms ?? [], categories: r.data?.categories ?? [], error: r.error, loading: false });
    });
  }, []);
  return state;
}

export type FormState = Record<string, string>;

const LABELS: Record<string, Partial<Record<string, string>>> = {
  "edit-distance": { text: "Source string", textB: "Target string" },
  similarity: { text: "Document A", textB: "Document B" },
  trie: { patterns: "Words to insert (one per line)", query: "Prefix / word query" },
  "aho-corasick": { patterns: "Patterns (one per line)" },
  "inverted-index": { query: "Search query" },
};

export function formFromInput(i: AlgorithmInput): FormState {
  return {
    text: i.text ?? "",
    pattern: i.pattern ?? "",
    patterns: (i.patterns ?? []).join("\n"),
    documents: (i.documents ?? []).join("\n"),
    query: i.query ?? "",
    textB: i.textB ?? "",
    method: i.method ?? "cosine",
  };
}

export function inputFromForm(meta: AlgorithmMeta, f: FormState): AlgorithmInput {
  const out: AlgorithmInput = {};
  const lines = (s: string) => s.split("\n").map((x) => x.replace(/\r$/, "")).filter((x) => x.trim().length > 0);
  for (const field of meta.input.fields) {
    if (field === "patterns") out.patterns = lines(f.patterns ?? "");
    else if (field === "documents") out.documents = lines(f.documents ?? "");
    else (out as Record<string, string>)[field] = f[field] ?? "";
  }
  return out;
}

export function AlgorithmInputForm({ meta, form, onChange, compact = false, exclude = [] }: { meta: AlgorithmMeta; form: FormState; onChange: (f: FormState) => void; compact?: boolean; exclude?: string[] }) {
  const set = (k: string, v: string) => onChange({ ...form, [k]: v });
  const label = (k: string, d: string) => LABELS[meta.id]?.[k] ?? d;
  const rows = compact ? 3 : 5;
  return (
    <div className="space-y-3">
      {meta.input.fields
        .filter((f) => !exclude.includes(f))
        .map((f) => {
          if (f === "text")
            return (
              <Field key={f} label={label("text", "Text")} hint={`${(form.text ?? "").length.toLocaleString()} characters`}>
                <textarea className={`${inputCls} font-mono`} rows={rows} value={form.text ?? ""} onChange={(e) => set("text", e.target.value)} />
              </Field>
            );
          if (f === "textB")
            return (
              <Field key={f} label={label("textB", "Second text")}>
                <textarea className={`${inputCls} font-mono`} rows={compact ? 2 : 4} value={form.textB ?? ""} onChange={(e) => set("textB", e.target.value)} />
              </Field>
            );
          if (f === "pattern")
            return (
              <Field key={f} label={label("pattern", "Pattern")}>
                <input className={`${inputCls} font-mono`} value={form.pattern ?? ""} onChange={(e) => set("pattern", e.target.value)} />
              </Field>
            );
          if (f === "patterns" || f === "documents")
            return (
              <Field key={f} label={label(f, f === "patterns" ? "Patterns (one per line)" : "Documents (one per line)")} hint={`${(form[f] ?? "").split("\n").filter((x) => x.trim()).length} item(s)`}>
                <textarea className={`${inputCls} font-mono`} rows={rows} value={form[f] ?? ""} onChange={(e) => set(f, e.target.value)} />
              </Field>
            );
          if (f === "query")
            return (
              <Field key={f} label={label("query", "Query")}>
                <input className={`${inputCls} font-mono`} value={form.query ?? ""} onChange={(e) => set("query", e.target.value)} />
              </Field>
            );
          if (f === "method")
            return (
              <Field key={f} label="Similarity method">
                <select className={inputCls} value={form.method ?? "cosine"} onChange={(e) => set("method", e.target.value)}>
                  <option value="cosine">Cosine (term frequency)</option>
                  <option value="jaccard">Jaccard (token sets)</option>
                  <option value="dice">Sørensen–Dice</option>
                  <option value="overlap">Overlap coefficient</option>
                </select>
              </Field>
            );
          return null;
        })}
    </div>
  );
}

export function ComplexityTable({ meta }: { meta: AlgorithmMeta }) {
  const c = meta.complexity;
  return (
    <div>
      <DataTable headers={["Best", "Average", "Worst", "Space"]} rows={[[<code key="b">{c.best}</code>, <code key="a">{c.average}</code>, <code key="w">{c.worst}</code>, <code key="s">{c.space}</code>]]} />
      {c.notes && <p className="mt-2 text-xs text-slate-500">{c.notes}</p>}
    </div>
  );
}

export function MetricsGrid({ r }: { r: ExecutionResult }) {
  const m = r.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MetricCard label="Runtime" value={fmtMs(m.runtimeMs)} icon={<Clock className="h-4 w-4" />} hint="single measured run" />
      <MetricCard label="Comparisons" value={fmtNum(m.comparisons)} icon={<Hash className="h-4 w-4" />} />
      <MetricCard label="Operations" value={fmtNum(m.operations)} icon={<Activity className="h-4 w-4" />} />
      <MetricCard label="Throughput" value={<span className="text-lg">{fmtRate(m.throughputCharsPerSec)}</span>} icon={<Gauge className="h-4 w-4" />} />
      <MetricCard label="Aux. memory" value={fmtBytes(m.memoryBytes)} icon={<HardDrive className="h-4 w-4" />} hint="estimated from structure sizes" />
      <MetricCard label="Input size" value={fmtNum(m.inputSize)} icon={<Cpu className="h-4 w-4" />} hint={`m = ${m.patternSize}, items = ${m.itemCount}`} />
    </div>
  );
}

/** Generic rendering of algorithm-specific output objects. */
export function OutputView({ output }: { output: unknown }) {
  if (output === null || output === undefined) return <span className="text-slate-400">—</span>;
  if (typeof output !== "object") return <span className="font-mono">{String(output)}</span>;
  if (Array.isArray(output)) {
    if (output.length === 0) return <span className="text-slate-400">[ ] (empty)</span>;
    if (typeof output[0] !== "object")
      return (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-auto">
          {output.slice(0, 300).map((v, i) => (
            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
              {String(v)}
            </span>
          ))}
          {output.length > 300 && <span className="text-xs text-slate-500">… {output.length - 300} more</span>}
        </div>
      );
    const keys = Array.from(new Set(output.slice(0, 50).flatMap((o) => Object.keys(o as object))));
    return (
      <div className="max-h-72 overflow-auto rounded border border-slate-200">
        <DataTable headers={keys} rows={output.slice(0, 100).map((o) => keys.map((k) => { const v = (o as Record<string, unknown>)[k]; return typeof v === "object" && v !== null ? <span key={k} className="font-mono text-xs">{Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ").slice(0, 120) : JSON.stringify(v).slice(0, 120)}</span> : String(v); }))} />
      </div>
    );
  }
  return (
    <dl className="divide-y divide-slate-100">
      {Object.entries(output as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
          <dt className="text-xs font-medium text-slate-500">{k}</dt>
          <dd className="min-w-0 text-sm">{typeof v === "object" && v !== null ? <OutputView output={v} /> : <span className="font-mono">{typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(4)) : String(v)}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CorrectnessBadge({ status }: { status: string }) {
  const tone = status === "verified" ? "green" : status === "failed" ? "red" : status === "not-applicable" ? "slate" : "amber";
  return <Badge tone={tone}>{status}</Badge>;
}
