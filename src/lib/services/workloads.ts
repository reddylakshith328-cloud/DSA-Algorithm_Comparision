import { AlgorithmInput } from "@/lib/algorithms/types";

export const WORKLOAD_TYPES = [
  { id: "small", name: "Small", description: "≈1K characters of word-like random text; pattern taken from the text." },
  { id: "medium", name: "Medium", description: "≈100K characters of word-like random text." },
  { id: "large", name: "Large", description: "≈1M characters of word-like random text." },
  { id: "random", name: "Random", description: "Uniform random letters a–z (no word structure) at the chosen size." },
  { id: "repetitive", name: "Repetitive", description: "Small alphabet {a,b,c} with periodic structure; many partial matches." },
  { id: "best-case", name: "Best-case-like", description: "Pattern characters never appear in the text: mismatches happen immediately." },
  { id: "worst-case", name: "Worst-case-like", description: "Text = aaaa…a, pattern = aa…ab: maximal partial matches for naive search." },
  { id: "pattern-heavy", name: "Pattern-heavy", description: "Text built by concatenating patterns; many occurrences and many patterns." },
  { id: "adversarial", name: "Adversarial", description: "Text and pattern are all 'a': every window matches (z ≈ n), stressing verification and output." },
] as const;

export type WorkloadType = (typeof WORKLOAD_TYPES)[number]["id"];

export interface WorkloadSpec {
  type: WorkloadType;
  size?: number;
  patternLength?: number;
  patternCount?: number;
  seed?: number;
}

export interface Workload extends AlgorithmInput {
  words: string[];
  spec: Required<WorkloadSpec>;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_SIZE: Record<string, number> = { small: 1_000, medium: 100_000, large: 1_000_000 };

function makeVocabulary(rand: () => number, count: number): string[] {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const vowels = "aeiou";
  const vocab: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = 2 + Math.floor(rand() * 7);
    let w = "";
    for (let k = 0; k < len; k++) w += k % 2 ? vowels[Math.floor(rand() * 5)] : letters[Math.floor(rand() * 26)];
    vocab.push(w);
  }
  return vocab;
}

