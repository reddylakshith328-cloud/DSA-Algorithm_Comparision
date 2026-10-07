import { getAlgorithm, listMeta } from "@/lib/algorithms/registry";
import { ValidationError } from "@/lib/algorithms/types";
import { WorkloadType } from "./workloads";

export type Task = "single-pattern" | "multi-pattern" | "prefix-lookup" | "substring-queries" | "repeat-analysis" | "fuzzy-match" | "keyword-ranking" | "document-search" | "document-similarity";

export interface WorkloadProfile {
  task: Task;
  textSize: number;
  patternSize: number;
  patternCount: number;
  documentCount: number;
  repetition: "low" | "medium" | "high";
  alphabet: "small" | "large";
  queryFrequency: "once" | "occasional" | "frequent";
  needIndexing: boolean;
  streaming: boolean;
}

export interface Recommendation {
  algorithmId: string;
  name: string;
  applicable: boolean;
  score: number;
  reasons: string[];
  cautions: string[];
  complexity: string;
}

const TASKS: Task[] = ["single-pattern", "multi-pattern", "prefix-lookup", "substring-queries", "repeat-analysis", "fuzzy-match", "keyword-ranking", "document-search", "document-similarity"];

export function parseProfile(raw: Record<string, unknown>): WorkloadProfile {
  const task = raw.task as Task;
  if (!TASKS.includes(task)) throw new ValidationError(`Unknown task. Use one of: ${TASKS.join(", ")}.`);
  const num = (k: string, d: number) => {
    const v = Number(raw[k]);
    return Number.isFinite(v) && v >= 0 ? Math.min(v, 1e10) : d;
  };
  const pick = <T extends string>(k: string, opts: T[], d: T): T => (opts.includes(raw[k] as T) ? (raw[k] as T) : d);
  return {
    task,
    textSize: num("textSize", 100_000),
    patternSize: num("patternSize", 8),
    patternCount: Math.max(1, num("patternCount", 1)),
    documentCount: num("documentCount", 1),
    repetition: pick("repetition", ["low", "medium", "high"], "low"),
    alphabet: pick("alphabet", ["small", "large"], "large"),
    queryFrequency: pick("queryFrequency", ["once", "occasional", "frequent"], "once"),
    needIndexing: Boolean(raw.needIndexing),
    streaming: Boolean(raw.streaming),
  };
}

