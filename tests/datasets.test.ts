import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, csvToDocuments, parseCsv } from "@/lib/services/dataset-stats";
import { preprocess, tokenize } from "@/lib/utils/preprocessing";
import { validateContent } from "@/lib/services/dataset-service";

test("dataset statistics", () => {
  const s = computeStats("Hello world\nhello again\n\nworld");
  assert.equal(s.lines, 4);
  assert.equal(s.documents, 3);
  assert.equal(s.words, 5);
  assert.equal(s.vocabularySize, 3);
  assert.equal(s.topWords[0].count, 2);
});

test("CSV parsing with quotes and column auto-detection", () => {
  const rows = parseCsv('id,text\n1,"hello, world"\n2,"say ""hi"""\n');
  assert.deepEqual(rows[1], ["1", "hello, world"]);
  assert.deepEqual(rows[2], ["2", 'say "hi"']);
  const d = csvToDocuments('id,body\n1,first document here\n2,second one');
  assert.equal(d.column, "body");
  assert.equal(d.content, "first document here\nsecond one");
  assert.throws(() => csvToDocuments("only header"));
  assert.throws(() => csvToDocuments("a,b\n1,2", "missing"));
});

test("preprocessing pipeline records changes", () => {
  const r = preprocess("The  Cat!\n\nThe  Cat!\nA dog.", { lowercase: true, removePunctuation: true, normalizeWhitespace: true, removeEmptyLines: true, removeDuplicateLines: true });
  assert.equal(r.text, "the cat\na dog");
  assert.equal(r.steps.length, 5);
  assert.ok(r.after.chars < r.before.chars);
});

test("tokenizer and stop words", () => {
  assert.deepEqual(tokenize("The quick, brown fox!", { removeStopWords: true }), ["quick", "brown", "fox"]);
});

test("content validation rejects empty and binary", () => {
  assert.throws(() => validateContent("   "));
  assert.throws(() => validateContent("abc\u0000def"));
  assert.equal(validateContent("a\r\nb"), "a\nb");
});
