"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import type { AlgorithmMeta } from "@/lib/algorithms/types";
import { api } from "@/lib/client/api";
import { Alert, Button, Card, Field, inputCls } from "@/components/ui";
import type { Category } from "@/components/lab";
import { DatasetPicker, SaveExperiment } from "@/components/experiment-tools";
import { AlgoSelector, BattleResults, BenchmarkEntry, WorkloadFields, WorkloadForm } from "./shared";

export function Battle({ algorithms, categories }: { algorithms: AlgorithmMeta[]; categories: Category[] }) {
  const [selected, setSelected] = useState<string[]>(["naive", "kmp", "rabin-karp", "boyer-moore"]);
  const [source, setSource] = useState<"workload" | "inline" | "dataset">("workload");
  const [wl, setWl] = useState<WorkloadForm>({ type: "random", size: 200_000, patternLength: 8, patternCount: 10, seed: 42 });
  const [inline, setInline] = useState({ text: "the quick brown fox jumps over the lazy dog. the dog sleeps.", pattern: "the", patterns: "the\ndog\nfox", textB: "the quick brown cat jumps over the lazy dog", query: "dog" });
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [reps, setReps] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [entries, setEntries] = useState<BenchmarkEntry[] | null>(null);

  const inlineInput = () => ({ text: inline.text, pattern: inline.pattern, patterns: inline.patterns.split("\n").filter((x) => x.trim()), textB: inline.textB, query: inline.query, documents: inline.text.split("\n").filter((x) => x.trim()) });
  const sourceBody = () =>
    source === "workload" ? { kind: "workload", workload: wl } : source === "dataset" ? { kind: "dataset", datasetId, params: { pattern: inline.pattern, patterns: inline.patterns.split("\n").filter((x) => x.trim()), query: inline.query, textB: inline.textB } } : { kind: "inline", input: inlineInput() };

  const run = async () => {
    if (!selected.length) return setErr("Select at least one algorithm.");
    if (source === "dataset" && !datasetId) return setErr("Select a dataset.");
    setBusy(true);
    setErr(null);
    const r = await api<{ entries: BenchmarkEntry[] }>("/api/benchmark/compare", { body: { algorithms: selected, source: sourceBody(), repetitions: reps } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else setEntries(r.data!.entries);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Algorithms" subtitle="All selected algorithms receive the same input (adapted to each algorithm's required fields).">
          <AlgoSelector algorithms={algorithms} categories={categories} value={selected} onChange={setSelected} />
        </Card>
        <Card title="2. Input">
          <div className="space-y-3">
            <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
              {(["workload", "inline", "dataset"] as const).map((s) => (
                <button key={s} onClick={() => setSource(s)} className={`rounded px-3 py-1 ${source === s ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                  {s === "workload" ? "Generated workload" : s === "inline" ? "Custom text" : "Dataset"}
                </button>
              ))}
            </div>
            {source === "workload" && <WorkloadFields value={wl} onChange={setWl} />}
            {source !== "workload" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {source === "inline" && (
                  <Field label="Text (lines = documents)">
                    <textarea className={`${inputCls} font-mono`} rows={4} value={inline.text} onChange={(e) => setInline({ ...inline, text: e.target.value })} />
                  </Field>
                )}
                {source === "dataset" && <DatasetPicker value={datasetId} onChange={setDatasetId} />}
                <Field label="Pattern">
                  <input className={`${inputCls} font-mono`} value={inline.pattern} onChange={(e) => setInline({ ...inline, pattern: e.target.value })} />
                </Field>
                <Field label="Patterns (multi-pattern / trie)">
                  <textarea className={`${inputCls} font-mono`} rows={2} value={inline.patterns} onChange={(e) => setInline({ ...inline, patterns: e.target.value })} />
                </Field>
                <Field label="Second text (edit distance / similarity)">
                  <input className={`${inputCls} font-mono`} value={inline.textB} onChange={(e) => setInline({ ...inline, textB: e.target.value })} />
                </Field>
                <Field label="Query (inverted index)">
                  <input className={`${inputCls} font-mono`} value={inline.query} onChange={(e) => setInline({ ...inline, query: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Repetitions">
                <input type="number" min={1} max={20} className={`${inputCls} w-24`} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
              </Field>
              <Button onClick={run} loading={busy}>
                <Swords className="h-4 w-4" /> Run battle
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {busy && <Alert tone="info">Measuring… large inputs and many repetitions may take several seconds.</Alert>}
      {entries && (
        <>
          <BattleResults entries={entries} title="algorithm_battle" />
          <SaveExperiment defaultName={`Battle: ${selected.join(" vs ")}`} config={() => ({ mode: "compare", algorithms: selected, source: sourceBody(), parameters: { repetitions: reps } })} />
        </>
      )}
    </div>
  );
}
