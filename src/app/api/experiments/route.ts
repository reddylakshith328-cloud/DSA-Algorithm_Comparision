import { handle, readJson } from "@/lib/api";
import { ValidationError } from "@/lib/algorithms/types";
import { experimentRepository } from "@/lib/repositories/experiment-repository";
import { createAndRun, parseConfig } from "@/lib/services/experiment-service";
import { clampInt } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const limit = clampInt(url.searchParams.get("limit"), 1, 200, 100);
    const offset = clampInt(url.searchParams.get("offset"), 0, 1e6, 0);
    return Response.json({ experiments: await experimentRepository.list(limit, offset), total: await experimentRepository.count() });
  });
}

/** Save (and by default execute) an experiment from a reproducible configuration. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 150) : "";
    if (!name) throw new ValidationError("Experiment name is required.");
    const cfg = parseConfig(b.config);
    const e = await createAndRun(name, typeof b.description === "string" ? b.description.slice(0, 2000) : "", cfg, b.run !== false);
    return Response.json({ experiment: await experimentRepository.get(e.id) }, { status: 201 });
  });
}
