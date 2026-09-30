import { createFileRoute } from "@tanstack/react-router";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 60_000;

async function requireUser(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const { getLocalUserSession } = await import("@/lib/local-auth.server");
    return getLocalUserSession();
  }

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase server environment is not configured");

  const { createClient } = await import("@supabase/supabase-js");
  const { data, error } = await createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.getUser(token);
  return error ? null : data.user;
}

async function extractFile(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error("The résumé must be smaller than 8 MB.");
  const bytes = await file.arrayBuffer();

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: 16_777_216 });
    if (pdf.numPages > 30) throw new Error("The résumé must be 30 pages or fewer.");
    const result = await extractText(pdf, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n") : result.text;
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: bytes });
    return result.value;
  }

  if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
    return new TextDecoder().decode(bytes);
  }

  throw new Error("Upload a PDF, DOCX, or plain-text résumé.");
}

export const Route = createFileRoute("/api/ai-structure")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const form = await request.formData();
          const file = form.get("file");
          const suppliedText = form.get("text");
          const source =
            file instanceof File && file.size > 0
              ? await extractFile(file)
              : typeof suppliedText === "string"
                ? suppliedText
                : "";
          const clean = source
            .split(String.fromCharCode(0))
            .join("")
            .trim()
            .slice(0, MAX_TEXT_LENGTH);
          if (clean.length < 40) {
            return Response.json(
              { error: "The résumé did not contain enough readable text." },
              { status: 400 },
            );
          }

          const { structureResumeWithAi } = await import("@/lib/ai-resume");
          return Response.json(await structureResumeWithAi(clean), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error(error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Résumé processing failed." },
            { status: 400 },
          );
        }
      },
    },
  },
});
