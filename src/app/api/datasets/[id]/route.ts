import { handle, jsonError, parseId, readJson } from "@/lib/api";
import { datasetRepository } from "@/lib/repositories/dataset-repository";
import { validateName } from "@/lib/services/dataset-service";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Dataset detail with a paginated content preview (never ships the whole dataset to the UI). */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "dataset id");
    const url = new URL(req.url);
    const version = url.searchParams.get("version") ? Number(url.searchParams.get("version")) : undefined;
    const offset = clampInt(url.searchParams.get("offset"), 0, 1e9, 0);
    const limit = clampInt(url.searchParams.get("limit"), 100, 50_000, 5000);
    const found = await datasetRepository.getVersion(id, version);
    if (!found) return jsonError("Dataset not found.", 404);
    const content = found.version.content;
    return Response.json({
      dataset: found.dataset,
      version: { version: found.version.version, stats: found.version.stats, preprocessing: found.version.preprocessing, note: found.version.note, createdAt: found.version.createdAt },
      versions: await datasetRepository.versions(id),
      preview: { offset, limit, total: content.length, text: content.slice(offset, offset + limit), hasMore: offset + limit < content.length },
    });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "dataset id");
    const b = await readJson(req);
    const patch: { name?: string; description?: string; currentVersion?: number } = {};
    if (b.name !== undefined) patch.name = validateName(b.name);
    if (typeof b.description === "string") patch.description = b.description.slice(0, 1000);
    if (b.currentVersion !== undefined) {
      const v = Number(b.currentVersion);
      const exists = await datasetRepository.getVersion(id, v);
      if (!exists) return jsonError(`Version ${v} does not exist.`, 400);
      patch.currentVersion = v;
    }
    const d = await datasetRepository.update(id, patch);
    if (!d) return jsonError("Dataset not found.", 404);
    return Response.json({ dataset: d });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "dataset id");
    const ok = await datasetRepository.remove(id);
    if (!ok) return jsonError("Dataset not found.", 404);
    return Response.json({ ok: true });
  });
}
