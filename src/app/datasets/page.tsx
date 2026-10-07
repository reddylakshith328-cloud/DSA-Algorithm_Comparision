"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { api, fmtBytes, fmtDate, fmtNum } from "@/lib/client/api";
import { Alert, Badge, Button, Card, DataTable, Empty, Field, inputCls, MetricCard, PageHeader, Spinner, Tabs } from "@/components/ui";
import { BenchmarkChart } from "@/components/charts";
import { useDatasets } from "@/components/experiment-tools";
import { PreprocessOptions, PreConfig } from "@/components/preprocess-options";
import { WORKLOADS } from "@/components/benchmark/shared";
import type { DatasetStats } from "@/lib/services/dataset-stats";

interface Detail {
  dataset: { id: number; name: string; description: string; source: string; currentVersion: number; createdAt: string };
  version: { version: number; stats: DatasetStats; preprocessing: { config?: PreConfig; steps?: { name: string; detail: string }[] } | null; note: string; createdAt: string };
  versions: { version: number; stats: DatasetStats; note: string; createdAt: string }[];
  preview: { offset: number; limit: number; total: number; text: string; hasMore: boolean };
}
interface PreviewResult {
  steps: { name: string; charsBefore: number; charsAfter: number; detail: string }[];
  before: { chars: number; lines: number; words: number; vocabulary: number; preview: string };
  after: { chars: number; lines: number; words: number; vocabulary: number; preview: string };
  truncated: boolean;
}

