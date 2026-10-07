// Common execution architecture shared by every algorithm in the laboratory.
// Algorithm -> Execution Engine -> ExecutionResult { output, steps, metrics, complexity, visualization }

export type Highlight = "match" | "mismatch" | "active" | "found" | "dim" | "window" | "compare";

export type CategoryId = "string-matching" | "multi-pattern" | "text-structures" | "text-analytics";

export interface VizString {
  label: string;
  chars: string;
  offset?: number; // horizontal shift (used for pattern sliding)
  highlights?: Record<number, Highlight>;
  pointer?: number; // index with a caret marker
}

export interface VizArray {
  label: string;
  values: (string | number)[];
  indexLabels?: (string | number)[];
  highlights?: Record<number, Highlight>;
}

export interface VizTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  highlightCells?: Record<string, Highlight>; // key "row,col"
  highlightRows?: Record<number, Highlight>;
}

export interface TreeNode {
  id: number;
  label: string; // edge character
  parent: number | null;
  depth: number;
  terminal?: boolean;
  word?: string;
  fail?: number | null;
  output?: string[];
}

export interface VizTreeState {
  visible: number; // nodes with id < visible are drawn
  active?: number[];
  showFail?: boolean;
  failEdge?: [number, number];
}

export interface Step {
  description: string;
  line?: number; // pseudocode line (0-based)
  phase?: string;
  strings?: VizString[];
  arrays?: VizArray[];
  table?: VizTable;
  tree?: VizTreeState;
  vars?: Record<string, string | number>;
  bars?: { label: string; value: number; highlight?: boolean }[];
}

export interface AlgorithmInput {
  text?: string;
  pattern?: string;
  patterns?: string[];
  documents?: string[];
  query?: string;
  textB?: string;
  method?: string;
  topK?: number;
}

export interface Complexity {
  best: string;
  average: string;
  worst: string;
  space: string;
  notes?: string;
}

export interface LearningContent {
  what: string;
  why: string;
  how: string[];
  example: string;
  advantages: string[];
  limitations: string[];
  applications: string[];
}

export interface InputSpec {
  fields: ("text" | "pattern" | "patterns" | "documents" | "query" | "textB" | "method")[];
  requirements: string;
  output: string;
  example: AlgorithmInput;
}

export interface AlgorithmMeta {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  complexity: Complexity;
  input: InputSpec;
  visualization: boolean;
  benchmark: boolean;
  pseudocode: string[];
  learning: LearningContent;
  /** Theoretical cost model used to overlay complexity curves on empirical data. */
  model: "n" | "n+m" | "nm" | "n/m" | "n+z" | "nlogn" | "nlog2n" | "L" | "mn" | "D";
  maxBenchmarkSize: number;
  vizLimits: { text: number; pattern?: number; items?: number };
}

export interface Counters {
  comparisons: number;
  operations: number;
}

export interface RunContext {
  record: boolean;
  maxSteps: number;
  counters: Counters;
  steps: Step[];
  truncated: boolean;
  /** Lazily build a step only if recording is enabled (keeps benchmarks honest). */
  step: (build: () => Step) => void;
}

export interface AlgorithmRunOutput {
  output: unknown;
  matches?: number[];
  summary: string;
  memoryBytes: number; // estimated auxiliary memory from data-structure sizes
  tree?: TreeNode[];
}

export interface AlgorithmDefinition {
  meta: AlgorithmMeta;
  validate: (input: AlgorithmInput) => AlgorithmInput;
  run: (input: AlgorithmInput, ctx: RunContext) => AlgorithmRunOutput;
  inputSize: (input: AlgorithmInput) => { n: number; m: number; k: number };
}

export interface Metrics {
  runtimeMs: number;
  comparisons: number;
  operations: number;
  throughputCharsPerSec: number;
  memoryBytes: number;
  heapDeltaBytes: number;
  inputSize: number;
  patternSize: number;
  itemCount: number;
}

export interface ExecutionResult {
  algorithmId: string;
  algorithm: string;
  category: CategoryId;
  input: { n: number; m: number; k: number; preview: string };
  output: unknown;
  matches?: number[];
  summary: string;
  metrics: Metrics;
  complexity: Complexity;
  steps: Step[];
  stepsTruncated: boolean;
  pseudocode: string[];
  visualization: { tree?: TreeNode[] };
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
