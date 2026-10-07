import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  source: text("source").notNull(), // paste | txt | csv | synthetic | derived
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const datasetVersions = pgTable(
  "dataset_versions",
  {
    id: serial("id").primaryKey(),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    stats: jsonb("stats").notNull(),
    preprocessing: jsonb("preprocessing"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("dataset_version_unique").on(t.datasetId, t.version)],
);

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  mode: text("mode").notNull(), // run | compare | scaling | stress
  algorithms: jsonb("algorithms").notNull(), // string[]
  config: jsonb("config").notNull(), // full reproducible configuration
  datasetId: integer("dataset_id"),
  datasetVersion: integer("dataset_version"),
  parentId: integer("parent_id"),
  environment: jsonb("environment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentRuns = pgTable("experiment_runs", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  results: jsonb("results").notNull(),
  summary: jsonb("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const benchmarkRuns = pgTable("benchmark_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // compare | scaling | stress
  algorithms: jsonb("algorithms").notNull(),
  config: jsonb("config").notNull(),
  summary: jsonb("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challengeAttempts = pgTable("challenge_attempts", {
  id: serial("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  answer: text("answer").notNull(),
  correct: boolean("correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
