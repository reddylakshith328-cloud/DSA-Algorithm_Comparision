import { AlgorithmDefinition, TreeNode, ValidationError } from "../types";
import { requirePatterns } from "@/lib/utils/validators";

export class TrieCore {
  children: Map<string, number>[] = [new Map()];
  terminal: boolean[] = [false];
  nodes: TreeNode[] = [{ id: 0, label: "root", parent: null, depth: 0 }];
  track: boolean;
  constructor(track = true) {
    this.track = track;
  }
  addNode(parent: number, ch: string): number {
    const id = this.children.length;
    this.children.push(new Map());
    this.terminal.push(false);
    this.children[parent].set(ch, id);
    if (this.track) this.nodes.push({ id, label: ch, parent, depth: this.nodes[parent].depth + 1 });
    return id;
  }
}

/** Iterative DFS with a shared character stack: O(total nodes) and no deep recursion or O(depth²) string building. */
function collect(t: TrieCore, start: number, prefix: string, out: string[], limit: number) {
  const chars: string[] = [];
  const stack: { node: number; depth: number; ch: string }[] = [{ node: start, depth: 0, ch: "" }];
  while (stack.length && out.length < limit) {
    const { node, depth, ch } = stack.pop()!;
    chars.length = depth;
    if (depth > 0) chars[depth - 1] = ch;
    if (t.terminal[node]) out.push(prefix + chars.join(""));
    const keys = Array.from(t.children[node].keys()).sort().reverse();
    for (const k of keys) stack.push({ node: t.children[node].get(k)!, depth: depth + 1, ch: k });
  }
}

export const trie: AlgorithmDefinition = {
  meta: {
    id: "trie",
    name: "Trie (Prefix Tree)",
    category: "text-structures",
    description: "Tree of characters where each root-to-node path spells a prefix; supports insertion, exact lookup and prefix search in O(length).",
    complexity: { best: "O(L) insert/search", average: "O(L)", worst: "O(L)", space: "O(total characters · σ)", notes: "L = key length. Build cost is the sum of all key lengths." },
    input: {
      fields: ["patterns", "query"],
      requirements: "One or more words to insert (one per line) and an optional prefix/word query.",
      output: "Node count, whether the query is a stored word, and all words with that prefix.",
      example: { patterns: ["tea", "ten", "to", "inn", "in", "tree"], query: "te" },
    },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "insert(word):",
      "  node ← root",
      "  for c in word:",
      "    if c ∉ node.children: create child",
      "    node ← node.children[c]",
      "  node.terminal ← true",
      "search(q):",
      "  node ← root; for c in q: if c ∉ node.children: return ∅; node ← child",
      "  return node.terminal, collect(node)",
    ],
    learning: {
      what: "A trie stores a set of strings by sharing common prefixes as paths in a tree.",
      why: "Lookups cost O(L) regardless of how many keys are stored, and prefix queries (autocomplete) are natural.",
      how: ["Start at the root.", "For each character follow the matching edge, creating a node if absent.", "Mark the final node as terminal (end of word).", "To search, follow edges; failure to find an edge means no key has that prefix."],
      example: "Inserting tea, ten, to shares the 't' node; 'te' has two children 'a' and 'n'.",
      advantages: ["Prefix search/autocomplete", "Lookup independent of number of keys", "Ordered traversal gives sorted keys"],
      limitations: ["High memory overhead per node", "Poor cache locality versus hash tables", "Needs compression (radix tree) for large vocabularies"],
      applications: ["Autocomplete", "Spell checking", "IP routing (binary tries)", "Aho–Corasick automaton base"],
    },
    model: "L",
    maxBenchmarkSize: 3_000_000,
    vizLimits: { text: 120, items: 12 },
  },
  validate(input) {
    const words = requirePatterns(input);
    const q = input.query ?? "";
    if (q.length > 1000) throw new ValidationError("Query is too long.");
    return { patterns: words, query: q };
  },
  inputSize(input) {
    const L = (input.patterns ?? []).reduce((s, w) => s + w.length, 0);
    return { n: L, m: input.query?.length ?? 0, k: input.patterns?.length ?? 0 };
  },
  run(input, ctx) {
    const words = input.patterns!;
    const query = input.query ?? "";
    const t = new TrieCore(ctx.record);
    for (const w of words) {
      let node = 0;
      const path = [0];
      for (let i = 0; i < w.length; i++) {
        const c = w[i];
        ctx.counters.comparisons++;
        let next = t.children[node].get(c);
        const created = next === undefined;
        if (next === undefined) next = t.addNode(node, c);
        ctx.counters.operations++;
        node = next;
        path.push(node);
        ctx.step(() => ({
          phase: `Insert "${w}"`,
          description: created ? `'${c}' not a child — create node #${next}.` : `'${c}' already exists — traverse shared prefix to node #${next}.`,
          line: created ? 3 : 4,
          tree: { visible: t.children.length, active: path.slice() },
          strings: [{ label: "Word", chars: w, highlights: Object.fromEntries(Array.from({ length: i + 1 }, (_, k) => [k, k === i ? (created ? "active" : "match") : "match"])) }],
          vars: { word: w, char: c, node: next!, nodes: t.children.length },
        }));
      }
      t.terminal[node] = true;
      if (ctx.record) {
        t.nodes[node].terminal = true;
        t.nodes[node].word = w;
      }
      ctx.step(() => ({ phase: `Insert "${w}"`, description: `Mark node #${node} as terminal (end of "${w}").`, line: 5, tree: { visible: t.children.length, active: path.slice() }, vars: { word: w, nodes: t.children.length } }));
    }
    // search
    let node = 0;
    const path = [0];
    let found = true;
    for (let i = 0; i < query.length; i++) {
      ctx.counters.comparisons++;
      const next = t.children[node].get(query[i]);
      const ok = next !== undefined;
      ctx.step(() => ({
        phase: `Search "${query}"`,
        description: ok ? `Follow edge '${query[i]}' to node #${next}.` : `No edge '${query[i]}' — no stored word has prefix "${query.slice(0, i + 1)}".`,
        line: 7,
        tree: { visible: t.children.length, active: ok ? [...path, next!] : path.slice() },
        strings: [{ label: "Query", chars: query, highlights: { ...Object.fromEntries(Array.from({ length: i }, (_, k) => [k, "match"])), [i]: ok ? "match" : "mismatch" } }],
        vars: { char: query[i], node: ok ? next! : "∅" },
      }));
      if (!ok) {
        found = false;
        break;
      }
      node = next!;
      path.push(node);
    }
    const completions: string[] = [];
    if (found) collect(t, node, query, completions, 200);
    const isWord = found && t.terminal[node];
    if (query)
      ctx.step(() => ({
        phase: "Result",
        description: found ? `Prefix found. "${query}" is ${isWord ? "" : "not "}a stored word. ${completions.length} word(s) share this prefix: ${completions.slice(0, 8).join(", ")}.` : `Prefix "${query}" not present.`,
        line: 8,
        tree: { visible: t.children.length, active: path.slice() },
        vars: { isWord: String(isWord), completions: completions.length },
      }));
    return {
      output: { nodeCount: t.children.length, wordsInserted: words.length, query, prefixFound: found, isWord, completions },
      summary: `Built a trie with ${t.children.length} nodes from ${words.length} words.${query ? ` Query "${query}": ${found ? `${completions.length} completion(s)${isWord ? ", exact word present" : ""}` : "prefix not found"}.` : ""}`,
      memoryBytes: t.children.length * 64,
      tree: ctx.record ? t.nodes : undefined,
    };
  },
};
