import { db } from "@/db";
import { datasets, datasetVersions } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DatasetStats } from "@/lib/services/dataset-stats";

export type DatasetRow = typeof datasets.$inferSelect;
export type DatasetVersionRow = typeof datasetVersions.$inferSelect;

export const datasetRepository = {
  async list() {
    return db
      .select({
        id: datasets.id,
        name: datasets.name,
        description: datasets.description,
        source: datasets.source,
        currentVersion: datasets.currentVersion,
        createdAt: datasets.createdAt,
        updatedAt: datasets.updatedAt,
        stats: datasetVersions.stats,
      })
      .from(datasets)
      .leftJoin(datasetVersions, and(eq(datasetVersions.datasetId, datasets.id), eq(datasetVersions.version, datasets.currentVersion)))
      .orderBy(desc(datasets.updatedAt));
  },
  async get(id: number) {
    const [d] = await db.select().from(datasets).where(eq(datasets.id, id));
    return d ?? null;
  },
  async versions(id: number) {
    return db
      .select({ id: datasetVersions.id, version: datasetVersions.version, stats: datasetVersions.stats, preprocessing: datasetVersions.preprocessing, note: datasetVersions.note, createdAt: datasetVersions.createdAt })
      .from(datasetVersions)
      .where(eq(datasetVersions.datasetId, id))
      .orderBy(desc(datasetVersions.version));
  },
  async getVersion(id: number, version?: number) {
    const d = await this.get(id);
    if (!d) return null;
    const v = version ?? d.currentVersion;
    const [row] = await db.select().from(datasetVersions).where(and(eq(datasetVersions.datasetId, id), eq(datasetVersions.version, v)));
    return row ? { dataset: d, version: row } : null;
  },
  async create(data: { name: string; description: string; source: string; content: string; stats: DatasetStats; preprocessing?: unknown; note?: string }) {
    return db.transaction(async (tx) => {
      const [d] = await tx.insert(datasets).values({ name: data.name, description: data.description, source: data.source }).returning();
      await tx.insert(datasetVersions).values({ datasetId: d.id, version: 1, content: data.content, stats: data.stats, preprocessing: data.preprocessing ?? null, note: data.note ?? "Initial version" });
      return d;
    });
  },
  async addVersion(id: number, data: { content: string; stats: DatasetStats; preprocessing?: unknown; note: string }) {
    return db.transaction(async (tx) => {
      const [d] = await tx.select().from(datasets).where(eq(datasets.id, id));
      if (!d) return null;
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${datasetVersions.version}), 0)` }).from(datasetVersions).where(eq(datasetVersions.datasetId, id));
      const version = Number(max) + 1;
      await tx.insert(datasetVersions).values({ datasetId: id, version, content: data.content, stats: data.stats, preprocessing: data.preprocessing ?? null, note: data.note });
      await tx.update(datasets).set({ currentVersion: version, updatedAt: new Date() }).where(eq(datasets.id, id));
      return version;
    });
  },
  async update(id: number, data: { name?: string; description?: string; currentVersion?: number }) {
    const [d] = await db
      .update(datasets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(datasets.id, id))
      .returning();
    return d ?? null;
  },
  async remove(id: number) {
    const r = await db.delete(datasets).where(eq(datasets.id, id)).returning({ id: datasets.id });
    return r.length > 0;
  },
  async count() {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(datasets);
    return c;
  },
};
