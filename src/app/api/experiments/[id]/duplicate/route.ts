import { handle, jsonError, parseId } from "@/lib/api";
import { experimentRepository } from "@/lib/repositories/experiment-repository";
import { environment } from "@/lib/services/experiment-service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const e = await experimentRepository.get(parseId((await params).id, "experiment id"));
    if (!e) return jsonError("Experiment not found.", 404);
    const copy = await experimentRepository.create({ name: `${e.name} (copy)`, description: e.description, mode: e.mode, algorithms: e.algorithms, config: e.config, datasetId: e.datasetId, datasetVersion: e.datasetVersion, parentId: e.id, environment: environment() });
    return Response.json({ experiment: copy }, { status: 201 });
  });
}
