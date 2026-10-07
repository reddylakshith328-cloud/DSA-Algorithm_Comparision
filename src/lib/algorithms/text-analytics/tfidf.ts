import { AlgorithmDefinition, RunContext } from "../types";
import { requireDocuments } from "@/lib/utils/validators";
import { tokenize } from "@/lib/utils/preprocessing";

export interface TfidfModel {
  vocabulary: string[];
  df: Map<string, number>;
  idf: Map<string, number>;
  tf: Map<string, number>[]; // normalised term frequency per doc
  counts: Map<string, number>[];
  weights: Map<string, number>[];
  lengths: number[];
}

/** Smoothed IDF: ln((1 + N) / (1 + df)) + 1. TF = count / doc length. */
export function buildTfidf(docs: string[], removeStopWords = true, ctx?: RunContext): TfidfModel {
  const N = docs.length;
  const counts: Map<string, number>[] = [];
  const lengths: number[] = [];
  const df = new Map<string, number>();
  for (const d of docs) {
    const toks = tokenize(d, { removeStopWords });
    const c = new Map<string, number>();
    for (const t of toks) {
      c.set(t, (c.get(t) ?? 0) + 1);
      if (ctx) ctx.counters.operations++;
    }
    for (const t of c.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    counts.push(c);
    lengths.push(toks.length);
  }
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log((1 + N) / (1 + f)) + 1);
  const tf = counts.map((c, i) => {
    const m = new Map<string, number>();
    for (const [t, v] of c) m.set(t, lengths[i] ? v / lengths[i] : 0);
    return m;
  });
  const weights = tf.map((m) => {
    const w = new Map<string, number>();
    for (const [t, v] of m) {
      w.set(t, v * idf.get(t)!);
      if (ctx) ctx.counters.operations++;
    }
    return w;
  });
  return { vocabulary: Array.from(df.keys()).sort(), df, idf, tf, counts, weights, lengths };
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

export const tfidf: AlgorithmDefinition = {
  meta: {
    id: "tfidf",
    name: "TF-IDF",
    category: "text-analytics",
    description: "Weights each term by how frequent it is in a document and how rare it is across the corpus, surfacing distinctive keywords.",
    complexity: { best: "O(T)", average: "O(T + V·log V)", worst: "O(T + D·V)", space: "O(D·V) sparse", notes: "T = total tokens, D = documents, V = vocabulary size." },
    input: { fields: ["documents"], requirements: "Two or more documents (one per line). Stop words are removed by default.", output: "TF, DF, IDF and TF-IDF scores; top terms per document and corpus-wide ranking.", example: { documents: ["the cat sat on the mat", "the dog sat on the log", "cats and dogs are pets", "the mat was red"] } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "for each document d: tokens ← tokenize(d)",
      "  TF[t,d] ← count(t,d) / |d|",
      "DF[t] ← number of documents containing t",
      "IDF[t] ← ln((1 + N) / (1 + DF[t])) + 1",
      "TFIDF[t,d] ← TF[t,d] · IDF[t]",
      "rank terms by TF-IDF",
    ],
    learning: {
      what: "TF-IDF is a numeric statistic reflecting how important a word is to a document in a collection.",
      why: "Raw frequency is dominated by common words. Multiplying by inverse document frequency down-weights words that appear everywhere.",
      how: ["Tokenize and normalise each document.", "Term frequency: occurrences divided by document length.", "Document frequency: number of documents containing the term.", "IDF = ln((1+N)/(1+DF)) + 1 (smoothed).", "Score = TF × IDF; high scores mark characteristic terms."],
      example: "In a corpus about pets, 'mat' appears in 2 of 4 documents and gets a higher IDF than 'sat' if 'sat' appears in more.",
      advantages: ["Simple, fast, interpretable", "Strong baseline for search & classification", "Sparse representation scales well"],
      limitations: ["Ignores word order and semantics", "Synonyms treated as unrelated", "Sensitive to tokenization choices"],
      applications: ["Search-engine ranking", "Keyword extraction", "Document clustering", "Feature vectors for ML"],
    },
    model: "n",
    maxBenchmarkSize: 3_000_000,
    vizLimits: { text: 2000, items: 8 },
  },
  validate(input) {
    return { documents: requireDocuments(input, 1), topK: input.topK ?? 10 };
  },
  inputSize(input) {
    return { n: (input.documents ?? []).reduce((s, d) => s + d.length, 0), m: 0, k: input.documents?.length ?? 0 };
  },
  run(input, ctx) {
    const docs = input.documents!;
    const topK = input.topK ?? 10;
    const model = buildTfidf(docs, true, ctx);
    const N = docs.length;
    const docLabels = docs.map((_, i) => `D${i + 1}`);
    if (ctx.record) {
      docs.forEach((d, i) => {
        const toks = tokenize(d, { removeStopWords: true });
        ctx.step(() => ({
          phase: "1. Tokenize",
          description: `D${i + 1}: ${toks.length} tokens after lowercasing and stop-word removal → [${toks.slice(0, 20).join(", ")}${toks.length > 20 ? ", …" : ""}].`,
          line: 0,
          table: { title: `Term counts in D${i + 1}`, headers: ["term", "count", "TF"], rows: Array.from(model.counts[i].entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, c]) => [t, c, r4(model.tf[i].get(t)!)]) },
        }));
      });
      const vocabRanked = model.vocabulary.slice().sort((a, b) => model.df.get(b)! - model.df.get(a)!).slice(0, 20);
      ctx.step(() => ({
        phase: "2. Document frequency",
        description: `Vocabulary has ${model.vocabulary.length} terms. DF counts how many of the ${N} documents contain each term.`,
        line: 2,
        bars: vocabRanked.map((t) => ({ label: t, value: model.df.get(t)! })),
        table: { title: "DF and IDF", headers: ["term", "DF", "IDF"], rows: vocabRanked.map((t) => [t, model.df.get(t)!, r4(model.idf.get(t)!)]) },
      }));
      ctx.step(() => ({
        phase: "3. Inverse document frequency",
        description: "IDF = ln((1+N)/(1+DF)) + 1. Rare terms receive higher weight; terms in every document get the minimum weight 1.",
        line: 3,
        bars: model.vocabulary.slice().sort((a, b) => model.idf.get(b)! - model.idf.get(a)!).slice(0, 20).map((t) => ({ label: t, value: r4(model.idf.get(t)!) })),
      }));
      const ranked = rankGlobal(model).slice(0, 12);
      ctx.step(() => ({
        phase: "4. TF-IDF matrix",
        description: "TF-IDF[t,d] = TF[t,d] × IDF[t]. Rows show the highest-scoring terms across the corpus.",
        line: 4,
        table: { title: "TF-IDF (term × document)", headers: ["term", ...docLabels], rows: ranked.map(({ term }) => [term, ...model.weights.map((w) => (w.has(term) ? r4(w.get(term)!) : 0))]) },
      }));
      docs.forEach((_, i) => {
        const top = Array.from(model.weights[i].entries()).sort((a, b) => b[1] - a[1]).slice(0, topK);
        ctx.step(() => ({ phase: "5. Ranking", description: `Most characteristic terms of D${i + 1}: ${top.slice(0, 5).map(([t]) => t).join(", ")}.`, line: 5, bars: top.map(([t, v], k) => ({ label: t, value: r4(v), highlight: k === 0 })) }));
      });
    }
    const topPerDoc = model.weights.map((w, i) => ({
      document: i,
      preview: docs[i].slice(0, 80),
      terms: Array.from(w.entries()).sort((a, b) => b[1] - a[1]).slice(0, topK).map(([term, score]) => ({ term, score: r4(score), tf: r4(model.tf[i].get(term)!), idf: r4(model.idf.get(term)!) })),
    }));
    return {
      output: { documents: N, vocabularySize: model.vocabulary.length, totalTokens: model.lengths.reduce((a, b) => a + b, 0), globalRanking: rankGlobal(model).slice(0, 30), topTermsPerDocument: topPerDoc.slice(0, 50) },
      summary: `Computed TF-IDF for ${N} document(s) with a vocabulary of ${model.vocabulary.length} terms.`,
      memoryBytes: model.weights.reduce((s, w) => s + w.size * 48, 0) + model.vocabulary.length * 64,
    };
  },
};

export function rankGlobal(model: TfidfModel) {
  const best = new Map<string, number>();
  for (const w of model.weights) for (const [t, v] of w) if (v > (best.get(t) ?? 0)) best.set(t, v);
  return Array.from(best.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term, score]) => ({ term, score: r4(score), df: model.df.get(term)!, idf: r4(model.idf.get(term)!) }));
}
