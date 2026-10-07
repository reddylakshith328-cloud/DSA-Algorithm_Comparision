import { handle } from "@/lib/api";
import { WORKLOAD_TYPES } from "@/lib/services/workloads";
import { benchmarkRepository } from "@/lib/repositories/experiment-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => Response.json({ workloads: WORKLOAD_TYPES, history: await benchmarkRepository.recent(30) }));
}
