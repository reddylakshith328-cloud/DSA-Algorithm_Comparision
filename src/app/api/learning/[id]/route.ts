import { getAlgorithm } from "@/lib/algorithms/registry";
import { jsonError } from "@/lib/api";
import { CHALLENGES, publicChallenge } from "@/lib/services/challenges";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const def = getAlgorithm(id);
  if (!def) return jsonError(`No learning material for "${id}".`, 404);
  return Response.json({ algorithm: def.meta, challenges: CHALLENGES.filter((c) => c.algorithmId === id).map(publicChallenge) });
}
