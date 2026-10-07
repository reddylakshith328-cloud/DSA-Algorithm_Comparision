"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import type { ExecutionResult, Highlight, Step, TreeNode, VizArray, VizString, VizTable, VizTreeState } from "@/lib/algorithms/types";
import { CodeViewer } from "@/components/CodeViewer";
import { fmtMs, fmtNum } from "@/lib/client/api";

export const HL: Record<Highlight, string> = {
  match: "bg-green-100 border-green-500 text-green-900",
  mismatch: "bg-red-100 border-red-500 text-red-900",
  active: "bg-amber-100 border-amber-500 text-amber-900",
  found: "bg-indigo-100 border-indigo-400 text-indigo-900",
  dim: "bg-slate-100 border-slate-200 text-slate-400",
  window: "bg-sky-50 border-sky-300 text-slate-800",
  compare: "bg-amber-50 border-amber-400 text-amber-900",
};

const CELL = 26;
const show = (c: string) => (c === " " ? "␣" : c === "\n" ? "↵" : c);

function StringRows({ strings }: { strings: VizString[] }) {
  const width = Math.max(...strings.map((s) => (s.offset ?? 0) + s.chars.length));
  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: width * CELL + 90 }} className="space-y-1.5">
        <div className="flex items-end">
          <div className="w-[90px] shrink-0" />
          {Array.from({ length: width }, (_, i) => (
            <div key={i} style={{ width: CELL }} className="shrink-0 text-center font-mono text-[9px] text-slate-400">
              {i}
            </div>
          ))}
        </div>
        {strings.map((s, si) => (
          <div key={si} className="flex items-center">
            <div className="w-[90px] shrink-0 truncate pr-2 text-right text-xs font-medium text-slate-500">{s.label}</div>
            <div style={{ width: (s.offset ?? 0) * CELL, transition: "width 200ms" }} className="shrink-0" />
            {s.chars.split("").map((c, i) => (
              <div key={i} style={{ width: CELL }} className="relative shrink-0 px-[1px]">
                <div className={`flex h-7 items-center justify-center rounded border font-mono text-sm ${s.highlights?.[i] ? HL[s.highlights[i]] : "border-slate-200 bg-white text-slate-800"}`}>{show(c)}</div>
                {s.pointer === i && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[10px] text-amber-600">▲</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArrayRow({ a }: { a: VizArray }) {
  return (
    <div className="overflow-x-auto">
      <div className="text-xs font-medium text-slate-500">{a.label}</div>
      <div className="mt-1 flex gap-[2px]">
        {a.values.map((v, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center">
            <div className={`flex h-7 min-w-[28px] items-center justify-center rounded border px-1 font-mono text-xs ${a.highlights?.[i] ? HL[a.highlights[i]] : "border-slate-200 bg-white"}`}>{v}</div>
            <div className="mt-0.5 font-mono text-[9px] text-slate-400">{a.indexLabels ? show(String(a.indexLabels[i])) : i}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({ t }: { t: VizTable }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{t.title}</div>
      <div className="max-h-80 overflow-auto rounded border border-slate-200">
        <table className="min-w-full font-mono text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {t.headers.map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-2 py-1 text-left font-semibold text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, ri) => (
              <tr key={ri} className={t.highlightRows?.[ri] ? HL[t.highlightRows[ri]] : ""}>
                {r.map((c, ci) => {
                  const h = t.highlightCells?.[`${ri},${ci}`];
                  return (
                    <td key={ci} className={`border-b border-slate-100 px-2 py-1 ${h ? `${HL[h]} border` : ""}`}>
                      {c}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TreeView({ nodes, state }: { nodes: TreeNode[]; state: VizTreeState }) {
  const layout = useMemo(() => {
    const vis = nodes.filter((n) => n.id < state.visible);
    const children = new Map<number, TreeNode[]>();
    vis.forEach((n) => n.parent !== null && children.set(n.parent, [...(children.get(n.parent) ?? []), n]));
    const pos = new Map<number, { x: number; y: number }>();
    let leaf = 0;
    const place = (id: number, depth: number): number => {
      const ch = (children.get(id) ?? []).sort((a, b) => a.label.localeCompare(b.label));
      let x: number;
      if (!ch.length) x = leaf++;
      else {
        const xs = ch.map((c) => place(c.id, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      pos.set(id, { x, y: depth });
      return x;
    };
    if (vis.length) place(0, 0);
    const maxDepth = Math.max(0, ...vis.map((n) => n.depth));
    return { vis, pos, width: Math.max(1, leaf), height: maxDepth + 1 };
  }, [nodes, state.visible]);
  const W = 56;
  const H = 62;
  const px = (id: number) => (layout.pos.get(id)?.x ?? 0) * W + W / 2 + 10;
  const py = (id: number) => (layout.pos.get(id)?.y ?? 0) * H + 24;
  const active = new Set(state.active ?? []);
  return (
    <div className="overflow-auto rounded border border-slate-200 bg-slate-50">
      <svg width={layout.width * W + 20} height={layout.height * H + 20} className="block">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>
        {layout.vis.map((n) => n.parent !== null && <line key={`e${n.id}`} x1={px(n.parent)} y1={py(n.parent)} x2={px(n.id)} y2={py(n.id)} stroke={active.has(n.id) && active.has(n.parent) ? "#4f46e5" : "#cbd5e1"} strokeWidth={active.has(n.id) && active.has(n.parent) ? 2.5 : 1.5} />)}
        {state.showFail &&
          layout.vis.map((n) => {
            if (n.fail === undefined || n.fail === null || n.fail === 0 || n.id === 0) return null;
            const hi = state.failEdge && state.failEdge[0] === n.id;
            const x1 = px(n.id), y1 = py(n.id), x2 = px(n.fail), y2 = py(n.fail);
            const mx = (x1 + x2) / 2 + 20;
            const my = (y1 + y2) / 2;
            return <path key={`f${n.id}`} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={hi ? "#f59e0b" : "#fcd34d"} strokeDasharray="4 3" strokeWidth={hi ? 2.5 : 1.2} markerEnd="url(#arr)" opacity={hi ? 1 : 0.7} />;
          })}
        {layout.vis.map((n) => {
          const isA = active.has(n.id);
          return (
            <g key={n.id}>
              <circle cx={px(n.id)} cy={py(n.id)} r={14} fill={isA ? "#e0e7ff" : n.terminal ? "#dcfce7" : "#fff"} stroke={isA ? "#4f46e5" : n.terminal ? "#16a34a" : "#94a3b8"} strokeWidth={n.terminal ? 2.5 : 1.5} />
              <text x={px(n.id)} y={py(n.id) + 4} textAnchor="middle" className="fill-slate-800 font-mono" fontSize={n.id === 0 ? 9 : 12}>
                {n.id === 0 ? "root" : show(n.label)}
              </text>
              {n.terminal && n.word && (
                <text x={px(n.id)} y={py(n.id) + 27} textAnchor="middle" fontSize={9} className="fill-green-700">
                  {n.word.length > 8 ? n.word.slice(0, 8) + "…" : n.word}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
        <span>● indigo = current path</span>
        <span className="text-green-700">● green ring = word end</span>
        {state.showFail && <span className="text-amber-600">⇢ dashed = failure link</span>}
      </div>
    </div>
  );
}

function Bars({ bars }: { bars: NonNullable<Step["bars"]> }) {
  const max = Math.max(...bars.map((b) => b.value), 1e-9);
  return (
    <div className="space-y-1">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-24 shrink-0 truncate text-right font-mono text-slate-600">{b.label}</div>
          <div className="h-4 flex-1 rounded bg-slate-100">
            <div className={`h-4 rounded ${b.highlight ? "bg-indigo-600" : "bg-indigo-300"}`} style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <div className="w-14 shrink-0 font-mono tabular-nums text-slate-700">{b.value}</div>
        </div>
      ))}
    </div>
  );
}

export function StepView({ step, tree }: { step: Step; tree?: TreeNode[] }) {
  return (
    <div className="space-y-4">
      {step.strings && step.strings.length > 0 && <StringRows strings={step.strings} />}
      {step.arrays?.map((a, i) => <ArrayRow key={i} a={a} />)}
      {step.tree && tree && <TreeView nodes={tree} state={step.tree} />}
      {step.table && <TableView t={step.table} />}
      {step.bars && <Bars bars={step.bars} />}
    </div>
  );
}

/** Generic, algorithm-agnostic step player. */
export function Visualizer({ result }: { result: ExecutionResult }) {
  const steps = result.steps;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const total = steps.length;
  const step = steps[Math.min(idx, total - 1)];
  useEffect(() => {
    if (!playing) return;
    if (idx >= total - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => Math.min(total - 1, i + 1)), [1200, 800, 500, 250, 100, 30][speed - 1] ?? 500);
    return () => clearTimeout(t);
  }, [playing, idx, speed, total]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [total]);
  if (!total || !step) return <p className="text-sm text-slate-500">This run produced no visualization steps.</p>;
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 100;
  const phases = Array.from(new Set(steps.map((s) => s.phase).filter(Boolean)));
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button className="rounded p-1.5 hover:bg-slate-100" onClick={() => { setIdx(0); setPlaying(false); }} aria-label="Restart" title="Restart">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 hover:bg-slate-100" onClick={() => setIdx(0)} aria-label="First step" title="First">
              <SkipBack className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Previous step" title="Previous (←)">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700" onClick={() => { if (idx >= total - 1) setIdx(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
            </button>
            <button className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={idx >= total - 1} onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} aria-label="Next step" title="Next (→)">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 hover:bg-slate-100" onClick={() => setIdx(total - 1)} aria-label="Last step" title="Last">
              <SkipForward className="h-4 w-4" />
            </button>
            <label className="ml-2 flex items-center gap-2 text-xs text-slate-600">
              Speed
              <input type="range" min={1} max={6} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed" />
              <span className="w-6 tabular-nums">{speed}×</span>
            </label>
            <span className="ml-auto text-xs font-medium tabular-nums text-slate-600" data-testid="step-counter">
              Step {idx + 1} / {total}
            </span>
          </div>
          <input type="range" min={0} max={total - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="mt-2 w-full" aria-label="Progress" />
          <div className="h-1 w-full rounded bg-slate-100">
            <div className="h-1 rounded bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
          {phases.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {phases.map((p) => (
                <button key={p} onClick={() => setIdx(steps.findIndex((s) => s.phase === p))} className={`rounded px-2 py-0.5 text-[11px] ${step.phase === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-800">
          {step.phase && <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">{step.phase}</span>}
          {step.description}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <StepView step={step} tree={result.visualization.tree} />
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          {(["match", "mismatch", "compare", "found", "window"] as Highlight[]).map((h) => (
            <span key={h} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded border ${HL[h]}`} /> {h}
            </span>
          ))}
        </div>
        {result.stepsTruncated && <p className="text-xs text-amber-700">Step recording was truncated to keep the visualization responsive. Use a smaller input to see every step.</p>}
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Current state</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {Object.entries(step.vars ?? {}).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-mono tabular-nums text-slate-900">{v}</dd>
              </div>
            ))}
            <dt className="text-slate-500">total comparisons</dt>
            <dd className="text-right font-mono tabular-nums">{fmtNum(result.metrics.comparisons)}</dd>
            <dt className="text-slate-500">runtime (with recording)</dt>
            <dd className="text-right font-mono tabular-nums">{fmtMs(result.metrics.runtimeMs)}</dd>
          </dl>
        </div>
        <CodeViewer lines={result.pseudocode} active={step.line} />
      </div>
    </div>
  );
}
