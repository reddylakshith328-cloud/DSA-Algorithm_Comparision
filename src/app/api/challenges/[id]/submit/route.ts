import { handle, jsonError, readJson } from "@/lib/api";
import { CHALLENGES, normalize } from "@/lib/services/challenges";
import { challengeRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const c = CHALLENGES.find((x) => x.id === id);
    if (!c) return jsonError("Challenge not found.", 404);
    const b = await readJson(req);
    const answer = typeof b.answer === "string" ? b.answer : "";
    if (!answer.trim()) return jsonError("Please enter an answer before submitting.");
    const expected = normalize(c.expected());
    const correct = normalize(answer) === expected;
    await challengeRepository.record(id, answer, correct);
    return Response.json({ correct, expected: c.expected().split(",").join(", "), yourAnswer: answer, explanation: c.explanation() });
  });
}
