import { handle, readJson } from "@/lib/api";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { createDataset, syntheticContent } from "@/lib/services/dataset-service";
import type { PreprocessConfig } from "@/lib/utils/preprocessing";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => Response.json({ datasets: await datasetRepository.list() }));
}

/** Create from pasted text ({name, content}) or synthetic generator ({name, synthetic: {type, size, seed}}). */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const pre = (b.preprocessing as PreprocessConfig) ?? null;
    if (b.synthetic && typeof b.synthetic === "object") {
      const s = b.synthetic as Record<string, unknown>;
      const { content, note } = syntheticContent(s.type, s.size, s.seed);
      const d = await createDataset({ name: b.name, description: b.description ?? note, source: "synthetic", content, preprocessing: pre, note });
      return Response.json({ dataset: d }, { status: 201 });
    }
    const d = await createDataset({ name: b.name, description: b.description, source: "paste", content: b.content as string, preprocessing: pre });
    return Response.json({ dataset: d }, { status: 201 });
  });
}
