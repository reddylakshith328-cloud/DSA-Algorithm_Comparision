import { executeDefinition } from "@/lib/algorithms/engine";
import { getAlgorithm } from "@/lib/algorithms/registry";
import { handle, jsonError, readJson } from "@/lib/api";
import { resolveInput } from "@/lib/services/experiment-service";
import { sanitizeInput } from "@/lib/utils/validators";
import type { PreprocessConfig } from "@/lib/utils/preprocessing";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const def = getAlgorithm(id);
  if (!def) return jsonError(`Algorithm "${id}" not found.`, 404);
  return Response.json({ algorithm: def.meta });
}

/** Execute an algorithm. Body: { input } | { datasetId, version?, params?, preprocessing? }, record?: boolean */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const def = getAlgorithm(id);
    if (!def) return jsonError(`Algorithm "${id}" not found.`, 404);
    const body = await readJson(req);
    const pre = (body.preprocessing as PreprocessConfig) ?? null;
    const { input, dataset } = body.datasetId
      ? await resolveInput({ kind: "dataset", datasetId: Number(body.datasetId), version: body.version ? Number(body.version) : undefined, params: sanitizeInput(body.params) }, pre)
      : await resolveInput({ kind: "inline", input: sanitizeInput(body.input ?? body) }, pre);
    const result = executeDefinition(def, input, { record: body.record === true });
    return Response.json({ result: { ...result, matches: result.matches?.slice(0, 1000) }, dataset: dataset ?? null });
  });
}
