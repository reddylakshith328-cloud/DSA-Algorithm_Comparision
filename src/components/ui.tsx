"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ title, subtitle, actions, children, className = "", padded = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {icon && <span className="text-indigo-500">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ children, variant = "primary", loading, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:text-red-300",
  };
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "indigo" | "green" | "red" | "amber" | "cyan" }) {
  const t = { slate: "bg-slate-100 text-slate-700", indigo: "bg-indigo-50 text-indigo-700", green: "bg-green-50 text-green-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-800", cyan: "bg-cyan-50 text-cyan-700" }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${value === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Alert({ tone = "error", children, onClose }: { tone?: "error" | "info" | "success" | "warning"; children: ReactNode; onClose?: () => void }) {
  const cfg = {
    error: ["border-red-200 bg-red-50 text-red-800", <AlertTriangle key="i" className="h-4 w-4 shrink-0" />],
    warning: ["border-amber-200 bg-amber-50 text-amber-900", <AlertTriangle key="i" className="h-4 w-4 shrink-0" />],
    info: ["border-sky-200 bg-sky-50 text-sky-900", <Info key="i" className="h-4 w-4 shrink-0" />],
    success: ["border-green-200 bg-green-50 text-green-800", <CheckCircle2 key="i" className="h-4 w-4 shrink-0" />],
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${cfg[0]}`}>
      <span className="mt-0.5">{cfg[1]}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-xs text-slate-500">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DataTable({ headers, rows, className = "" }: { headers: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {r.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
