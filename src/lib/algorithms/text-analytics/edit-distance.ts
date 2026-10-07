import { AlgorithmDefinition, Highlight, ValidationError } from "../types";

const MAX_CELLS = 4_000_000;

export function levenshtein(a: string, b: string): number {
  const m = b.length;
  let prev = new Int32Array(m + 1);
  let cur = new Int32Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

export const editDistance: AlgorithmDefinition = {
  meta: {
    id: "edit-distance",
    name: "Edit Distance (Levenshtein)",
    category: "text-analytics",
    description: "Dynamic programming computing the minimum number of insertions, deletions and substitutions to turn one string into another.",
    complexity: { best: "O(n·m)", average: "O(n·m)", worst: "O(n·m)", space: "O(n·m) with traceback, O(min(n,m)) distance only" },
    input: { fields: ["text", "textB"], requirements: "Source and target strings (either may be empty but not both).", output: "Distance, similarity ratio and an optimal alignment (edit script).", example: { text: "kitten", textB: "sitting" } },
    visualization: true,
    benchmark: true,
    pseudocode: [
      "D[i][0] ← i; D[0][j] ← j",
      "for i ← 1..n:",
      "  for j ← 1..m:",
      "    cost ← (A[i] = B[j]) ? 0 : 1",
      "    D[i][j] ← min(D[i−1][j] + 1,   ▷ delete",
      "                  D[i][j−1] + 1,   ▷ insert",
      "                  D[i−1][j−1] + cost) ▷ match/substitute",
      "trace back from D[n][m] to recover the edit script",
    ],
    learning: {
      what: "Levenshtein distance is the minimum number of single-character edits (insert, delete, substitute) between two strings.",
      why: "It quantifies how different two strings are — essential for spell-checking, fuzzy search and sequence alignment.",
      how: ["Build an (n+1)×(m+1) table where D[i][j] is the distance between prefixes A[0..i) and B[0..j).", "Initialise the first row/column with the cost of inserting/deleting everything.", "Each cell takes the minimum of delete, insert, or match/substitute from its neighbours.", "Trace back from the bottom-right cell to recover the operations."],
      example: "kitten → sitting: substitute k→s, substitute e→i, insert g. Distance = 3.",
      advantages: ["Exact optimal answer", "Easy to extend with weights (Damerau, Needleman–Wunsch)", "Produces an explainable alignment"],
      limitations: ["Quadratic time and (with traceback) space", "Impractical for very long documents without banding"],
      applications: ["Spell checkers", "Fuzzy record linkage", "DNA alignment", "Diff tools and OCR correction"],
    },
    model: "mn",
    maxBenchmarkSize: 5_000,
    vizLimits: { text: 12, pattern: 12 },
  },
  validate(input) {
    const a = input.text ?? "";
    const b = input.textB ?? "";
    if (!a && !b) throw new ValidationError("Provide at least one non-empty string (source or target).");
    if (a.length * Math.max(1, b.length) > 100_000_000) throw new ValidationError("Strings are too long for quadratic edit distance (n·m exceeds 100M cells).");
    return { text: a, textB: b };
  },
  inputSize(input) {
    return { n: input.text?.length ?? 0, m: input.textB?.length ?? 0, k: 1 };
  },
  run(input, ctx) {
    const a = input.text!;
    const b = input.textB!;
    const n = a.length;
    const m = b.length;
    const full = (n + 1) * (m + 1) <= MAX_CELLS;
    if (!full) {
      const d = levenshtein(a, b);
      ctx.counters.comparisons += n * m;
      ctx.counters.operations += n * m;
      return { output: { distance: d, similarity: 1 - d / Math.max(n, m, 1), alignment: null, note: "Traceback skipped for very large inputs (distance computed with O(m) memory)." }, summary: `Edit distance = ${d}.`, memoryBytes: (m + 1) * 8 };
    }
    const W = m + 1;
    const D = new Int32Array((n + 1) * W);
    for (let i = 0; i <= n; i++) D[i * W] = i;
    for (let j = 0; j <= m; j++) D[j] = j;
    const headers = ["", "ε", ...b.split("")];
    const tableRows = (ri: number, rj: number) =>
      Array.from({ length: n + 1 }, (_, i) => [i === 0 ? "ε" : a[i - 1], ...Array.from({ length: m + 1 }, (_, j) => (i < ri || (i === ri && j <= rj) || i === 0 || j === 0 ? D[i * W + j] : ""))]);
    ctx.step(() => ({ phase: "Initialise", description: "First row/column: distance from the empty prefix equals the prefix length.", line: 0, table: { title: "DP table D[i][j]", headers, rows: tableRows(0, m) } }));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        ctx.counters.comparisons++;
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const del = D[(i - 1) * W + j] + 1;
        const ins = D[i * W + j - 1] + 1;
        const sub = D[(i - 1) * W + j - 1] + cost;
        const v = Math.min(del, ins, sub);
        D[i * W + j] = v;
        ctx.counters.operations++;
        ctx.step(() => {
          const hc: Record<string, Highlight> = { [`${i},${j + 1}`]: "active", [`${i - 1},${j + 1}`]: "compare", [`${i},${j}`]: "compare", [`${i - 1},${j}`]: cost ? "compare" : "match" };
          return {
            phase: "Fill table",
            description: `A[${i - 1}]='${a[i - 1]}' vs B[${j - 1}]='${b[j - 1]}' (${cost ? "differ, cost 1" : "equal, cost 0"}). min(delete ${del}, insert ${ins}, ${cost ? "substitute" : "match"} ${sub}) = ${v}.`,
            line: 4,
            table: { title: "DP table D[i][j]", headers, rows: tableRows(i, j), highlightCells: hc },
            vars: { i, j, delete: del, insert: ins, diagonal: sub, "D[i][j]": v },
          };
        });
      }
    }
    // traceback
    const ops: { op: "match" | "substitute" | "insert" | "delete"; a: string; b: string }[] = [];
    const path: string[] = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      path.push(`${i},${j + 1}`);
      if (i > 0 && j > 0 && D[i * W + j] === D[(i - 1) * W + j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
        ops.push({ op: a[i - 1] === b[j - 1] ? "match" : "substitute", a: a[i - 1], b: b[j - 1] });
        i--;
        j--;
      } else if (i > 0 && D[i * W + j] === D[(i - 1) * W + j] + 1) {
        ops.push({ op: "delete", a: a[i - 1], b: "" });
        i--;
      } else {
        ops.push({ op: "insert", a: "", b: b[j - 1] });
        j--;
      }
    }
    path.push("0,1");
    ops.reverse();
    const d = D[n * W + m];
    ctx.step(() => ({
      phase: "Traceback",
      description: `Distance D[${n}][${m}] = ${d}. Highlighted path is one optimal edit script: ${ops.filter((o) => o.op !== "match").map((o) => (o.op === "substitute" ? `sub ${o.a}→${o.b}` : o.op === "insert" ? `ins ${o.b}` : `del ${o.a}`)).join(", ") || "no edits"}.`,
      line: 7,
      table: { title: "DP table D[i][j]", headers, rows: tableRows(n, m), highlightCells: Object.fromEntries(path.map((p) => [p, "found" as Highlight])) },
      vars: { distance: d },
    }));
    const edits = ops.filter((o) => o.op !== "match").length;
    return {
      output: { distance: d, similarity: 1 - d / Math.max(n, m, 1), edits, alignment: ops.length <= 2000 ? ops : ops.slice(0, 2000) },
      summary: `Edit distance between strings of length ${n} and ${m} is ${d} (similarity ${((1 - d / Math.max(n, m, 1)) * 100).toFixed(1)}%).`,
      memoryBytes: (n + 1) * (m + 1) * 4,
    };
  },
};
