import { AlgorithmDefinition, Highlight } from "../types";
import { requirePatterns, requireText } from "@/lib/utils/validators";
import { TrieCore } from "../text-structures/trie";

export interface MultiMatch {
  pattern: string;
  index: number;
}

export const ahoCorasick: AlgorithmDefinition = {
  meta: {
    id: "aho-corasick",
    name: "Aho–Corasick",
    category: "multi-pattern",
    description: "Builds a trie of all patterns augmented with failure and output links, then finds every occurrence of every pattern in one pass.",
    complexity: { best: "O(n + m + z)", average: "O(n + m + z)", worst: "O(n + m + z)", space: "O(m · σ)", notes: "n = text length, m = total pattern length, z = number of reported matches." },
    input: {
      fields: ["text", "patterns"],
      requirements: "Non-empty text and one or more non-empty patterns.",
      output: "Every (pattern, index) occurrence and per-pattern counts.",
      example: { text: "ushers", patterns: ["he", "she", "his", "hers"] },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "build trie from all patterns",
      "BFS from root:",
      "  for each child v of u via c:",
      "    f ← fail[u]; while f ≠ root and c ∉ f: f ← fail[f]",
      "    fail[v] ← child(f, c) or root; out[v] ∪= out[fail[v]]",
      "state ← root",
      "for i, c in T:",
      "  while state ≠ root and c ∉ state: state ← fail[state]",
      "  state ← child(state, c) or root",
      "  report every pattern in out[state] ending at i",
    ],
    learning: {
      what: "Aho–Corasick is a finite automaton for matching a dictionary of patterns simultaneously.",
      why: "Running KMP once per pattern costs O(k·n). Aho–Corasick scans the text once, independent of the number of patterns.",
      how: ["Insert all patterns into a trie.", "Compute failure links with BFS: the failure of a node is the longest proper suffix of its string that is also a trie prefix (like KMP's LPS).", "Output links collect patterns that end at a node or any node on its failure chain.", "Scan the text, following goto edges or failure links on mismatch, reporting outputs."],
      example: "Patterns he, she, his, hers in 'ushers': reaching 'she' also reports 'he' through its output link, then 'hers' is found.",
      advantages: ["Linear in text + patterns + matches", "Scales to thousands of patterns", "Single pass — streaming friendly"],
      limitations: ["Memory grows with dictionary size", "Automaton must be rebuilt when patterns change", "Exact matching only"],
      applications: ["Virus/IDS signature scanning (Snort, ClamAV)", "Keyword filtering", "Bioinformatics", "fgrep"],
    },
    model: "n+z",
    maxBenchmarkSize: 5_000_000,
    vizLimits: { text: 80, pattern: 60, items: 8 },
  },
  validate(input) {
    const text = requireText(input);
    return { text, patterns: requirePatterns(input) };
  },
  inputSize(input) {
    return { n: input.text?.length ?? 0, m: (input.patterns ?? []).reduce((s, p) => s + p.length, 0), k: input.patterns?.length ?? 0 };
  },
  run(input, ctx) {
    const text = input.text!;
    const patterns = input.patterns!;
    const t = new TrieCore(ctx.record);
    const own: number[][] = [[]];
    // Phase 1: trie
    patterns.forEach((p, pi) => {
      let node = 0;
      const path = [0];
      for (const c of p) {
        let nx = t.children[node].get(c);
        const created = nx === undefined;
        if (nx === undefined) {
          nx = t.addNode(node, c);
          own.push([]);
        }
        ctx.counters.operations++;
        node = nx;
        path.push(node);
        ctx.step(() => ({ phase: "1. Build trie", description: `Insert '${c}' of "${p}": ${created ? "create" : "reuse"} node #${nx}.`, line: 0, tree: { visible: t.children.length, active: path.slice() }, vars: { pattern: p, nodes: t.children.length } }));
      }
      own[node].push(pi);
      t.terminal[node] = true;
      if (ctx.record) {
        t.nodes[node].terminal = true;
        t.nodes[node].word = p;
      }
    });
    // Phase 2: failure links
    const N = t.children.length;
    const fail = new Array<number>(N).fill(0);
    const out: number[][] = own.map((o) => o.slice());
    const queue: number[] = [];
    for (const v of t.children[0].values()) queue.push(v);
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      for (const [c, v] of t.children[u]) {
        queue.push(v);
        let f = fail[u];
        while (f !== 0 && !t.children[f].has(c)) {
          f = fail[f];
          ctx.counters.operations++;
        }
        const cand = t.children[f].get(c);
        fail[v] = cand !== undefined && cand !== v ? cand : 0;
        if (out[fail[v]].length) out[v] = out[v].concat(out[fail[v]]);
        ctx.counters.operations++;
        if (ctx.record) {
          t.nodes[v].fail = fail[v];
          t.nodes[v].output = out[v].map((i) => patterns[i]);
        }
        ctx.step(() => ({
          phase: "2. Failure links",
          description: `fail(#${v} '${c}') → #${fail[v]}${out[v].length ? `. Output: {${out[v].map((i) => patterns[i]).join(", ")}}` : ""}.`,
          line: 4,
          tree: { visible: N, active: [v], showFail: true, failEdge: [v, fail[v]] },
          vars: { node: v, fail: fail[v] },
        }));
      }
    }
    // Phase 3: search
    const matches: MultiMatch[] = [];
    const counts = new Array<number>(patterns.length).fill(0);
    let state = 0;
    const found: Record<number, Highlight> = {};
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      ctx.counters.comparisons++;
      while (state !== 0 && !t.children[state].has(c)) {
        const from = state;
        state = fail[state];
        ctx.counters.comparisons++;
        ctx.step(() => ({ phase: "3. Search", description: `No edge '${c}' from #${from}. Follow failure link to #${state}.`, line: 7, tree: { visible: N, active: [state], showFail: true, failEdge: [from, state] }, strings: [{ label: "Text", chars: text, highlights: { ...found, [i]: "mismatch" }, pointer: i }], vars: { i, char: c, state } }));
      }
      state = t.children[state].get(c) ?? 0;
      ctx.counters.operations++;
      for (const pi of out[state]) {
        const p = patterns[pi];
        matches.push({ pattern: p, index: i - p.length + 1 });
        counts[pi]++;
        if (ctx.record) for (let k = i - p.length + 1; k <= i; k++) found[k] = "found";
      }
      const s = state;
      const outs = out[state].map((pi) => patterns[pi]);
      ctx.step(() => ({
        phase: "3. Search",
        description: outs.length ? `Read '${c}' → state #${s}. Report: ${outs.map((p) => `"${p}"@${i - p.length + 1}`).join(", ")}.` : `Read '${c}' → state #${s}.`,
        line: outs.length ? 9 : 8,
        tree: { visible: N, active: [s], showFail: true },
        strings: [{ label: "Text", chars: text, highlights: { ...found, [i]: outs.length ? "found" : "active" }, pointer: i }],
        vars: { i, char: c, state: s, matches: matches.length },
      }));
    }
    return {
      output: { totalMatches: matches.length, matches: matches.slice(0, 1000), perPattern: patterns.map((p, i) => ({ pattern: p, count: counts[i] })), states: N },
      summary: `Automaton with ${N} states. Found ${matches.length} occurrence(s) across ${patterns.length} pattern(s).`,
      memoryBytes: N * 80,
      tree: ctx.record ? t.nodes : undefined,
    };
  },
};
