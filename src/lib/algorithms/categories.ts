import type { CategoryId } from "./types";

export const CATEGORIES: { id: CategoryId; name: string; description: string }[] = [
  { id: "string-matching", name: "String Matching", description: "Find all occurrences of a single pattern in a text." },
  { id: "multi-pattern", name: "Multi-Pattern Matching", description: "Search for a dictionary of patterns in one pass." },
  { id: "text-structures", name: "Text Structures", description: "Index structures over strings: tries, suffix arrays, LCP." },
  { id: "text-analytics", name: "Text Analytics", description: "Distance, weighting, indexing and similarity of documents." },
];

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;
