"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play } from "lucide-react";
import type { ExecutionResult } from "@/lib/algorithms/types";
import { api } from "@/lib/client/api";
import { Alert, Button, Card, Field, inputCls, PageHeader, Spinner } from "@/components/ui";
import { AlgorithmInputForm, FormState, formFromInput, inputFromForm, useAlgorithms } from "@/components/lab";
import { Visualizer } from "@/components/Visualizer/Visualizer";
import { PRESETS } from "@/data/presets";

function VisualizerLab() {
  const { algorithms, loading, error } = useAlgorithms();
  const params = useSearchParams();
  const router = useRouter();
  const algoId = params.get("algo") ?? "kmp";
  const meta = algorithms.find((a) => a.id === algoId && a.visualization);
  const [form, setForm] = useState<FormState>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const initFor = useRef<string | null>(null);

  const run = useCallback(
    async (f: FormState) => {
      if (!meta) return;
      setBusy(true);
      setErr(null);
      const r = await api<{ result: ExecutionResult }>("/api/visualizer/run", { body: { algorithmId: meta.id, input: inputFromForm(meta, f) } });
      setBusy(false);
      if (r.error) {
        setErr(r.error);
        setResult(null);
      } else {
        setResult(r.data!.result);
        setRunKey((k) => k + 1);
      }
    },
    [meta],
  );

  useEffect(() => {
    if (!meta || initFor.current === meta.id) return;
    initFor.current = meta.id;
    let f = formFromInput(PRESETS[meta.id]?.[0]?.input ?? meta.input.example);
    if (params.get("from") === "lab") {
      try {
        const saved = JSON.parse(sessionStorage.getItem("viz-input") ?? "null");
        if (saved?.algo === meta.id) f = saved.form;
      } catch {
        /* ignore corrupt session data */
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(f);
    run(f);
  }, [meta, params, run]);

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const visual = algorithms.filter((a) => a.visualization);

  return (
    <div>
      <PageHeader title="Visualizer" description="A single reusable step player for every algorithm: play/pause, step, scrub, speed control, highlighted characters and indices, internal data structures, pseudocode and an explanation of each step. Keyboard: ← → and Space." />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card title="Configuration">
          <div className="space-y-3">
            <Field label="Algorithm">
              <select className={inputCls} value={meta?.id ?? ""} onChange={(e) => router.replace(`/visualizer?algo=${e.target.value}`)} aria-label="Algorithm">
                {!meta && <option value="">Select…</option>}
                {visual.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            {meta && (
              <>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Presets</div>
                  <div className="flex flex-wrap gap-1">
                    {(PRESETS[meta.id] ?? []).map((p) => (
                      <button key={p.label} onClick={() => { const f = formFromInput(p.input); setForm(f); run(f); }} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-indigo-400 hover:bg-indigo-50">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <AlgorithmInputForm meta={meta} form={form} onChange={setForm} compact />
                <p className="text-[11px] text-slate-500">Visualization limit: {meta.vizLimits.text} chars{meta.vizLimits.pattern ? `, pattern ≤ ${meta.vizLimits.pattern}` : ""}{meta.vizLimits.items ? `, ≤ ${meta.vizLimits.items} items` : ""}.</p>
                <Button onClick={() => run(form)} loading={busy} className="w-full">
                  <Play className="h-4 w-4" /> Run visualization
                </Button>
              </>
            )}
            {!meta && <Alert tone="warning">This algorithm does not support visualization. Choose another.</Alert>}
          </div>
        </Card>
        <div className="min-w-0 space-y-3">
          {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
          {busy && !result && <Spinner label="Recording steps…" />}
          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-800">{result.algorithm}</h2>
                <span className="text-xs text-slate-500">{result.summary}</span>
              </div>
              <Visualizer key={runKey} result={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VisualizerPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VisualizerLab />
    </Suspense>
  );
}
