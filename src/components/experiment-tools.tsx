"use client";

import { useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Alert, Button, Field, inputCls } from "@/components/ui";

export interface DatasetSummary {
  id: number;
  name: string;
  description: string;
  source: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  stats: { characters: number; words: number; documents: number; vocabularySize: number } | null;
}

export function useDatasets() {
  return useApi<{ datasets: DatasetSummary[] }>("/api/datasets");
}

export function DatasetPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data, loading, error } = useDatasets();
  if (error) return <Alert>{error}</Alert>;
  const list = data?.datasets ?? [];
  return (
    <Field label="Dataset" hint={list.length === 0 && !loading ? <>No datasets yet — <Link className="text-indigo-600 underline" href="/datasets">create one in the Dataset Lab</Link>.</> : "The full dataset is loaded server-side; it is never sent to the browser."}>
      <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} disabled={loading}>
        <option value="">{loading ? "Loading…" : "Select a dataset"}</option>
        {list.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} (v{d.currentVersion}, {d.stats?.characters.toLocaleString() ?? "?"} chars, {d.stats?.documents ?? "?"} docs)
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Saves a reproducible experiment configuration and executes it on the server. */
export function SaveExperiment({ config, defaultName, disabled }: { config: () => unknown; defaultName: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: React.ReactNode } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await api<{ experiment: { id: number } }>("/api/experiments", { body: { name: name || defaultName, description: desc, config: config() } });
    setBusy(false);
    if (r.error) setMsg({ tone: "error", text: r.error });
    else {
      setMsg({ tone: "success", text: <>Saved and executed. <Link className="underline" href={`/experiments?id=${r.data!.experiment.id}`}>Open experiment #{r.data!.experiment.id}</Link></> });
      setOpen(false);
    }
  };
  return (
    <div className="space-y-2">
      {!open ? (
        <Button variant="secondary" onClick={() => { setOpen(true); setName(defaultName); }} disabled={disabled}>
          <Save className="h-4 w-4" /> Save as experiment
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <Field label="Experiment name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={save} loading={busy}>Save & run</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          <p className="text-[11px] text-slate-500">Stores algorithm(s), input source (pinned dataset version or seeded workload), parameters, preprocessing and environment so the experiment can be re-run.</p>
        </div>
      )}
      {msg && <Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert>}
    </div>
  );
}