function CreateDataset({ onCreated }: { onCreated: (id: number) => void }) {
  const [tab, setTab] = useState<"paste" | "upload" | "synthetic">("paste");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [column, setColumn] = useState("");
  const [syn, setSyn] = useState({ type: "medium", size: 50000, seed: 42 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    let r;
    if (tab === "upload") {
      if (!file) {
        setBusy(false);
        return setErr("Choose a .txt or .csv file.");
      }
      const fd = new FormData();
      fd.append("file", file);
      if (name) fd.append("name", name);
      if (column) fd.append("column", column);
      r = await api<{ dataset: { id: number } }>("/api/datasets/upload", { form: fd });
    } else if (tab === "synthetic") r = await api<{ dataset: { id: number } }>("/api/datasets", { body: { name: name || `Synthetic ${syn.type} (${syn.size})`, synthetic: syn } });
    else r = await api<{ dataset: { id: number } }>("/api/datasets", { body: { name, content } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else {
      setName("");
      setContent("");
      setFile(null);
      onCreated(r.data!.dataset.id);
    }
  };
  return (
    <Card title="New dataset">
      <Tabs tabs={[{ id: "paste", label: "Paste text" }, { id: "upload", label: "Upload TXT / CSV" }, { id: "synthetic", label: "Synthetic" }]} value={tab} onChange={setTab} />
      <div className="space-y-3 pt-3">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === "upload" ? "Defaults to file name" : "e.g. News headlines"} />
        </Field>
        {tab === "paste" && (
          <Field label="Content" hint="Each non-empty line is treated as one document.">
            <textarea className={`${inputCls} font-mono`} rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
        )}
        {tab === "upload" && (
          <>
            <Field label="File" hint="Max 10 MB. CSV: one document per row, from the chosen column (or the longest text column).">
              <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </Field>
            {file?.name.toLowerCase().endsWith(".csv") && (
              <Field label="CSV text column (optional)">
                <input className={inputCls} value={column} onChange={(e) => setColumn(e.target.value)} placeholder="auto-detect" />
              </Field>
            )}
          </>
        )}
        {tab === "synthetic" && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Type">
              <select className={inputCls} value={syn.type} onChange={(e) => setSyn({ ...syn, type: e.target.value })}>
                {WORKLOADS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </Field>
            <Field label="Size"><input type="number" className={inputCls} value={syn.size} onChange={(e) => setSyn({ ...syn, size: Number(e.target.value) })} /></Field>
            <Field label="Seed"><input type="number" className={inputCls} value={syn.seed} onChange={(e) => setSyn({ ...syn, seed: Number(e.target.value) })} /></Field>
          </div>
        )}
        {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
        <Button onClick={submit} loading={busy}>{tab === "upload" ? <Upload className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Create dataset</Button>
      </div>
    </Card>
  );
}

function PreprocessPanel({ detail, onSaved }: { detail: Detail; onSaved: () => void }) {
  const [cfg, setCfg] = useState<PreConfig>({ lowercase: true, normalizeWhitespace: true, removeEmptyLines: true });
  const [prev, setPrev] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const preview = async () => {
    setBusy(true);
    setErr(null);
    const r = await api<PreviewResult>("/api/datasets/preprocess", { body: { datasetId: detail.dataset.id, version: detail.version.version, config: cfg } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else setPrev(r.data);
  };
  const save = async () => {
    setBusy(true);
    const r = await api(`/api/datasets/${detail.dataset.id}/versions`, { body: { baseVersion: detail.version.version, config: cfg } });
    setBusy(false);
    if (r.error) setErr(r.error);
    else {
      setPrev(null);
      onSaved();
    }
  };
  return (
    <Card title="Preprocessing: BEFORE → AFTER" subtitle="Preview the pipeline, then save the result as a new dataset version (the original stays intact).">
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          <PreprocessOptions value={cfg} onChange={setCfg} title="Pipeline" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={preview} loading={busy}><Eye className="h-4 w-4" /> Preview</Button>
            <Button onClick={save} disabled={!prev} loading={busy}><Wand2 className="h-4 w-4" /> Save as v{Math.max(...detail.versions.map((v) => v.version)) + 1}</Button>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          {err && <Alert>{err}</Alert>}
          {!prev && <Empty title="No preview yet">Choose steps and click Preview.</Empty>}
          {prev && (
            <>
              <DataTable headers={["", "Characters", "Words", "Lines", "Vocabulary"]} rows={[["Before", fmtNum(prev.before.chars), fmtNum(prev.before.words), fmtNum(prev.before.lines), fmtNum(prev.before.vocabulary)], ["After", fmtNum(prev.after.chars), fmtNum(prev.after.words), fmtNum(prev.after.lines), fmtNum(prev.after.vocabulary)]]} />
              <ol className="space-y-1 text-xs">
                {prev.steps.map((s, i) => (
                  <li key={i} className="flex flex-wrap gap-2"><Badge tone="indigo">{i + 1}. {s.name}</Badge><span className="text-slate-600">{s.detail}</span></li>
                ))}
                {prev.steps.length === 0 && <li className="text-slate-500">No steps selected.</li>}
              </ol>
              <div className="grid gap-2 md:grid-cols-2">
                <div><div className="mb-1 text-xs font-semibold text-slate-500">BEFORE</div><pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs">{prev.before.preview}</pre></div>
                <div><div className="mb-1 text-xs font-semibold text-slate-500">AFTER</div><pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-green-200 bg-green-50/40 p-2 text-xs">{prev.after.preview}</pre></div>
              </div>
              {prev.truncated && <p className="text-[11px] text-slate-500">Preview shows the first 3,000 characters; statistics cover the full dataset.</p>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function DatasetDetail({ id, onChanged, onDeleted }: { id: number; onChanged: () => void; onDeleted: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [previewText, setPreviewText] = useState("");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const load = async (v?: number) => {
    const r = await api<Detail>(`/api/datasets/${id}${v ? `?version=${v}` : ""}`);
    if (r.error) return setErr(r.error);
    setErr(null);
    setD(r.data);
    setPreviewText(r.data!.preview.text);
    setNextOffset(r.data!.preview.hasMore ? r.data!.preview.offset + r.data!.preview.limit : null);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVersion(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const more = async () => {
    if (nextOffset === null) return;
    const r = await api<Detail>(`/api/datasets/${id}?offset=${nextOffset}${version ? `&version=${version}` : ""}`);
    if (r.data) {
      setPreviewText((t) => t + r.data!.preview.text);
      setNextOffset(r.data.preview.hasMore ? nextOffset + r.data.preview.limit : null);
    }
  };
  const rename = async () => {
    const r = await api(`/api/datasets/${id}`, { method: "PATCH", body: { name: newName } });
    if (r.error) return setErr(r.error);
    setRenaming(false);
    load(version);
    onChanged();
  };
  const del = async () => {
    if (!confirm("Delete this dataset and all its versions?")) return;
    const r = await api(`/api/datasets/${id}`, { method: "DELETE" });
    if (r.error) return setErr(r.error);
    onDeleted();
  };
  const makeCurrent = async (v: number) => {
    const r = await api(`/api/datasets/${id}`, { method: "PATCH", body: { currentVersion: v } });
    if (r.error) return setErr(r.error);
    load(v);
    onChanged();
  };
  if (err) return <Alert>{err}</Alert>;
  if (!d) return <Spinner />;
  const s = d.version.stats;
  return (
    <div className="space-y-4">
      <Card
        title={
          renaming ? (
            <span className="flex gap-2"><input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} /><Button onClick={rename}>Save</Button><Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button></span>
          ) : (
            <span className="text-base">{d.dataset.name}</span>
          )
        }
        subtitle={d.dataset.description}
        actions={
          <>
            <Badge>{d.dataset.source}</Badge>
            <select className={`${inputCls} w-auto py-1 text-xs`} value={d.version.version} onChange={(e) => { const v = Number(e.target.value); setVersion(v); load(v); }} aria-label="Version">
              {d.versions.map((v) => <option key={v.version} value={v.version}>v{v.version}{v.version === d.dataset.currentVersion ? " (current)" : ""}</option>)}
            </select>
            {d.version.version !== d.dataset.currentVersion && <Button variant="secondary" onClick={() => makeCurrent(d.version.version)}>Make current</Button>}
            <Button variant="ghost" onClick={() => { setNewName(d.dataset.name); setRenaming(true); }}><Pencil className="h-4 w-4" /> Rename</Button>
            <Button variant="danger" onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Characters" value={fmtNum(s.characters)} hint={fmtBytes(s.bytes)} />
          <MetricCard label="Words" value={fmtNum(s.words)} />
          <MetricCard label="Lines" value={fmtNum(s.lines)} />
          <MetricCard label="Documents" value={fmtNum(s.documents)} hint={`avg ${s.avgDocumentLength} chars`} />
          <MetricCard label="Vocabulary" value={fmtNum(s.vocabularySize)} hint="distinct lowercase tokens" />
          <MetricCard label="Version" value={`v${d.version.version}`} hint={d.version.note} />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Word frequency (excluding stop words)">
          <BenchmarkChart data={s.topContentWords.slice(0, 15).map((w) => ({ name: w.word, count: w.count }))} keys={[{ key: "count", label: "count" }]} layout="vertical" height={340} />
        </Card>
        <Card title="Character frequency">
          <BenchmarkChart data={s.charFrequency.slice(0, 20).map((c) => ({ name: c.char, count: c.count }))} keys={[{ key: "count", label: "count" }]} height={340} />
        </Card>
      </div>
      <Card title="Preview" subtitle={`Showing ${previewText.length.toLocaleString()} of ${d.preview.total.toLocaleString()} characters (lazy loaded).`}>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs">{previewText}</pre>
        {nextOffset !== null && <Button variant="secondary" className="mt-2" onClick={more}>Load more</Button>}
      </Card>
      <PreprocessPanel detail={d} onSaved={() => { load(); onChanged(); }} />
      <Card title="Version history" padded={false}>
        <DataTable headers={["Version", "Characters", "Documents", "Vocabulary", "Note", "Created"]} rows={d.versions.map((v) => [`v${v.version}${v.version === d.dataset.currentVersion ? " ★" : ""}`, fmtNum(v.stats.characters), fmtNum(v.stats.documents), fmtNum(v.stats.vocabularySize), <span key="n" className="whitespace-normal text-xs">{v.note}</span>, fmtDate(v.createdAt)])} />
      </Card>
    </div>
  );
}

export default function DatasetsPage() {
  const { data, loading, error, reload } = useDatasets();
  const [selected, setSelected] = useState<number | null>(null);
  const list = data?.datasets ?? [];
  const current = selected ?? list[0]?.id ?? null;
  return (
    <div>
      <PageHeader title="Dataset Lab" description="Create datasets by pasting text, uploading TXT/CSV files or generating seeded synthetic corpora. Inspect statistics, preprocess with a visible BEFORE → AFTER diff, and keep every change as a version." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <CreateDataset onCreated={(id) => { reload(); setSelected(id); }} />
          <Card title={`Datasets (${list.length})`} padded={false}>
            {loading && <div className="px-4"><Spinner /></div>}
            {error && <div className="p-4"><Alert>{error}</Alert></div>}
            {!loading && list.length === 0 && <div className="p-4"><Empty title="No datasets yet">Create one above.</Empty></div>}
            <ul className="divide-y divide-slate-100">
              {list.map((d) => (
                <li key={d.id}>
                  <button onClick={() => setSelected(d.id)} className={`w-full px-4 py-2.5 text-left ${current === d.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{d.name}</span>
                      <Badge>v{d.currentVersion}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">{d.source} · {fmtNum(d.stats?.characters)} chars · {fmtNum(d.stats?.documents)} docs</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="min-w-0">{current ? <DatasetDetail key={current} id={current} onChanged={() => { reload(); }} onDeleted={() => { setSelected(null); reload(); }} /> : <Empty title="Select or create a dataset" />}</div>
      </div>
    </div>
  );
}
