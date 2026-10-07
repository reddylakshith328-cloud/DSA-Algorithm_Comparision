import { AlgorithmInput, ValidationError } from "@/lib/algorithms/types";

export const LIMITS = {
  maxTextChars: 5_000_000,
  maxPatternChars: 10_000,
  maxPatterns: 500,
  maxDocuments: 20_000,
  maxUploadBytes: 10 * 1024 * 1024,
  maxInlineStoreChars: 200_000,
};

export function requireText(input: AlgorithmInput, field: "text" | "textB" = "text", label = "Text"): string {
  const v = input[field];
  if (typeof v !== "string" || v.length === 0) throw new ValidationError(`${label} must not be empty.`);
  if (v.length > LIMITS.maxTextChars)
    throw new ValidationError(`${label} is too large (${v.length.toLocaleString()} chars). Maximum is ${LIMITS.maxTextChars.toLocaleString()}.`);
  return v;
}

export function requirePattern(input: AlgorithmInput, text?: string): string {
  const p = input.pattern;
  if (typeof p !== "string" || p.length === 0) throw new ValidationError("Pattern must not be empty.");
  if (p.length > LIMITS.maxPatternChars) throw new ValidationError(`Pattern is too long (max ${LIMITS.maxPatternChars} chars).`);
  if (text !== undefined && p.length > text.length)
    throw new ValidationError(`Pattern (${p.length} chars) is longer than the text (${text.length} chars).`);
  return p;
}

export function requirePatterns(input: AlgorithmInput): string[] {
  const list = (input.patterns ?? []).map((p) => String(p)).filter((p) => p.length > 0);
  if (list.length === 0) throw new ValidationError("Provide at least one non-empty pattern.");
  if (list.length > LIMITS.maxPatterns) throw new ValidationError(`Too many patterns (max ${LIMITS.maxPatterns}).`);
  if (list.some((p) => p.length > LIMITS.maxPatternChars)) throw new ValidationError("One of the patterns is too long.");
  return list;
}

export function requireDocuments(input: AlgorithmInput, min = 1): string[] {
  const docs = (input.documents ?? []).map((d) => String(d)).filter((d) => d.trim().length > 0);
  if (docs.length < min) throw new ValidationError(`Provide at least ${min} non-empty document${min > 1 ? "s" : ""}.`);
  if (docs.length > LIMITS.maxDocuments) throw new ValidationError(`Too many documents (max ${LIMITS.maxDocuments}).`);
  const total = docs.reduce((s, d) => s + d.length, 0);
  if (total > LIMITS.maxTextChars) throw new ValidationError("Combined document size is too large.");
  return docs;
}

export function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

export function asStringArray(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ValidationError("Expected an array of strings.");
  return v.map((x) => String(x));
}

export function sanitizeInput(raw: unknown): AlgorithmInput {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  return {
    text: str("text"),
    pattern: str("pattern"),
    patterns: asStringArray(o.patterns),
    documents: asStringArray(o.documents),
    query: str("query"),
    textB: str("textB"),
    method: str("method"),
    topK: typeof o.topK === "number" ? Math.max(1, Math.min(100, Math.floor(o.topK))) : undefined,
  };
}

export function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
