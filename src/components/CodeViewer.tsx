"use client";

export function CodeViewer({ lines, active, title = "Pseudocode" }: { lines: string[]; active?: number; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-sm">
      <div className="border-b border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <pre className="overflow-x-auto p-2 text-[12px] leading-5">
        {lines.map((l, i) => (
          <div key={i} className={`flex rounded px-1 ${active === i ? "bg-amber-400/25 text-amber-100" : "text-slate-300"}`}>
            <span className="mr-3 w-5 shrink-0 select-none text-right text-slate-500">{i + 1}</span>
            <code className="whitespace-pre">{l}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}
