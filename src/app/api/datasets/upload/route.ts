import { handle, jsonError } from "@/lib/api";
import { createDataset } from "@/lib/services/dataset-service";
import { csvToDocuments } from "@/lib/services/dataset-stats";
import { LIMITS } from "@/lib/utils/validators";

export const dynamic = "force-dynamic";

/** Multipart upload of .txt or .csv files. CSV: one document per row from the chosen (or longest) text column. */
export async function POST(req: Request) {
  return handle(async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError("Expected a multipart/form-data upload.");
    }
    const file = form.get("file");
    if (!file || typeof file === "string") return jsonError("No file was uploaded.");
    const name = file.name.toLowerCase();
    const ext = name.endsWith(".txt") ? "txt" : name.endsWith(".csv") ? "csv" : null;
    if (!ext) return jsonError("Unsupported file type. Please upload a .txt or .csv file.", 415);
    if (file.size === 0) return jsonError("The uploaded file is empty.");
    if (file.size > LIMITS.maxUploadBytes) return jsonError(`File is too large (${(file.size / 1e6).toFixed(1)} MB). Maximum is ${LIMITS.maxUploadBytes / 1e6} MB.`, 413);
    const raw = await file.text();
    const datasetName = (form.get("name") as string) || file.name.replace(/\.(txt|csv)$/i, "");
    if (ext === "csv") {
      const column = (form.get("column") as string) || undefined;
      const parsed = csvToDocuments(raw, column);
      const d = await createDataset({ name: datasetName, description: `CSV upload (${parsed.rows} rows). Text column: "${parsed.column}". Columns: ${parsed.columns.join(", ")}`, source: "csv", content: parsed.content, note: `Uploaded ${file.name}` });
      return Response.json({ dataset: d, csv: { column: parsed.column, columns: parsed.columns, rows: parsed.rows } }, { status: 201 });
    }
    const d = await createDataset({ name: datasetName, description: `Text upload (${file.name})`, source: "txt", content: raw, note: `Uploaded ${file.name}` });
    return Response.json({ dataset: d }, { status: 201 });
  });
}
