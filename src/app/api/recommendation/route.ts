import { handle, readJson } from "@/lib/api";
import { parseProfile, recommend } from "@/lib/services/recommendation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => Response.json(recommend(parseProfile(await readJson(req)))));
}
