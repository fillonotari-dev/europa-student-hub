import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const FIXED_TIPI = new Set(["documento_identita", "certificato_iscrizione"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z][a-z0-9_]{0,99}$/;

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
    if (!tipo || !KEY_RE.test(tipo)) {
      return jsonResponse({ error: "Invalid tipo" }, 400);
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return jsonResponse({ error: "File troppo grande (max 10 MB)" }, 400);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return jsonResponse({ error: "Tipo file non supportato (PDF, JPG, PNG, WEBP)" }, 400);
    }

    // Validate tipo: fixed or active custom doc
    if (!FIXED_TIPI.has(tipo)) {
      const { data: doc, error: docErr } = await supabase
        .from("form_documenti_custom")
        .select("chiave")
        .eq("chiave", tipo)
        .eq("attivo", true)
        .maybeSingle();
      if (docErr) throw docErr;
      if (!doc) return jsonResponse({ error: "Tipo documento non riconosciuto" }, 400);
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