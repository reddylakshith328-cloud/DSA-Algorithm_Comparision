"use client";

import type { PreprocessConfig } from "@/lib/utils/preprocessing";

export type PreConfig = PreprocessConfig;

export const PRE_OPTIONS: { key: keyof PreprocessConfig; label: string }[] = [
  { key: "lowercase", label: "Lowercase conversion" },
  { key: "normalizeWhitespace", label: "Whitespace normalization" },
  { key: "removePunctuation", label: "Punctuation removal" },
  { key: "removeStopWords", label: "Stop-word removal" },
  { key: "removeEmptyLines", label: "Empty-line removal" },
  { key: "removeDuplicateLines", label: "Duplicate-line removal" },
  { key: "normalizeUnicode", label: "Unicode / accent normalization" },
  { key: "tokenize", label: "Tokenization" },
];

export function PreprocessOptions({ value, onChange, title = "Preprocessing (optional)" }: { value: PreConfig; onChange: (v: PreConfig) => void; title?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-1.5">
        {PRE_OPTIONS.map((o) => (
          <label key={o.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!value[o.key]} onChange={(e) => onChange({ ...value, [o.key]: e.target.checked })} />
            {o.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Applied to the text before execution, in the order listed. Preview the effect in the Dataset Lab.</p>
    </div>
  );
}
