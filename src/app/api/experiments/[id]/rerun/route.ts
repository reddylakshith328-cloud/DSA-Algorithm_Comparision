import { handle, parseId } from "@/lib/api";
import { experimentRepository } from "@/lib/repositories/experiment-repository";
import { rerun } from "@/lib/services/experiment-service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Re-execute the stored configuration (pinned dataset version, seed, parameters) and append a new run. */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id, "experiment id");
    const run = await rerun(id);
    return Response.json({ run, experiment: await experimentRepository.get(id) });
  });
}