/** Deterministic (seeded) workload generator so experiments are reproducible. */
export function generateWorkload(spec: WorkloadSpec): Workload {
  const type = spec.type;
  const size = Math.max(10, Math.min(5_000_000, Math.floor(spec.size ?? DEFAULT_SIZE[type] ?? 10_000)));
  const m = Math.max(1, Math.min(1000, Math.floor(spec.patternLength ?? 8)));
  const k = Math.max(1, Math.min(500, Math.floor(spec.patternCount ?? 10)));
  const seed = Math.floor(spec.seed ?? 42);
  const rand = mulberry32(seed);
  const full: Required<WorkloadSpec> = { type, size, patternLength: m, patternCount: k, seed };
  let text = "";
  let pattern = "";
  let patterns: string[] = [];

  const substrings = (count: number) => {
    const res: string[] = [];
    for (let i = 0; i < count; i++) {
      const len = Math.max(1, Math.min(size, m + Math.floor(rand() * 3) - 1));
      const s = Math.floor(rand() * Math.max(1, size - len));
      res.push(text.slice(s, s + len));
    }
    return res;
  };

  if (type === "random") {
    const buf: string[] = new Array(size);
    for (let i = 0; i < size; i++) buf[i] = String.fromCharCode(97 + Math.floor(rand() * 26));
    text = buf.join("");
  } else if (type === "repetitive") {
    const unit = "abcab";
    const buf: string[] = new Array(size);
    for (let i = 0; i < size; i++) buf[i] = rand() < 0.02 ? "abc"[Math.floor(rand() * 3)] : unit[i % unit.length];
    text = buf.join("");
  } else if (type === "worst-case") {
    text = "a".repeat(size);
    pattern = "a".repeat(Math.max(0, m - 1)) + "b";
    patterns = Array.from({ length: k }, (_, i) => "a".repeat(Math.max(1, m - 1 - (i % Math.max(1, m - 1)))) + "b");
  } else if (type === "adversarial") {
    text = "a".repeat(size);
    pattern = "a".repeat(m);
    patterns = Array.from({ length: k }, (_, i) => "a".repeat(1 + (i % m)));
  } else {
    const vocab = makeVocabulary(rand, 2000);
    const parts: string[] = [];
    let len = 0;
    if (type === "pattern-heavy") {
      const pats = Array.from({ length: k }, () => vocab[Math.floor(rand() * 50)] + vocab[Math.floor(rand() * vocab.length)].slice(0, Math.max(1, m - 2)));
      patterns = pats;
      while (len < size) {
        const w = rand() < 0.5 ? pats[Math.floor(rand() * pats.length)] : vocab[Math.floor(rand() * vocab.length)];
        parts.push(w);
        len += w.length + 1;
      }
    } else {
      while (len < size) {
        // Zipf-like: squaring skews towards frequent words
        const r = rand();
        const w = vocab[Math.floor(r * r * vocab.length)];
        parts.push(w);
        len += w.length + 1;
      }
    }
    text = parts.join(" ").slice(0, size);
  }

  if (type === "best-case") {
    pattern = "Z".repeat(m);
    patterns = Array.from({ length: k }, (_, i) => String.fromCharCode(65 + (i % 26)).repeat(m));
  }
  if (!pattern) pattern = substrings(1)[0].slice(0, m).padEnd(Math.min(m, size), "a");
  if (patterns.length === 0) patterns = substrings(k);

  const words = (text.match(/[a-z]+/gi) ?? []).slice(0, 500_000);
  const effectiveWords = words.length ? words : [text.slice(0, Math.min(20, text.length))];
  const documents: string[] = [];
  for (let i = 0; i < effectiveWords.length; i += 60) documents.push(effectiveWords.slice(i, i + 60).join(" "));
  // textB: a mutated copy of text for edit distance / similarity
  const tb = text.split("");
  for (let i = 0; i < tb.length; i++) if (rand() < 0.1) tb[i] = String.fromCharCode(97 + Math.floor(rand() * 26));
  const query = [effectiveWords[0], effectiveWords[Math.floor(effectiveWords.length / 2)], effectiveWords[effectiveWords.length - 1]].join(" ");
  return { text, pattern: pattern.slice(0, size), patterns, documents, textB: tb.join(""), query, method: "cosine", words: effectiveWords, spec: full };
}

/** Adapt a generic workload to an algorithm's expected input fields. */
export function adaptInput(algorithmId: string, w: Workload | AlgorithmInput & { words?: string[] }, maxSize: number): AlgorithmInput {
  const text = (w.text ?? "").slice(0, maxSize);
  switch (algorithmId) {
    case "trie": {
      const words: string[] = [];
      let total = 0;
      outer: for (const raw of w.words ?? (text.match(/\S+/g) ?? [])) {
        // split pathological very long tokens (e.g. adversarial "aaaa…") into 1000-char keys
        for (let s = 0; s < raw.length; s += 1000) {
          const x = raw.slice(s, s + 1000);
          if (total + x.length > maxSize) break outer;
          words.push(x);
          total += x.length;
        }
      }
      return { patterns: words.length ? words : [text.slice(0, 10) || "a"], query: (w.pattern ?? "").slice(0, 3) };
    }
    case "aho-corasick":
      return { text, patterns: w.patterns && w.patterns.length ? w.patterns : [w.pattern ?? ""] };
    case "suffix-array":
    case "kasai":
      return { text };
    case "edit-distance":
      return { text, textB: (w.textB ?? text).slice(0, maxSize) };
    case "similarity":
      return { text, textB: (w.textB ?? text).slice(0, maxSize), method: w.method ?? "cosine" };
    case "tfidf":
    case "inverted-index": {
      const docs: string[] = [];
      let total = 0;
      for (const d of w.documents ?? []) {
        if (total + d.length > maxSize) break;
        docs.push(d);
        total += d.length;
      }
      if (!docs.length) docs.push(text || "empty");
      return { documents: docs, query: w.query ?? "" };
    }
    default:
      return { text, pattern: w.pattern };
  }
}
