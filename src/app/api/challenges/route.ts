import { handle } from "@/lib/api";
import { CHALLENGES, publicChallenge } from "@/lib/services/challenges";
import { challengeRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const stats = await challengeRepository.stats();
    return Response.json({ challenges: CHALLENGES.map(publicChallenge), stats });
  });
}
