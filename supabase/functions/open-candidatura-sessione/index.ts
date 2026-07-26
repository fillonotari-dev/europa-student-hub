import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const GENERIC_ERROR = "Impossibile aprire la sessione. Riprova.";

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

    const tempId = body?.temp_id;
    if (typeof tempId !== "string" || !UUID_RE.test(tempId)) {
      return json({ error: "Identificativo sessione non valido" }, 400);
    }

    const turnstileToken = typeof body?.turnstile_token === "string" ? body.turnstile_token : null;
    const completamentoToken = typeof body?.completamento_token === "string" ? body.completamento_token : null;

    if (!turnstileToken && !completamentoToken) {
      return json({ error: "Autorizzazione mancante" }, 400);
    }

    // Reject duplicate temp_id
    const { data: existing } = await supabase
      .from("candidatura_sessioni")
      .select("temp_id")
      .eq("temp_id", tempId)
      .maybeSingle();
    if (existing) {
      return json({ error: "Sessione già esistente" }, 400);
    }

    let origine: "pubblica" | "completamento";

    if (turnstileToken) {
      const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
      if (!secret) {
        console.error("open-candidatura-sessione: TURNSTILE_SECRET_KEY missing");
        return json({ error: GENERIC_ERROR }, 500);
      }
      const form = new FormData();
      form.append("secret", secret);
      form.append("response", turnstileToken);
      const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      const verify = await resp.json().catch(() => ({}));
      if (!verify || verify.success !== true) {
        return json({ error: "Verifica di sicurezza fallita" }, 400);
      }
      origine = "pubblica";
    } else {
      // completamento token flow
      if (!TOKEN_RE.test(completamentoToken!)) {
        return json({ error: "Token di completamento non valido" }, 400);
      }
      const hash = await sha256Hex(completamentoToken!);
      const { data: cand, error: candErr } = await supabase
        .from("candidature")
        .select("id, token_scade_il, completata_il")
        .eq("completamento_token_hash", hash)
        .maybeSingle();
      if (candErr) throw candErr;
      if (!cand) return json({ error: "Link non valido" }, 400);
      if (cand.completata_il) return json({ error: "Candidatura già completata" }, 400);
      if (!cand.token_scade_il || new Date(cand.token_scade_il) < new Date()) {
        return json({ error: "Link scaduto" }, 400);
      }
      origine = "completamento";
    }

    const { error: insErr } = await supabase
      .from("candidatura_sessioni")
      .insert({ temp_id: tempId, origine });
    if (insErr) throw insErr;

    return json({ ok: true });
  } catch (e) {
    console.error("open-candidatura-sessione error:", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});