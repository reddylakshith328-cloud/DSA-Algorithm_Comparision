import { AlgorithmDefinition } from "../types";
import { requireDocuments } from "@/lib/utils/validators";
import { tokenize } from "@/lib/utils/preprocessing";

export interface Posting {
  doc: number;
  tf: number;
  positions: number[];
}

export function buildIndex(docs: string[], onToken?: () => void): Map<string, Posting[]> {
  const index = new Map<string, Posting[]>();
  docs.forEach((d, di) => {
    const toks = tokenize(d, { removeStopWords: true });
    toks.forEach((t, pos) => {
      onToken?.();
      let list = index.get(t);
      if (!list) {
        list = [];
        index.set(t, list);
      }
      const last = list[list.length - 1];
      if (last && last.doc === di) {
        last.tf++;
        if (last.positions.length < 50) last.positions.push(pos);
      } else list.push({ doc: di, tf: 1, positions: [pos] });
    });
  });
  return index;
}

export const invertedIndex: AlgorithmDefinition = {
  meta: {
    id: "inverted-index",
    name: "Inverted Index",
    category: "text-analytics",
    description: "Maps each term to the list of documents (postings) containing it, enabling fast Boolean and ranked keyword search.",
    complexity: { best: "O(T) build, O(q + p) query", average: "O(T) build", worst: "O(T) build, O(Σ postings) query", space: "O(T)", notes: "T = total tokens, q = query terms, p = postings scanned." },
    input: { fields: ["documents", "query"], requirements: "One or more documents (one per line) and a keyword query.", output: "Index statistics, postings for query terms, AND / OR results ranked by term frequency.", example: { documents: ["new home sales top forecasts", "home sales rise in july", "increase in home sales in july", "july new home sales rise"], query: "home sales july" } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "for each document d, position p, token t:",
      "  append (d, p) to postings[t]",
      "query: terms ← tokenize(q)",
      "  lists ← postings[t] for t in terms",
      "  AND ← intersect(lists) (shortest list first)",
      "  OR ← union(lists); rank by Σ tf",
    ],
    learning: {
      what: "An inverted index is the core data structure of search engines: for every term it stores which documents contain it.",
      why: "Scanning every document per query is O(total text). With an index, a query touches only the postings of its terms.",
      how: ["Tokenize every document.", "For each token, append the document id (and position) to that term's postings list.", "To answer a query, fetch the postings of each query term.", "Intersect lists for AND queries (merge of sorted lists) or union them for OR, then rank."],
      example: "'home' → [D1, D2, D3, D4], 'july' → [D2, D3, D4]; AND gives D2, D3, D4.",
      advantages: ["Sub-linear query time", "Supports Boolean, phrase (positions) and ranked retrieval", "Compressible postings"],
      limitations: ["Build time and storage overhead", "Updates require merging", "Exact-term matching unless extended"],
      applications: ["Web search (Lucene, Elasticsearch)", "Log search", "Code search", "Digital libraries"],
    },
    model: "n",
    maxBenchmarkSize: 3_000_000,
    vizLimits: { text: 2000, items: 8 },
  },
  validate(input) {
    return { documents: requireDocuments(input, 1), query: (input.query ?? "").slice(0, 500) };
  },
  inputSize(input) {
    return { n: (input.documents ?? []).reduce((s, d) => s + d.length, 0), m: input.query?.length ?? 0, k: input.documents?.length ?? 0 };
  },
  run(input, ctx) {
    const docs = input.documents!;
    const query = input.query ?? "";
    const index = new Map<string, Posting[]>();
    if (ctx.record) {
      docs.forEach((d, di) => {
        const toks = tokenize(d, { removeStopWords: true });
        toks.forEach((t, pos) => {
          ctx.counters.operations++;
          const list = index.get(t) ?? [];
          if (!index.has(t)) index.set(t, list);
          const last = list[list.length - 1];
          if (last && last.doc === di) {
            last.tf++;
            last.positions.push(pos);
          } else list.push({ doc: di, tf: 1, positions: [pos] });
        });
        ctx.step(() => ({
          phase: "1. Index documents",
          description: `Indexed D${di + 1} (${toks.length} tokens). Index now has ${index.size} terms.`,
          line: 1,
          table: { title: "Inverted index (term → postings)", headers: ["term", "df", "postings (doc:tf)"], rows: Array.from(index.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 30).map(([t, l]) => [t, l.length, l.map((p) => `D${p.doc + 1}:${p.tf}`).join("  ")]) },
          vars: { document: `D${di + 1}`, terms: index.size },
        }));
      });
    } else {
      for (const [k, v] of buildIndex(docs, () => ctx.counters.operations++)) index.set(k, v);
    }
    const terms = Array.from(new Set(tokenize(query, { removeStopWords: true })));
    const lists = terms.map((t) => ({ term: t, postings: index.get(t) ?? [] }));
    lists.forEach((l) => {
      ctx.counters.comparisons++;
      ctx.step(() => ({
        phase: "2. Query lookup",
        description: l.postings.length ? `Look up "${l.term}": ${l.postings.length} document(s).` : `Look up "${l.term}": not in index.`,
        line: 3,
        table: { title: `Postings for "${l.term}"`, headers: ["doc", "tf", "positions"], rows: l.postings.map((p) => [`D${p.doc + 1}`, p.tf, p.positions.join(", ")]) },
      }));
    });
    // AND via merge of sorted lists (shortest first)
    const sorted = lists.slice().sort((a, b) => a.postings.length - b.postings.length);
    let andDocs: number[] = sorted.length ? sorted[0].postings.map((p) => p.doc) : [];
    for (let k = 1; k < sorted.length; k++) {
      const other = sorted[k].postings;
      const res: number[] = [];
      let i = 0;
      let j = 0;
      while (i < andDocs.length && j < other.length) {
        ctx.counters.comparisons++;
        if (andDocs[i] === other[j].doc) {
          res.push(andDocs[i]);
          i++;
          j++;
        } else if (andDocs[i] < other[j].doc) i++;
        else j++;
      }
      andDocs = res;
    }
    const scores = new Map<number, { score: number; matched: string[] }>();
    for (const l of lists)
      for (const p of l.postings) {
        const s = scores.get(p.doc) ?? { score: 0, matched: [] };
        s.score += p.tf;
        s.matched.push(l.term);
        scores.set(p.doc, s);
        ctx.counters.operations++;
      }
    const orRanked = Array.from(scores.entries())
      .sort((a, b) => b[1].matched.length - a[1].matched.length || b[1].score - a[1].score)
      .map(([doc, s]) => ({ doc, score: s.score, matchedTerms: s.matched, preview: docs[doc].slice(0, 120) }));
    ctx.step(() => ({
      phase: "3. Combine",
      description: `AND (all terms): ${andDocs.map((d) => `D${d + 1}`).join(", ") || "none"}. OR (any term), ranked by matched terms then Σtf: ${orRanked.slice(0, 6).map((r) => `D${r.doc + 1}`).join(", ") || "none"}.`,
      line: 4,
      table: { title: "Ranked results (OR)", headers: ["doc", "matched terms", "Σ tf", "text"], rows: orRanked.slice(0, 20).map((r) => [`D${r.doc + 1}`, r.matchedTerms.join(", "), r.score, r.preview.slice(0, 50)]), highlightRows: Object.fromEntries(orRanked.map((r, i) => [i, andDocs.includes(r.doc) ? "found" : "compare"])) },
    }));
    const postingsTotal = Array.from(index.values()).reduce((s, l) => s + l.length, 0);
    const topTerms = Array.from(index.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 20).map(([term, l]) => ({ term, df: l.length, totalTf: l.reduce((s, p) => s + p.tf, 0) }));
    return {
      output: {
        documents: docs.length,
        terms: index.size,
        postings: postingsTotal,
        query,
        queryTerms: lists.map((l) => ({ term: l.term, df: l.postings.length, postings: l.postings.slice(0, 50).map((p) => ({ doc: p.doc, tf: p.tf })) })),
        andResults: andDocs.slice(0, 200),
        orResults: orRanked.slice(0, 50),
        topTerms,
      },
      summary: `Indexed ${docs.length} document(s): ${index.size} terms, ${postingsTotal} postings.${query ? ` Query "${query}": ${andDocs.length} AND hit(s), ${orRanked.length} OR hit(s).` : ""}`,
      memoryBytes: index.size * 64 + postingsTotal * 40,
    };
  },
};
