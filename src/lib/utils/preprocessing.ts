export const STOP_WORDS = new Set(
  "a an and are as at be been but by for from has have he her his i in into is it its of on or our she so than that the their them then there these they this to was we were what when which who will with you your not no do does did can could would should may might just also about over after before more most such only own same too very s t".split(
    " ",
  ),
);

const TOKEN_RE = /[a-z0-9\u00C0-\u024F']+/gi;

export function tokenize(text: string, opts: { lowercase?: boolean; removeStopWords?: boolean } = {}): string[] {
  const lower = opts.lowercase ?? true;
  const raw = (lower ? text.toLowerCase() : text).match(TOKEN_RE) ?? [];
  const toks = raw.map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean);
  return opts.removeStopWords ? toks.filter((t) => !STOP_WORDS.has(t.toLowerCase())) : toks;
}

export interface PreprocessConfig {
  lowercase?: boolean;
  normalizeWhitespace?: boolean;
  removePunctuation?: boolean;
  removeStopWords?: boolean;
  removeDuplicateLines?: boolean;
  removeEmptyLines?: boolean;
  normalizeUnicode?: boolean;
  tokenize?: boolean;
}

export interface PreprocessStep {
  name: string;
  charsBefore: number;
  charsAfter: number;
  detail: string;
}

export interface PreprocessResult {
  text: string;
  steps: PreprocessStep[];
  before: { chars: number; lines: number; words: number };
  after: { chars: number; lines: number; words: number };
}

const countWords = (t: string) => (t.match(/\S+/g) ?? []).length;
const countLines = (t: string) => (t.length ? t.split("\n").length : 0);

/** Applies a deterministic, ordered preprocessing pipeline and records what changed at each stage. */
export function preprocess(input: string, cfg: PreprocessConfig): PreprocessResult {
  let text = input;
  const steps: PreprocessStep[] = [];
  const apply = (name: string, fn: (t: string) => string, detail: (b: string, a: string) => string) => {
    const b = text;
    text = fn(text);
    steps.push({ name, charsBefore: b.length, charsAfter: text.length, detail: detail(b, text) });
  };
  const diff = (b: string, a: string) => `${(b.length - a.length).toLocaleString()} characters removed`;
  if (cfg.normalizeUnicode) apply("Unicode normalization (NFKC, strip accents)", (t) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC"), diff);
  if (cfg.lowercase) {
    apply("Lowercase conversion", (t) => t.toLowerCase(), (b) => `${(b.match(/[A-Z\u00C0-\u00DE]/g) ?? []).length.toLocaleString()} uppercase characters converted`);
  }
  if (cfg.removePunctuation) apply("Punctuation removal", (t) => t.replace(/[!"#$%&()*+,\-./:;<=>?@[\\\]^_`{|}~“”‘’…–—]/g, " "), (b) => `${(b.match(/[!"#$%&()*+,\-./:;<=>?@[\\\]^_`{|}~“”‘’…–—]/g) ?? []).length.toLocaleString()} punctuation marks replaced`);
  if (cfg.removeStopWords)
    apply(
      "Stop-word removal",
      (t) => t.split("\n").map((line) => line.split(/(\s+)/).filter((w) => !STOP_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, "")) || /^\s+$/.test(w)).join("")).join("\n"),
      (b, a) => `${Math.max(0, countWords(b) - countWords(a)).toLocaleString()} stop words removed`,
    );
  if (cfg.normalizeWhitespace) apply("Whitespace normalization", (t) => t.split("\n").map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim()).join("\n"), diff);
  if (cfg.removeEmptyLines) apply("Empty-line removal", (t) => t.split("\n").filter((l) => l.trim().length > 0).join("\n"), (b, a) => `${countLines(b) - countLines(a)} empty lines removed`);
  if (cfg.removeDuplicateLines)
    apply(
      "Duplicate-line removal",
      (t) => {
        const seen = new Set<string>();
        return t
          .split("\n")
          .filter((l) => {
            if (l.trim() === "") return true;
            if (seen.has(l)) return false;
            seen.add(l);
            return true;
          })
          .join("\n");
      },
      (b, a) => `${countLines(b) - countLines(a)} duplicate lines removed`,
    );
  if (cfg.tokenize) apply("Tokenization (one token per space)", (t) => t.split("\n").map((l) => tokenize(l, { lowercase: false }).join(" ")).join("\n"), (b, a) => `${countWords(a).toLocaleString()} tokens produced`);
  return {
    text,
    steps,
    before: { chars: input.length, lines: countLines(input), words: countWords(input) },
    after: { chars: text.length, lines: countLines(text), words: countWords(text) },
  };
}

export function splitDocuments(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
