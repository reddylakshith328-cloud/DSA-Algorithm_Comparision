import { handle, readJson } from "@/lib/api";
import { ValidationError } from "@/lib/algorithms/types";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { preprocess, PreprocessConfig } from "@/lib/utils/preprocessing";
import { computeStats } from "@/lib/services/dataset-stats";

export const dynamic = "force-dynamic";
const PREVIEW = 3000;

/** Preview a preprocessing pipeline: BEFORE → steps → AFTER, without persisting. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    let text = typeof b.text === "string" ? b.text : "";
    if (b.datasetId) {
      const found = await datasetRepository.getVersion(Number(b.datasetId), b.version ? Number(b.version) : undefined);
      if (!found) throw new ValidationError("Dataset not found.");
      text = found.version.content;
    }
    if (!text) throw new ValidationError("Nothing to preprocess: provide text or a dataset.");
    const r = preprocess(text, (b.config ?? {}) as PreprocessConfig);
    const sa = computeStats(text);
    const sb = computeStats(r.text);
    return Response.json({
      steps: r.steps,
      before: { ...r.before, vocabulary: sa.vocabularySize, preview: text.slice(0, PREVIEW) },
      after: { ...r.after, vocabulary: sb.vocabularySize, preview: r.text.slice(0, PREVIEW) },
      truncated: text.length > PREVIEW,
    });
  });
}
