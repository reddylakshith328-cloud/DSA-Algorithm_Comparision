import { db } from "@/db";
import { benchmarkRuns, challengeAttempts, experimentRuns, experiments } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type ExperimentRow = typeof experiments.$inferSelect;
export type ExperimentRunRow = typeof experimentRuns.$inferSelect;

export const experimentRepository = {
  async list(limit = 100, offset = 0) {
    const rows = await db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(limit).offset(offset);
    const counts = await db.select({ experimentId: experimentRuns.experimentId, runs: sql<number>`count(*)::int`, last: sql<string>`max(${experimentRuns.createdAt})` }).from(experimentRuns).groupBy(experimentRuns.experimentId);
    const map = new Map(counts.map((c) => [c.experimentId, c]));
    return rows.map((r) => ({ ...r, runCount: map.get(r.id)?.runs ?? 0, lastRunAt: map.get(r.id)?.last ?? null }));
  },
  async get(id: number) {
    const [e] = await db.select().from(experiments).where(eq(experiments.id, id));
    if (!e) return null;
    const runs = await db.select().from(experimentRuns).where(eq(experimentRuns.experimentId, id)).orderBy(desc(experimentRuns.createdAt));
    return { ...e, runs };
  },
  async create(data: typeof experiments.$inferInsert) {
    const [e] = await db.insert(experiments).values(data).returning();
    return e;
  },
  async addRun(experimentId: number, results: unknown, summary: unknown) {
    const [r] = await db.insert(experimentRuns).values({ experimentId, results, summary }).returning();
    return r;
  },
  async remove(id: number) {
    const r = await db.delete(experiments).where(eq(experiments.id, id)).returning({ id: experiments.id });
    return r.length > 0;
  },
  async rename(id: number, name: string, description?: string) {
    const [e] = await db
      .update(experiments)
      .set(description !== undefined ? { name, description } : { name })
      .where(eq(experiments.id, id))
      .returning();
    return e ?? null;
  },
  async count() {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(experiments);
    return c;
  },
  async recentRuns(limit = 200) {
    return db
      .select({ id: experimentRuns.id, experimentId: experimentRuns.experimentId, summary: experimentRuns.summary, createdAt: experimentRuns.createdAt, name: experiments.name, mode: experiments.mode })
      .from(experimentRuns)
      .innerJoin(experiments, eq(experiments.id, experimentRuns.experimentId))
      .orderBy(desc(experimentRuns.createdAt))
      .limit(limit);
  },
};

export const benchmarkRepository = {
  async record(kind: string, algorithms: string[], config: unknown, summary: unknown) {
    try {
      await db.insert(benchmarkRuns).values({ kind, algorithms, config, summary });
    } catch {
      // Benchmark history is best-effort; never fail a measurement because logging failed.
    }
  },
  async recent(limit = 50) {
    return db.select().from(benchmarkRuns).orderBy(desc(benchmarkRuns.createdAt)).limit(limit);
  },
  async count() {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(benchmarkRuns);
    return c;
  },
};

export const challengeRepository = {
  async record(challengeId: string, answer: string, correct: boolean) {
    await db.insert(challengeAttempts).values({ challengeId, answer: answer.slice(0, 2000), correct });
  },
  async stats() {
    return db
      .select({ challengeId: challengeAttempts.challengeId, attempts: sql<number>`count(*)::int`, solved: sql<number>`sum(case when ${challengeAttempts.correct} then 1 else 0 end)::int` })
      .from(challengeAttempts)
      .groupBy(challengeAttempts.challengeId);
  },
  async recent(limit = 20) {
    return db.select().from(challengeAttempts).orderBy(desc(challengeAttempts.createdAt)).limit(limit);
  },
};
