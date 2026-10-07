import { ValidationError } from "@/lib/algorithms/types";

export function jsonError(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export class NotFoundError extends Error {
  status = 404;
}

/** Wraps a route handler: converts validation / not-found / unexpected errors into friendly JSON. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError) return jsonError(e.message, 400);
    if (e instanceof NotFoundError) return jsonError(e.message, 404);
    if (e instanceof RangeError) return jsonError("The input is too large to process (out of memory or stack). Try a smaller input.", 413);
    console.error(e);
    return jsonError("An unexpected server error occurred while processing the request.", 500);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}

export function parseId(raw: string, label = "id"): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Invalid ${label}.`);
  return n;
}
