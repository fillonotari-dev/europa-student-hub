import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { DOCUMENTO_TIPI_SET } from "../_shared/documenti-tipi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeFilename(name: string): string {
  // Keep extension, strip path separators and weird chars
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "file";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const form = await req.formData();
    const file = form.get("file");
    const tipo = String(form.get("tipo") ?? "");
    const tempId = String(form.get("temp_id") ?? "");

    if (!(file instanceof File)) {
      return jsonResponse({ error: "Missing file" }, 400);
    }
    if (!UUID_RE.test(tempId)) {
      return jsonResponse({ error: "Invalid temp_id" }, 400);
    }
    if (!tipo || !DOCUMENTO_TIPI_SET.has(tipo)) {
      return jsonResponse({ error: "Invalid tipo" }, 400);
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return jsonResponse({ error: "File troppo grande (max 5 MB)" }, 400);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return jsonResponse({ error: "Tipo file non supportato (PDF, JPG, PNG)" }, 400);
    }

    // Atomic session guard: single UPDATE that increments upload_count only if
    // session is valid (not consumed, within 30 min, under the cap of 12).
    const { data: slotOk, error: slotErr } = await supabase
      .rpc("consume_candidatura_upload_slot", { p_temp_id: tempId });
    if (slotErr) throw slotErr;
    if (slotOk !== true) {
      return jsonResponse({ error: "Sessione di invio non valida o scaduta" }, 400);
    }

    const filename = sanitizeFilename(file.name);
    const path = `pending/${tempId}/${tipo}/${filename}`;

    const { error: upErr } = await supabase
      .storage
      .from("documenti_studenti")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
    if (upErr) throw upErr;

    return jsonResponse({ path, nome_file: filename });
  } catch (error) {
    console.error("upload-candidatura-doc error:", error);
    return jsonResponse({ error: "Errore durante il caricamento. Riprova più tardi." }, 500);
  }
});