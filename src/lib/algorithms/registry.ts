import { AlgorithmDefinition, AlgorithmMeta } from "./types";
import { naive } from "./string-matching/naive";
import { kmp } from "./string-matching/kmp";
import { rabinKarp } from "./string-matching/rabin-karp";
import { boyerMoore } from "./string-matching/boyer-moore";
import { ahoCorasick } from "./multi-pattern/aho-corasick";
import { trie } from "./text-structures/trie";
import { suffixArray } from "./text-structures/suffix-array";
import { kasai } from "./text-structures/kasai";
import { editDistance } from "./text-analytics/edit-distance";
import { tfidf } from "./text-analytics/tfidf";
import { invertedIndex } from "./text-analytics/inverted-index";
import { similarity } from "./text-analytics/similarity";
export { CATEGORIES } from "./categories";

/** To add an algorithm: implement AlgorithmDefinition in its category folder and append it here. */
export const ALGORITHMS: AlgorithmDefinition[] = [naive, kmp, rabinKarp, boyerMoore, ahoCorasick, trie, suffixArray, kasai, editDistance, tfidf, invertedIndex, similarity];

const byId = new Map(ALGORITHMS.map((a) => [a.meta.id, a]));

export function getAlgorithm(id: string): AlgorithmDefinition | undefined {
  return byId.get(id);
}

export function listMeta(): AlgorithmMeta[] {
  return ALGORITHMS.map((a) => a.meta);
}
