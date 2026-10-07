import { ValidationError } from "@/lib/algorithms/types";
import { STOP_WORDS } from "@/lib/utils/preprocessing";

export interface DatasetStats {
  characters: number;
  words: number;
  lines: number;
  documents: number;
  avgDocumentLength: number;
  vocabularySize: number;
  topWords: { word: string; count: number }[];
  topContentWords: { word: string; count: number }[];
  charFrequency: { char: string; count: number }[];
  bytes: number;
}

export function computeStats(content: string): DatasetStats {
  const lines = content.length ? content.split("\n") : [];
  const docs = lines.filter((l) => l.trim().length > 0);
  const wc = new Map<string, number>();
  let words = 0;
  const re = /[a-z0-9\u00C0-\u024F']+/gi;
  let mt: RegExpExecArray | null;
  const lower = content.toLowerCase();
  while ((mt = re.exec(lower))) {
    words++;
    wc.set(mt[0], (wc.get(mt[0]) ?? 0) + 1);
  }
  const cc = new Map<string, number>();
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    cc.set(c, (cc.get(c) ?? 0) + 1);
  }
  const sortedWords = Array.from(wc.entries()).sort((a, b) => b[1] - a[1]);
  return {
    characters: content.length,
    words,
    lines: lines.length,
    documents: docs.length,
    avgDocumentLength: docs.length ? Math.round((docs.reduce((s, d) => s + d.length, 0) / docs.length) * 10) / 10 : 0,
    vocabularySize: wc.size,
    topWords: sortedWords.slice(0, 25).map(([word, count]) => ({ word, count })),
    topContentWords: sortedWords.filter(([w]) => !STOP_WORDS.has(w)).slice(0, 25).map(([word, count]) => ({ word, count })),
    charFrequency: Array.from(cc.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([c, count]) => ({ char: c === " " ? "␣" : c === "\n" ? "↵" : c === "\t" ? "⇥" : c, count })),
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

/** Minimal RFC-4180-style CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(src: string, maxRows = 200_000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length >= maxRows) break;
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim().length));
}

export function csvToDocuments(src: string, column?: string): { content: string; column: string; columns: string[]; rows: number } {
  const rows = parseCsv(src);
  if (rows.length < 2) throw new ValidationError("CSV must contain a header row and at least one data row.");
  const header = rows[0].map((h) => h.trim());
  const data = rows.slice(1);
  let idx = column ? header.indexOf(column) : -1;
  if (column && idx === -1) throw new ValidationError(`Column "${column}" not found. Available: ${header.join(", ")}.`);
  if (idx === -1) {
    // choose the column with the longest average text
    let best = 0;
    header.forEach((_, ci) => {
      const avg = data.reduce((s, r) => s + (r[ci]?.length ?? 0), 0) / data.length;
      if (avg > best) {
        best = avg;
        idx = ci;
      }
    });
  }
  const docs = data.map((r) => (r[idx] ?? "").replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (!docs.length) throw new ValidationError("Selected CSV column contains no text.");
  return { content: docs.join("\n"), column: header[idx], columns: header, rows: data.length };
}
