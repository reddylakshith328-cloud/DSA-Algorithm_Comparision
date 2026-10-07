"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PALETTE } from "@/lib/client/api";

export function BenchmarkChart({ data, keys, xKey = "name", height = 280, unit = "", layout = "horizontal" }: { data: Record<string, unknown>[]; keys: { key: string; label: string }[]; xKey?: string; height?: number; unit?: string; layout?: "horizontal" | "vertical" }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {layout === "horizontal" ? <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 60 : 30} /> : <XAxis type="number" tick={{ fontSize: 11 }} unit={unit} />}
          {layout === "horizontal" ? <YAxis tick={{ fontSize: 11 }} unit={unit} width={70} /> : <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11 }} width={120} />}
          <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v))} />
          {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {keys.map((k, i) => (
            <Bar key={k.key} dataKey={k.key} name={k.label} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComplexityChart({ data, lines, height = 320, xLabel = "input size n", yUnit = " ms", logScale = false }: { data: Record<string, unknown>[]; lines: { key: string; label: string; color?: string; dashed?: boolean }[]; height?: number; xLabel?: string; yUnit?: string; logScale?: boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="size" tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString()} label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 11 }} scale={logScale ? "log" : "auto"} domain={logScale ? ["auto", "auto"] : undefined} type="number" />
          <YAxis tick={{ fontSize: 11 }} unit={yUnit} width={80} scale={logScale ? "log" : "auto"} domain={logScale ? ["auto", "auto"] : [0, "auto"]} allowDataOverflow />
          <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v))} labelFormatter={(l) => `n = ${Number(l).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {lines.map((l, i) => (
            <Line key={l.key} dataKey={l.key} name={l.label} stroke={l.color ?? PALETTE[i % PALETTE.length]} strokeDasharray={l.dashed ? "5 4" : undefined} strokeWidth={l.dashed ? 1.5 : 2.2} dot={!l.dashed} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