/** Transparent rule-based scoring: every score change is accompanied by a human-readable reason. */
export function recommend(p: WorkloadProfile) {
  const recs: Recommendation[] = [];
  const add = (id: string, applicable: boolean, score: number, reasons: string[], cautions: string[] = []) => {
    const meta = getAlgorithm(id)!.meta;
    recs.push({ algorithmId: id, name: meta.name, applicable, score: Math.max(0, Math.min(100, Math.round(score))), reasons, cautions, complexity: `${meta.complexity.worst} worst, ${meta.complexity.space} space` });
  };
  const single = p.task === "single-pattern";
  const multi = p.task === "multi-pattern" || (single && p.patternCount > 1);

  // Naive
  {
    const r: string[] = [];
    const c: string[] = [];
    let s = single ? 40 : 0;
    if (single && p.patternSize <= 3) {
      s += 20;
      r.push(`Pattern is very short (m = ${p.patternSize}), so the O(n·m) bound is close to O(n) and no preprocessing is needed.`);
    }
    if (single && p.textSize < 10_000) {
      s += 10;
      r.push("Small text: simplicity outweighs asymptotic advantages.");
    }
    if (p.repetition === "high") {
      s -= 30;
      c.push("Highly repetitive text causes many partial matches → approaches n·m comparisons.");
    }
    if (!single) c.push("Only solves single-pattern search.");
    add("naive", single, s, r.length ? r : single ? ["Baseline; always correct and easy to verify."] : [], c);
  }
  // KMP
  {
    const r: string[] = [];
    const c: string[] = [];
    let s = single ? 60 : 0;
    if (single) r.push("Guaranteed O(n + m) regardless of text content.");
    if (single && p.repetition !== "low") {
      s += 20;
      r.push(`${p.repetition} repetition: the LPS table reuses partial matches instead of re-scanning.`);
    }
    if (single && p.alphabet === "small") {
      s += 10;
      r.push("Small alphabets reduce Boyer–Moore's skip distances, while KMP is unaffected.");
    }
    if (p.streaming) {
      s += 15;
      r.push("Streaming input: the text pointer never moves backwards.");
    }
    if (multi) c.push(`Would need ${p.patternCount} separate passes for ${p.patternCount} patterns.`);
    add("kmp", single, s, r, c);
  }
  // Boyer-Moore
  {
    const r: string[] = [];
    const c: string[] = [];
    let s = single ? 55 : 0;
    if (single && p.alphabet === "large") {
      s += 15;
      r.push("Large alphabet (natural language): bad-character rule often skips m positions.");
    }
    if (single && p.patternSize >= 8) {
      s += 15;
      r.push(`Longer pattern (m = ${p.patternSize}) enables larger shifts; sublinear behaviour expected.`);
    }
    if (p.alphabet === "small") {
      s -= 15;
      c.push("Small alphabet limits skips.");
    }
    if (p.repetition === "high") {
      s -= 15;
      c.push("Highly repetitive/adversarial input can degrade this variant to O(n·m).");
    }
    if (p.streaming) c.push("Right-to-left scanning needs a window buffer; less natural for streams.");
    add("boyer-moore", single, s, r, c);
  }
  // Rabin-Karp
  {
    const r: string[] = [];
    const c: string[] = ["Worst case O(n·m) under many hash collisions."];
    let s = single ? 45 : multi ? 30 : 0;
    if (single) r.push("Expected O(n + m) using a rolling hash.");
    if (multi) r.push("Rolling hashes extend to multiple patterns of equal length (fingerprinting).");
    if (p.task === "document-similarity") {
      s = 35;
      r.push("Rolling-hash fingerprints are the basis of plagiarism detection (e.g. winnowing).");
    }
    if (p.repetition === "high") {
      s -= 10;
      c.push("Every window of a repetitive text may hash-hit, forcing verification.");
    }
    add("rabin-karp", single || multi, s, r, c);
  }
  // Aho-Corasick
  {
    const r: string[] = [];
    const c: string[] = [];
    let s = multi ? 85 : 0;
    if (multi) r.push(`${p.patternCount} patterns are matched in a single pass: O(n + m + z) instead of O(k·n).`);
    if (multi && p.patternCount >= 10) {
      s += 10;
      r.push("Advantage grows with the number of patterns.");
    }
    if (single && p.patternCount === 1) c.push("With one pattern it reduces to KMP plus automaton overhead.");
    if (p.streaming && multi) r.push("Single left-to-right pass is streaming-friendly.");
    add("aho-corasick", multi, s, r, c);
  }
  // Trie
  {
    const ok = p.task === "prefix-lookup" || (multi && p.queryFrequency === "frequent");
    const r: string[] = [];
    let s = p.task === "prefix-lookup" ? 90 : ok ? 45 : 0;
    if (p.task === "prefix-lookup") r.push("Prefix/autocomplete lookups cost O(L) independent of dictionary size.");
    if (ok && p.task !== "prefix-lookup") r.push("Frequent dictionary lookups amortise the build cost.");
    add("trie", ok, s, r, ["Memory overhead per node is high for large vocabularies."]);
  }
  // Suffix array + Kasai
  {
    const ok = p.task === "substring-queries" || (single && p.queryFrequency === "frequent" && p.needIndexing);
    const r: string[] = [];
    let s = p.task === "substring-queries" ? 85 : ok ? 70 : 0;
    if (ok) r.push(`Text is indexed once (O(n log² n)); each later query costs O(m log n). With ${p.queryFrequency} queries this amortises well.`);
    if (single && !ok && p.queryFrequency === "frequent") {
      r.push("Consider enabling indexing: frequent queries on a static text favour a suffix array.");
    }
    add("suffix-array", ok, s, r, ["Static index: must be rebuilt when the text changes."]);
    const okK = p.task === "repeat-analysis" || p.task === "substring-queries";
    add("kasai", okK, p.task === "repeat-analysis" ? 90 : okK ? 50 : 0, okK ? ["LCP array answers longest-repeated-substring and distinct-substring questions in O(n) after the SA."] : [], []);
  }
  // Analytics
  add("edit-distance", p.task === "fuzzy-match", p.task === "fuzzy-match" ? (p.textSize <= 5000 ? 90 : 55) : 0, p.task === "fuzzy-match" ? ["Minimum edit operations gives an exact, explainable fuzzy-match score."] : [], p.textSize > 5000 ? ["Quadratic cost: long strings need banding or blocking."] : []);
  add("tfidf", p.task === "keyword-ranking" || p.task === "document-search", p.task === "keyword-ranking" ? 90 : p.task === "document-search" ? 55 : 0, p.task === "keyword-ranking" ? [`Highlights characteristic terms across ${p.documentCount} documents.`] : p.task === "document-search" ? ["TF-IDF weights can rank documents retrieved by an index."] : [], p.documentCount < 2 ? ["IDF is uninformative with fewer than 2 documents."] : []);
  add("inverted-index", p.task === "document-search" || (p.needIndexing && p.documentCount > 1), p.task === "document-search" ? 90 : p.needIndexing && p.documentCount > 1 ? 60 : 0, p.task === "document-search" || p.needIndexing ? [`Queries touch only the postings of their terms instead of scanning ${p.documentCount} documents.`, p.queryFrequency === "frequent" ? "Frequent queries amortise the O(T) build." : "Build cost is paid once per corpus."] : [], []);
  add("similarity", p.task === "document-similarity", p.task === "document-similarity" ? 85 : 0, p.task === "document-similarity" ? ["Cosine/Jaccard give linear-time lexical similarity with explainable shared terms."] : [], ["Lexical only — no semantic understanding."]);

  recs.sort((a, b) => Number(b.applicable) - Number(a.applicable) || b.score - a.score);
  const top = recs.filter((r) => r.applicable).slice(0, 3);
  const suggestedWorkload: WorkloadType = p.repetition === "high" ? "repetitive" : p.patternCount > 1 ? "pattern-heavy" : p.textSize >= 500_000 ? "large" : p.textSize >= 50_000 ? "medium" : "small";
  return {
    profile: p,
    explanation: top.length
      ? `Based on these workload characteristics (task: ${p.task}, n ≈ ${p.textSize.toLocaleString()}, m ≈ ${p.patternSize}, ${p.patternCount} pattern(s), ${p.documentCount} document(s), ${p.repetition} repetition, ${p.alphabet} alphabet, ${p.queryFrequency} queries${p.needIndexing ? ", indexing allowed" : ""}), ${top.map((t) => t.name).join(", ")} ${top.length > 1 ? "are" : "is"} applicable. Scores are heuristic and derived from the rules listed below — verify them with a measured benchmark.`
      : "No algorithm in the laboratory directly targets this combination.",
    recommendations: recs,
    verification: { algorithms: recs.filter((r) => r.applicable).map((r) => r.algorithmId).slice(0, 5), workload: suggestedWorkload, size: Math.min(Math.max(1000, p.textSize), 1_000_000), patternLength: Math.max(1, Math.min(200, p.patternSize)), patternCount: Math.min(200, p.patternCount) },
    allAlgorithms: listMeta().map((m) => m.id),
  };
}
