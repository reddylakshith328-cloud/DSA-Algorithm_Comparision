import { handle, jsonError, parseId, readJson } from "@/lib/api";
import { ValidationError } from "@/lib/algorithms/types";
import { experimentRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const e = await experimentRepository.get(parseId((await params).id, "experiment id"));
    if (!e) return jsonError("Experiment not found.", 404);
    return Response.json({ experiment: e });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "experiment id");
    const b = await readJson(req);
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 150) : "";
    if (!name) throw new ValidationError("Name is required.");
    const e = await experimentRepository.rename(id, name, typeof b.description === "string" ? b.description : undefined);
    if (!e) return jsonError("Experiment not found.", 404);
    return Response.json({ experiment: e });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const ok = await experimentRepository.remove(parseId((await params).id, "experiment id"));
    if (!ok) return jsonError("Experiment not found.", 404);
    return Response.json({ ok: true });
  });
}
