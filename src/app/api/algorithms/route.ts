import { listMeta, CATEGORIES } from "@/lib/algorithms/registry";

export async function GET() {
  const algorithms = listMeta().map((m) => ({ ...m, learning: undefined }));
  return Response.json({ algorithms, categories: CATEGORIES });
}
