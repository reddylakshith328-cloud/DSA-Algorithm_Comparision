import { AlgorithmInput, Highlight, VizString } from "../types";
import { requirePattern, requireText } from "@/lib/utils/validators";

export function validateSingle(input: AlgorithmInput): AlgorithmInput {
  const text = requireText(input);
  const pattern = requirePattern(input, text);
  return { text, pattern };
}

export function singleSize(input: AlgorithmInput) {
  return { n: input.text?.length ?? 0, m: input.pattern?.length ?? 0, k: 1 };
}

export interface WindowOpts {
  matched?: number[]; // pattern indices already confirmed
  compare?: number; // pattern index currently compared
  result?: "match" | "mismatch";
  found: number[];
  extra?: Record<number, Highlight>; // additional text highlights
}

/** Builds text + sliding pattern rows used by every single-pattern matcher. */
export function windowStrings(text: string, pattern: string, shift: number, o: WindowOpts): VizString[] {
  const m = pattern.length;
  const th: Record<number, Highlight> = {};
  for (const s of o.found) for (let k = 0; k < m; k++) th[s + k] = "found";
  for (let k = 0; k < m && shift + k < text.length; k++) if (!th[shift + k]) th[shift + k] = "window";
  const ph: Record<number, Highlight> = {};
  for (const p of o.matched ?? []) {
    th[shift + p] = "match";
    ph[p] = "match";
  }
  if (o.compare !== undefined) {
    const h: Highlight = o.result === "mismatch" ? "mismatch" : o.result === "match" ? "match" : "compare";
    th[shift + o.compare] = h;
    ph[o.compare] = h;
  }
  if (o.extra) Object.assign(th, o.extra);
  return [
    { label: "Text", chars: text, highlights: th, pointer: o.compare !== undefined ? shift + o.compare : undefined },
    { label: "Pattern", chars: pattern, offset: shift, highlights: ph, pointer: o.compare },
  ];
}

export function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i < b; i++) r.push(i);
  return r;
}

export function matchSummary(matches: number[], pattern: string): string {
  if (matches.length === 0) return `Pattern "${truncate(pattern)}" was not found.`;
  return `Found ${matches.length} occurrence${matches.length === 1 ? "" : "s"} of "${truncate(pattern)}" at index ${matches
    .slice(0, 10)
    .join(", ")}${matches.length > 10 ? ", …" : ""}.`;
}

export function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Reference matcher used to verify correctness in benchmarks (built-in indexOf, overlapping). */
export function referenceMatches(text: string, pattern: string): number[] {
  const res: number[] = [];
  if (!pattern) return res;
  let i = text.indexOf(pattern);
  while (i !== -1) {
    res.push(i);
    i = text.indexOf(pattern, i + 1);
  }
  return res;
}
