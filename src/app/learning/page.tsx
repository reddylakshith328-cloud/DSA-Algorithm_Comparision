"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FlaskConical, MonitorPlay, Trophy, XCircle } from "lucide-react";
import type { AlgorithmMeta, ExecutionResult } from "@/lib/algorithms/types";
import { api } from "@/lib/client/api";
import { Alert, Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { AlgorithmInputForm, ComplexityTable, FormState, formFromInput, inputFromForm, useAlgorithms } from "@/components/lab";
import { Visualizer } from "@/components/Visualizer/Visualizer";
import { PRESETS } from "@/data/presets";

interface LearningResponse {
  algorithm: AlgorithmMeta;
  challenges: { id: string; title: string; kind: string; difficulty: string }[];
}

function InteractiveExample({ meta }: { meta: AlgorithmMeta }) {
  const [form, setForm] = useState<FormState>(formFromInput(PRESETS[meta.id]?.[0]?.input ?? meta.input.example));
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0);
  const run = async (f: FormState) => {
    setBusy(true);
    const r = await api<{ result: ExecutionResult }>("/api/visualizer/run", { body: { algorithmId: meta.id, input: inputFromForm(meta, f) } });
    setBusy(false);
    setErr(r.error);
    if (r.data) {
      setResult(r.data.result);
      setK((x) => x + 1);
    }
  };
  useEffect(() => {
    run(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-3">
      <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Change the example input</summary>
        <div className="mt-3 space-y-2">
          <AlgorithmInputForm meta={meta} form={form} onChange={setForm} compact />
          <Button onClick={() => run(form)} loading={busy}>Run example</Button>
        </div>
      </details>
      {err && <Alert>{err}</Alert>}
      {busy && !result && <Spinner />}
      {result && <Visualizer key={k} result={result} />}
    </div>
  );
}

function Learning() {
  const { algorithms, categories, loading, error } = useAlgorithms();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("algo") ?? "kmp";
  const [data, setData] = useState<LearningResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setQuiz(null);
    api<LearningResponse>(`/api/learning/${id}`).then((r) => {
      setErr(r.error);
      setData(r.data);
    });
  }, [id]);
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const m = data?.algorithm;
  const quizOptions = m ? Array.from(new Set([m.complexity.worst, "O(n log n)", "O(n²)", "O(n + m)", "O(1)", "O(n·m)"])).slice(0, 4).sort() : [];
  return (
    <div>
      <PageHeader title="Learning Lab" description="Understand each algorithm: what it is, why it is needed, how it works, an interactive step-by-step example, complexity, advantages, limitations and applications." />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="space-y-3">
          {categories.map((c) => (
            <div key={c.id}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.name}</div>
              {algorithms.filter((a) => a.category === c.id).map((a) => (
                <button key={a.id} onClick={() => router.replace(`/learning?algo=${a.id}`)} className={`block w-full rounded px-2 py-1.5 text-left text-sm ${a.id === id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                  {a.name}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {err && <Alert>{err}</Alert>}
          {!m && !err && <Spinner />}
          {m && (
            <>
              <Card title={<span className="text-lg">{m.name}</span>} subtitle={m.description} actions={<><Link href={`/algorithms?algo=${m.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><FlaskConical className="h-4 w-4" /> Run</Link><Link href={`/visualizer?algo=${m.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><MonitorPlay className="h-4 w-4" /> Visualizer</Link></>}>
                <div className="grid gap-5 md:grid-cols-2">
                  <section>
                    <h3 className="text-sm font-semibold text-slate-800">What is it?</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.learning.what}</p>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold text-slate-800">Why is it needed?</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.learning.why}</p>
                  </section>
                  <section className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-800">How does it work?</h3>
                    <ol className="mt-1 space-y-1.5">
                      {m.learning.how.map((h, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">{i + 1}</span>{h}</li>
                      ))}
                    </ol>
                  </section>
                  <section className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                    <h3 className="text-sm font-semibold text-amber-900">Example</h3>
                    <p className="mt-1 text-sm text-amber-900">{m.learning.example}</p>
                  </section>
                </div>
              </Card>
              <Card title="Step-by-step execution" subtitle="Interactive: play, pause and step through the algorithm on a small example.">
                <InteractiveExample key={m.id} meta={m} />
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Complexity"><ComplexityTable meta={m} /></Card>
                <Card title="Quick check">
                  <p className="text-sm text-slate-700">What is the worst-case time complexity of {m.name}?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quizOptions.map((o) => (
                      <button key={o} onClick={() => setQuiz(o)} className={`rounded border px-2 py-1 font-mono text-xs ${quiz === o ? (o === m.complexity.worst ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50") : "border-slate-300 hover:bg-slate-50"}`}>{o}</button>
                    ))}
                  </div>
                  {quiz && (quiz === m.complexity.worst ? <p className="mt-2 flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Correct.</p> : <p className="mt-2 flex items-center gap-1 text-sm text-red-700"><XCircle className="h-4 w-4" /> Not quite — it is {m.complexity.worst}. {m.complexity.notes}</p>)}
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card title="Advantages"><ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">{m.learning.advantages.map((a, i) => <li key={i}>{a}</li>)}</ul></Card>
                <Card title="Limitations"><ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">{m.learning.limitations.map((a, i) => <li key={i}>{a}</li>)}</ul></Card>
                <Card title="Practical applications"><ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">{m.learning.applications.map((a, i) => <li key={i}>{a}</li>)}</ul></Card>
              </div>
              {data!.challenges.length > 0 && (
                <Card title="Practice challenges">
                  <div className="flex flex-wrap gap-2">
                    {data!.challenges.map((c) => (
                      <Link key={c.id} href={`/challenges?id=${c.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><Trophy className="h-4 w-4 text-amber-500" /> {c.title} <Badge>{c.difficulty}</Badge></Link>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Learning />
    </Suspense>
  );
}
