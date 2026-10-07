import { executeAlgorithm } from "@/lib/algorithms/engine";
import { handle, readJson } from "@/lib/api";
import { sanitizeInput } from "@/lib/utils/validators";
import { ValidationError } from "@/lib/algorithms/types";

export const dynamic = "force-dynamic";

/** Runs an algorithm with step recording enabled for the reusable visualizer. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    if (typeof body.algorithmId !== "string") throw new ValidationError("algorithmId is required.");
    const result = executeAlgorithm(body.algorithmId, sanitizeInput(body.input), { record: true, maxSteps: 3000 });
    return Response.json({ result });
  });
}
