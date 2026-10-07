"use client";

import { useCallback, useEffect, useState } from "react";

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

/** Fetch wrapper that never throws: network failures and API errors become friendly messages. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      const msg = (json as { error?: string } | null)?.error ?? (res.status >= 500 ? "The server encountered an error. Please try again." : `Request failed (${res.status}).`);
      return { data: null, error: msg, status: res.status };
    }
    return { data: json as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "Cannot reach the laboratory backend. Check that the server is running.", status: 0 };
  }
}

export async function download(url: string, body: unknown, fallbackName: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return (j as { error?: string } | null)?.error ?? "Export failed.";
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return null;
  } catch {
    return "Export failed: backend unavailable.";
  }
}

export function useApi<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!url });
  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true }));
    const r = await api<T>(url);
    setState({ data: r.data, error: r.error, loading: false });
  }, [url]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  return { ...state, reload: load };
}

export const fmtMs = (ms: number | null | undefined) => (ms === null || ms === undefined || !Number.isFinite(ms) ? "—" : ms < 1 ? `${(ms * 1000).toFixed(1)} µs` : ms < 1000 ? `${ms.toFixed(ms < 10 ? 3 : 1)} ms` : `${(ms / 1000).toFixed(2)} s`);
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString());
export const fmtBytes = (b: number | null | undefined) => (b === null || b === undefined ? "—" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
export const fmtRate = (r: number | null | undefined) => (r === null || r === undefined || !Number.isFinite(r) || r === 0 ? "—" : r >= 1e6 ? `${(r / 1e6).toFixed(2)} M chars/s` : r >= 1e3 ? `${(r / 1e3).toFixed(1)} K chars/s` : `${r.toFixed(0)} chars/s`);
export const fmtDate = (d: string | Date) => new Date(d).toLocaleString();

export const PALETTE = ["#4f46e5", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488", "#65a30d", "#ea580c", "#2563eb", "#475569"];
