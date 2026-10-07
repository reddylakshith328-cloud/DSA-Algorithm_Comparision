"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MonitorPlay, Play, BookOpen } from "lucide-react";
import type { AlgorithmMeta, ExecutionResult } from "@/lib/algorithms/types";
import { api } from "@/lib/client/api";
import { Alert, Badge, Button, Card, PageHeader, Spinner, Tabs } from "@/components/ui";
import { AlgorithmInputForm, ComplexityTable, FormState, formFromInput, inputFromForm, MetricsGrid, OutputView, useAlgorithms } from "@/components/lab";
import { DatasetPicker, SaveExperiment } from "@/components/experiment-tools";
import { PreprocessOptions, PreConfig } from "@/components/preprocess-options";

function AlgorithmCard({ meta, active, onClick }: { meta: AlgorithmMeta; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${active ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="text-sm font-medium text-slate-800">{meta.name}</div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{meta.complexity.worst}</div>
    </button>
  );
}

function Lab() {
  const { algorithms, categories, error, loading } = useAlgorithms();
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("algo") ?? "kmp";
  const meta = algorithms.find((a) => a.id === selectedId) ?? algorithms[0];
  const [form, setForm] = useState<FormState>({});
  const [source, setSource] = useState<"inline" | "dataset">("inline");
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [pre, setPre] = useState<PreConfig>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"run" | "complexity" | "about">("run");

  useEffect(() => {
    if (meta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(formFromInput(meta.input.example));
      setResult(null);
      setRunError(null);
    }
  }, [meta]);

  const grouped = useMemo(() => categories.map((c) => ({ ...c, items: algorithms.filter((a) => a.category === c.id) })), [algorithms, categories]);
  // dataset supplies text/documents; remaining fields (pattern, query…) come from the form
  const datasetParamFields = meta ? meta.input.fields.filter((f) => !["text", "documents"].includes(f)) : [];
  const hasPre = Object.values(pre).some(Boolean);

  const run = async () => {
    if (!meta) return;
    setBusy(true);
    setRunError(null);
    const input = inputFromForm(meta, form);
    const body = source === "dataset" ? { datasetId, params: input, preprocessing: hasPre ? pre : null } : { input, preprocessing: hasPre ? pre : null };
    if (source === "dataset" && !datasetId) {
      setBusy(false);
      setRunError("Please select a dataset first.");
      return;
    }
    const r = await api<{ result: ExecutionResult }>(`/api/algorithms/${meta.id}`, { body });
    setBusy(false);
    if (r.error) {
      setRunError(r.error);
      setResult(null);
    } else setResult(r.data!.result);
  };

  const openInVisualizer = () => {
    if (!meta) return;
    sessionStorage.setItem("viz-input", JSON.stringify({ algo: meta.id, form }));
    router.push(`/visualizer?algo=${meta.id}&from=lab`);
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!meta) return <Alert>No algorithms available.</Alert>;

  return (
    <div>
      <PageHeader title="Algorithm Lab" description="Select an algorithm, provide text or a dataset, optionally preprocess, and execute it. Results include output, measured metrics and theoretical complexity." />
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="space-y-4">
          {grouped.map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.name}</div>
              <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
                {g.items.map((a) => (
                  <AlgorithmCard key={a.id} meta={a} active={a.id === meta.id} onClick={() => router.replace(`/algorithms?algo=${a.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </aside>
        <div className="min-w-0 space-y-4">
          <Card
            title={<span className="text-base">{meta.name}</span>}
            subtitle={meta.description}
            actions={
              <>
                <Badge tone="indigo">{categories.find((c) => c.id === meta.category)?.name}</Badge>
                {meta.visualization && <Badge tone="cyan">visualization</Badge>}
                {meta.benchmark && <Badge tone="green">benchmark</Badge>}
              </>
            }
          >
            <Tabs tabs={[{ id: "run", label: "Execute" }, { id: "complexity", label: "Complexity" }, { id: "about", label: "Input / output" }]} value={tab} onChange={setTab} />
            <div className="pt-4">
              {tab === "run" && (
                <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
                  <div className="space-y-3">
                    <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
                      {(["inline", "dataset"] as const).map((s) => (
                        <button key={s} onClick={() => setSource(s)} className={`rounded px-3 py-1 ${source === s ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                          {s === "inline" ? "Enter text" : "Use dataset"}
                        </button>
                      ))}
                    </div>
                    {source === "dataset" ? (
                      <>
                        <DatasetPicker value={datasetId} onChange={setDatasetId} />
                        {meta.input.fields.includes("documents") && <p className="text-xs text-slate-500">Each non-empty line of the dataset is treated as one document.</p>}
                        {datasetParamFields.length > 0 && <AlgorithmInputForm meta={meta} form={form} onChange={setForm} compact exclude={["text", "documents"]} />}
                      </>
                    ) : (
                      <AlgorithmInputForm meta={meta} form={form} onChange={setForm} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={run} loading={busy}>
                        <Play className="h-4 w-4" /> Execute
                      </Button>
                      <Button variant="secondary" onClick={() => setForm(formFromInput(meta.input.example))}>Load example</Button>
                      {meta.visualization && source === "inline" && (
                        <Button variant="secondary" onClick={openInVisualizer}>
                          <MonitorPlay className="h-4 w-4" /> Visualize this input
                        </Button>
                      )}
                      <Link href={`/learning?algo=${meta.id}`} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                        <BookOpen className="h-4 w-4" /> Learn
                      </Link>
                    </div>
                  </div>
                  <PreprocessOptions value={pre} onChange={setPre} />
                </div>
              )}
              {tab === "complexity" && (
                <div className="space-y-3">
                  <ComplexityTable meta={meta} />
                  <p className="text-xs text-slate-500">Theoretical bounds only. Use the Benchmark Lab → Scaling tab to compare them with measured runtime.</p>
                </div>
              )}
              {tab === "about" && (
                <dl className="space-y-2 text-sm">
                  <div><dt className="font-medium text-slate-700">Input requirements</dt><dd className="text-slate-600">{meta.input.requirements}</dd></div>
                  <div><dt className="font-medium text-slate-700">Output</dt><dd className="text-slate-600">{meta.input.output}</dd></div>
                  <div><dt className="font-medium text-slate-700">Visualization limit</dt><dd className="text-slate-600">Up to {meta.vizLimits.text} characters{meta.vizLimits.items ? `, ${meta.vizLimits.items} items` : ""}.</dd></div>
                  <div><dt className="font-medium text-slate-700">Benchmark size limit</dt><dd className="text-slate-600">{meta.maxBenchmarkSize.toLocaleString()} characters</dd></div>
                </dl>
              )}
            </div>
          </Card>
          {runError && <Alert onClose={() => setRunError(null)}>{runError}</Alert>}
          {result && (
            <>
              <Alert tone="success">{result.summary}</Alert>
              <MetricsGrid r={result} />
              <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
                <Card title="Output">
                  <OutputView output={result.output} />
                </Card>
                <div className="space-y-4">
                  <Card title="Theoretical complexity">
                    <ComplexityTable meta={meta} />
                  </Card>
                  <Card title="Reproducibility">
                    <SaveExperiment
                      defaultName={`${meta.name} run`}
                      config={() => ({
                        mode: "run",
                        algorithms: [meta.id],
                        source: source === "dataset" ? { kind: "dataset", datasetId, params: inputFromForm(meta, form) } : { kind: "inline", input: inputFromForm(meta, form) },
                        parameters: {},
                        preprocessing: hasPre ? pre : null,
                      })}
                    />
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlgorithmsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Lab />
    </Suspense>
  );
}
