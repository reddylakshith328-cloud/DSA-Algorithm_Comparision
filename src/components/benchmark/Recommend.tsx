"use client";

import { useState } from "react";
import { Lightbulb, Swords } from "lucide-react";
import { api } from "@/lib/client/api";
import { Alert, Badge, Button, Card, Field, inputCls } from "@/components/ui";
import { BattleResults, BenchmarkEntry } from "./shared";

interface Rec {
  algorithmId: string;
  name: string;
  applicable: boolean;
  score: number;
  reasons: string[];
  cautions: string[];
  complexity: string;
}
interface RecResponse {
  explanation: string;
  recommendations: Rec[];
  verification: { algorithms: string[]; workload: string; size: number; patternLength: number; patternCount: number };
}

const TASKS = [
  ["single-pattern", "Find one pattern in a text"],
  ["multi-pattern", "Find many patterns at once"],
  ["prefix-lookup", "Prefix lookup / autocomplete"],
  ["substring-queries", "Many substring queries on a static text"],
  ["repeat-analysis", "Find repeated substrings"],
  ["fuzzy-match", "Fuzzy / approximate string comparison"],
  ["keyword-ranking", "Extract / rank keywords"],
  ["document-search", "Search documents by keywords"],
  ["document-similarity", "Compare documents"],
];

export function Recommend() {
  const [p, setP] = useState({ task: "single-pattern", textSize: 1_000_000, patternSize: 12, patternCount: 1, documentCount: 1, repetition: "low", alphabet: "large", queryFrequency: "once", needIndexing: false, streaming: false });
  const [res, setRes] = useState<RecResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState<BenchmarkEntry[] | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [vBusy, setVBusy] = useState(false);
  const set = (k: string, v: unknown) => setP({ ...p, [k]: v });
  const run = async () => {
    setBusy(true);
    setErr(null);
    setVerify(null);
    const r = await api<RecResponse>("/api/recommendation", { body: p });
    setBusy(false);
    if (r.error) setErr(r.error);
    else {
      setRes(r.data);
      setExtra([]);
    }
  };
  const runVerify = async () => {
    if (!res) return;
    const algs = Array.from(new Set([...res.verification.algorithms, ...extra]));
    if (!algs.length) return setErr("No algorithms to verify.");
    setVBusy(true);
    const v = res.verification;
    const r = await api<{ entries: BenchmarkEntry[] }>("/api/benchmark/compare", { body: { algorithms: algs, source: { kind: "workload", workload: { type: v.workload, size: Math.min(v.size, 1_000_000), patternLength: v.patternLength, patternCount: v.patternCount, seed: 42 } }, repetitions: 3 } });
    setVBusy(false);
    if (r.error) setErr(r.error);
    else setVerify(r.data!.entries);
  };
  return (
    <div className="space-y-4">
      <Card title="Workload characteristics" subtitle="The engine applies transparent rules to these measurable characteristics. Every score is accompanied by its reasons.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Task">
            <select className={inputCls} value={p.task} onChange={(e) => set("task", e.target.value)}>
              {TASKS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </Field>
          <Field label="Text size (chars)"><input type="number" className={inputCls} value={p.textSize} onChange={(e) => set("textSize", Number(e.target.value))} /></Field>
          <Field label="Pattern size"><input type="number" className={inputCls} value={p.patternSize} onChange={(e) => set("patternSize", Number(e.target.value))} /></Field>
          <Field label="Number of patterns"><input type="number" className={inputCls} value={p.patternCount} onChange={(e) => set("patternCount", Number(e.target.value))} /></Field>
          <Field label="Number of documents"><input type="number" className={inputCls} value={p.documentCount} onChange={(e) => set("documentCount", Number(e.target.value))} /></Field>
          <Field label="Repetition in text">
            <select className={inputCls} value={p.repetition} onChange={(e) => set("repetition", e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </Field>
          <Field label="Alphabet">
            <select className={inputCls} value={p.alphabet} onChange={(e) => set("alphabet", e.target.value)}><option value="large">Large (natural language)</option><option value="small">Small (DNA, binary)</option></select>
          </Field>
          <Field label="Query frequency">
            <select className={inputCls} value={p.queryFrequency} onChange={(e) => set("queryFrequency", e.target.value)}><option value="once">Once</option><option value="occasional">Occasional</option><option value="frequent">Frequent</option></select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.needIndexing} onChange={(e) => set("needIndexing", e.target.checked)} /> Indexing allowed / needed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.streaming} onChange={(e) => set("streaming", e.target.checked)} /> Streaming input</label>
          <Button onClick={run} loading={busy}><Lightbulb className="h-4 w-4" /> Recommend</Button>
        </div>
      </Card>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {res && (
        <>
          <Alert tone="info">{res.explanation}</Alert>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {res.recommendations.map((r) => (
              <div key={r.algorithmId} className={`rounded-lg border p-3 ${r.applicable ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50 opacity-70"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{r.name}</span>
                  {r.applicable ? <Badge tone="indigo">score {r.score}</Badge> : <Badge>not applicable</Badge>}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500">{r.complexity}</div>
                {r.reasons.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-700">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                {r.cautions.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">{r.cautions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                {!res.verification.algorithms.includes(r.algorithmId) && (
                  <label className="mt-2 flex items-center gap-1 text-[11px] text-slate-600">
                    <input type="checkbox" checked={extra.includes(r.algorithmId)} onChange={() => setExtra(extra.includes(r.algorithmId) ? extra.filter((x) => x !== r.algorithmId) : [...extra, r.algorithmId])} /> include in verification benchmark
                  </label>
                )}
              </div>
            ))}
          </div>
          <Card title="Verify with measurements" subtitle={`Runs the applicable algorithms${extra.length ? " plus your additions" : ""} on a generated "${res.verification.workload}" workload of ${Math.min(res.verification.size, 1_000_000).toLocaleString()} chars.`}>
            <Button onClick={runVerify} loading={vBusy}><Swords className="h-4 w-4" /> Run verification benchmark</Button>
          </Card>
          {verify && <BattleResults entries={verify} title="recommendation_verification" />}
        </>
      )}
    </div>
  );
}
