# Advanced Algorithm Laboratory for Large-Scale Text Analytics

An interactive laboratory where you can study, run, visualize, benchmark, compare and experiment with text-analytics algorithms. All performance numbers come from real server-side executions. Theoretical complexity is always shown separately from measured results.

## Stack (as implemented in this sandbox)

The requested stack was React/Vite + FastAPI. This sandbox provides **Next.js (App Router) + PostgreSQL (Drizzle ORM)**, so the same layered architecture is built there:

| Target (FastAPI / React)             | Implementation                                                        |
| ------------------------------------ | --------------------------------------------------------------------- |
| `backend/app/algorithms/*`           | `src/lib/algorithms/{string-matching,multi-pattern,text-structures,text-analytics}` |
| common execution engine              | `src/lib/algorithms/engine.ts` + `types.ts` (`ExecutionResult`)       |
| algorithm registry                   | `src/lib/algorithms/registry.ts` (add one line to plug in a new algorithm) |
| `routers/*`                          | `src/app/api/**/route.ts`                                             |
| `services/*`                         | `src/lib/services/*` (benchmark, workloads, recommendation, experiment, dataset, challenges) |
| `repositories/*`                     | `src/lib/repositories/*` (Drizzle / PostgreSQL)                       |
| `schemas/*` (Pydantic)               | `src/lib/utils/validators.ts` + typed request parsing                 |
| `utils/preprocessing.py`             | `src/lib/utils/preprocessing.ts`                                      |
| `frontend/src/components/*`          | `src/components/*` (Visualizer, CodeViewer, charts, lab, ui, benchmark/*) |
| `frontend/src/pages/*`               | `src/app/*/page.tsx`                                                  |
| `tests/*`                            | `tests/*.test.ts` (Node test runner through `tsx`)                    |

## Execution architecture

```
Algorithm (AlgorithmDefinition: meta + validate + run)
   ↓
Execution Engine (timing, counters, heap delta, lazy step recording)
   ↓
ExecutionResult { output, matches, steps, metrics, complexity, visualization }
```

Steps are built lazily (`ctx.step(() => …)`), so benchmarks pay nothing for visualization. There is one reusable `Visualizer` that renders any step. A step can contain strings with highlights and pointers, arrays (such as LPS), tables (DP / suffix / index), trees (tries and automata with failure links), bars, variables and a pseudocode line.

## Algorithms (12)

- **String matching:** Naive, KMP, Rabin–Karp, Boyer–Moore (bad-character + good-suffix)
- **Multi-pattern:** Aho–Corasick
- **Text structures:** Trie, Suffix Array (prefix doubling), Kasai LCP
- **Text analytics:** Edit Distance, TF-IDF, Inverted Index, Text Similarity (cosine / Jaccard / Dice / overlap; you can add more methods)

## API

`GET /api/algorithms`, `GET|POST /api/algorithms/{id}`, `POST /api/visualizer/run`,
`POST /api/benchmark/{run,compare,scaling,stress}`, `GET /api/benchmark`,
`GET|POST /api/datasets`, `POST /api/datasets/upload`, `POST /api/datasets/preprocess`,
`GET|PATCH|DELETE /api/datasets/{id}`, `POST /api/datasets/{id}/versions`,
`GET|POST /api/experiments`, `GET|PATCH|DELETE /api/experiments/{id}`,
`POST /api/experiments/{id}/rerun`, `POST /api/experiments/{id}/duplicate`,
`POST /api/recommendation`, `GET /api/learning/{id}`, `GET /api/challenges`,
`POST /api/challenges/{id}/submit`, `POST /api/reports/export`, `GET /api/stats`, `GET /api/research`, `GET /api/health`.

For PDF export, open `/reports/{experimentId}` and use the browser's **Print → Save as PDF**.

## Commands

```bash
npx drizzle-kit push                 # apply the schema
npm run build && npm run start       # production
npx tsx --test tests/*.test.ts       # backend tests (algorithms, benchmark, datasets, API)
B=http://localhost:3000 bash scripts/smoke.sh   # end-to-end API smoke test
```

## Persistence

Data is stored in these tables: `datasets`, `dataset_versions`, `experiments`, `experiment_runs`, `benchmark_runs` and `challenge_attempts`. Experiments pin the dataset version and the workload seed, so a re-run uses the same input.

## Future work

- Redis caching and background workers for long benchmarks (the service layer is synchronous and has a time budget)
- Authentication
- Docker
