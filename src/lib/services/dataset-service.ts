import { ValidationError } from "@/lib/algorithms/types";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { LIMITS } from "@/lib/utils/validators";
import { preprocess, PreprocessConfig } from "@/lib/utils/preprocessing";
import { computeStats } from "./dataset-stats";
import { generateWorkload, WorkloadType, WORKLOAD_TYPES } from "./workloads";

export function validateName(name: unknown): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) throw new ValidationError("Dataset name is required.");
  if (n.length > 120) throw new ValidationError("Dataset name must be at most 120 characters.");
  return n;
}

export function validateContent(content: unknown): string {
  if (typeof content !== "string" || content.trim().length === 0) throw new ValidationError("Dataset content must not be empty.");
  if (content.length > LIMITS.maxTextChars) throw new ValidationError(`Dataset is too large (${content.length.toLocaleString()} chars, max ${LIMITS.maxTextChars.toLocaleString()}).`);
  if (content.includes("\u0000")) throw new ValidationError("Dataset appears to be binary. Only plain text is supported.");
  return content.replace(/\r\n?/g, "\n");
}

export async function createDataset(opts: { name: unknown; description?: unknown; source: string; content: string; preprocessing?: PreprocessConfig | null; note?: string }) {
  const name = validateName(opts.name);
  let content = validateContent(opts.content);
  let pre: unknown = null;
  if (opts.preprocessing && Object.values(opts.preprocessing).some(Boolean)) {
    const r = preprocess(content, opts.preprocessing);
    content = validateContent(r.text);
    pre = { config: opts.preprocessing, steps: r.steps };
  }
  return datasetRepository.create({ name, description: typeof opts.description === "string" ? opts.description.slice(0, 1000) : "", source: opts.source, content, stats: computeStats(content), preprocessing: pre, note: opts.note });
}

export function syntheticContent(type: unknown, size: unknown, seed: unknown): { content: string; note: string } {
  if (!WORKLOAD_TYPES.some((w) => w.id === type)) throw new ValidationError("Unknown synthetic workload type.");
  const s = Math.max(100, Math.min(2_000_000, Number(size) || 10_000));
  const w = generateWorkload({ type: type as WorkloadType, size: s, seed: Number(seed) || 42 });
  // one document per ~60 words for word-based workloads, otherwise raw text in 200-char lines
  const content = /[ ]/.test(w.text!) ? w.documents!.join("\n") : (w.text!.match(/.{1,200}/g) ?? []).join("\n");
  return { content, note: `Synthetic ${type} workload, size ${s}, seed ${w.spec.seed}` };
}
