"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Alert, Badge, Button, Card, Field, inputCls, PageHeader, Spinner } from "@/components/ui";

interface Challenge {
  id: string;
  title: string;
  algorithmId: string;
  kind: string;
  difficulty: "easy" | "medium" | "hard";
  problem: string;
  input: Record<string, string>;
  task: string;
  answerFormat: string;
  options?: string[];
}
interface Result {
  correct: boolean;
  expected: string;
  yourAnswer: string;
  explanation: string;
}

function ChallengeView({ c }: { c: Challenge }) {
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (a = answer) => {
    setBusy(true);
    setErr(null);
    const r = await api<Result>(`/api/challenges/${c.id}/submit`, { body: { answer: a } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else setRes(r.data);
  };
  return (
    <Card title={<span className="text-base">{c.title}</span>} actions={<><Badge tone="indigo">{c.kind}</Badge><Badge tone={c.difficulty === "easy" ? "green" : c.difficulty === "medium" ? "amber" : "red"}>{c.difficulty}</Badge></>}>
      <div className="space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problem</h3>
          <p className="mt-1 text-sm text-slate-700">{c.problem}</p>
        </section>
        {Object.keys(c.input).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Input</h3>
            <dl className="mt-1 grid grid-cols-[100px_1fr] gap-y-1 text-sm">
              {Object.entries(c.input).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-mono text-slate-900">{v}</dd></div>
              ))}
            </dl>
          </section>
        )}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected task</h3>
          <p className="mt-1 text-sm text-slate-700">{c.task}</p>
        </section>
        {c.options ? (
          <div className="flex flex-wrap gap-2">
            {c.options.map((o) => (
              <button key={o} onClick={() => { setAnswer(o); submit(o); }} className={`rounded-md border px-3 py-1.5 font-mono text-sm ${answer === o ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:bg-slate-50"}`}>{o}</button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Field label="Your answer" hint={c.answerFormat}>
                <input className={`${inputCls} font-mono`} value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
            </div>
            <Button onClick={() => submit()} loading={busy}><Send className="h-4 w-4" /> Submit</Button>
          </div>
        )}
        {err && <Alert>{err}</Alert>}
        {res && (
          <div className={`rounded-md border p-3 ${res.correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className={`flex items-center gap-1.5 font-medium ${res.correct ? "text-green-800" : "text-red-800"}`}>
              {res.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {res.correct ? "Correct!" : "Incorrect"}
            </div>
            <p className="mt-1 text-sm text-slate-700"><b>Result:</b> expected <code>{res.expected}</code>, you answered <code>{res.yourAnswer}</code>.</p>
            <p className="mt-1 text-sm text-slate-700"><b>Explanation:</b> {res.explanation}</p>
            <Link href={`/visualizer?algo=${c.algorithmId}`} className="mt-2 inline-block text-xs text-indigo-600 hover:underline">Explore in the Visualizer →</Link>
          </div>
        )}
      </div>
    </Card>
  );
}

function Challenges() {
  const { data, loading, error } = useApi<{ challenges: Challenge[]; stats: { challengeId: string; attempts: number; solved: number }[] }>("/api/challenges");
  const params = useSearchParams();
  const router = useRouter();
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const list = data?.challenges ?? [];
  const current = list.find((c) => c.id === params.get("id")) ?? list[0];
  const stat = (id: string) => data?.stats.find((s) => s.challengeId === id);
  return (
    <div>
      <PageHeader title="Challenges" description="Test your understanding. Expected answers are computed by running the laboratory's own algorithm implementations, and every answer comes with an explanation." />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card title={`${list.length} challenges`} padded={false}>
          <ul className="divide-y divide-slate-100">
            {list.map((c) => {
              const s = stat(c.id);
              return (
                <li key={c.id}>
                  <button onClick={() => router.replace(`/challenges?id=${c.id}`)} className={`w-full px-4 py-2.5 text-left ${current?.id === c.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                    <div className="text-sm font-medium text-slate-800">{c.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <Badge>{c.kind}</Badge> {c.difficulty}
                      {s && <span>· {s.solved}/{s.attempts} solved</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="min-w-0">{current && <ChallengeView key={current.id} c={current} />}</div>
      </div>
    </div>
  );
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Challenges />
    </Suspense>
  );
}
