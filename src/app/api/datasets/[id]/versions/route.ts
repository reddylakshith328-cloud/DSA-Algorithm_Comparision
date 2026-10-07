import { handle, jsonError, parseId, readJson } from "@/lib/api";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { validateContent } from "@/lib/services/dataset-service";
import { computeStats } from "@/lib/services/dataset-stats";
import { preprocess, PreprocessConfig } from "@/lib/utils/preprocessing";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Create a new version: either from preprocessing the current version or from replacement content. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "dataset id");
    const b = await readJson(req);
    const found = await datasetRepository.getVersion(id, b.baseVersion ? Number(b.baseVersion) : undefined);
    if (!found) return jsonError("Dataset not found.", 404);
    let content: string;
    let pre: unknown = null;
    let note = typeof b.note === "string" && b.note ? b.note.slice(0, 300) : "";
    if (b.config) {
      const r = preprocess(found.version.content, b.config as PreprocessConfig);
      content = validateContent(r.text);
      pre = { config: b.config, steps: r.steps, baseVersion: found.version.version };
      note = note || `Preprocessed from v${found.version.version}: ${r.steps.map((s) => s.name).join(", ") || "no changes"}`;
    } else {
      content = validateContent(b.content);
      note = note || "Content replaced";
    }
    const version = await datasetRepository.addVersion(id, { content, stats: computeStats(content), preprocessing: pre, note });
    return Response.json({ version }, { status: 201 });
  });
}
