import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Richiesta non valida" }, 400); }
    const token = body?.token;
    if (typeof token !== "string" || !TOKEN_RE.test(token)) {
      return json({ error: "Token non valido", valid: false }, 400);
    }
    const hash = await sha256Hex(token);

    const { data: cand, error } = await supabase
      .from("candidature")
      .select("id, token_scade_il, completata_il, studente_id, studenti(nome, cognome)")
      .eq("completamento_token_hash", hash)
      .maybeSingle();
    if (error) throw error;
    if (!cand) return json({ valid: false, reason: "not_found" }, 404);
    if (cand.completata_il) return json({ valid: false, reason: "already_completed" }, 410);
    if (!cand.token_scade_il || new Date(cand.token_scade_il) < new Date()) {
      return json({ valid: false, reason: "expired" }, 410);
    }

    const { data: docs } = await supabase
      .from("documenti")
      .select("tipo")
      .eq("candidatura_id", cand.id);
    const tipi = new Set((docs ?? []).map((d: any) => d.tipo));

    const stud = (cand as any).studenti;
    return json({
      valid: true,
      candidatura_id: cand.id,
      nome: stud?.nome ?? "",
      cognome: stud?.cognome ?? "",
      documenti_presenti: {
        documento_garante: tipi.has("documento_garante"),
        documento_aggiuntivo: tipi.has("documento_aggiuntivo"),
      },
    });
  } catch (e) {
    console.error("get-completion-form error:", e);
    return json({ error: "Si è verificato un errore. Riprova più tardi.", valid: false }, 500);
  }
});