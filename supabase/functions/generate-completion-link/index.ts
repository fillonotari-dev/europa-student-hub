import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL_DAYS = 21;
const GENERIC_ERROR = "Si è verificato un errore. Riprova più tardi.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Non autorizzato" }, 401);
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Non autorizzato" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Permessi insufficienti" }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Richiesta non valida" }, 400); }
    const candidaturaId = body?.candidatura_id;
    if (typeof candidaturaId !== "string" || !UUID_RE.test(candidaturaId)) {
      return json({ error: "ID candidatura non valido" }, 400);
    }

    const { data: existing, error: candErr } = await admin
      .from("candidature")
      .select("id, stato, versione_form, completata_il")
      .eq("id", candidaturaId)
      .maybeSingle();
    if (candErr) throw candErr;
    if (!existing) return json({ error: "Candidatura non trovata" }, 404);
    if (existing.versione_form === "completa" && existing.completata_il) {
      return json({ error: "Candidatura già completata" }, 400);
    }

    const token = generateToken();
    const hash = await sha256Hex(token);
    const scadenza = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await admin
      .from("candidature")
      .update({
        completamento_token_hash: hash,
        token_scade_il: scadenza,
      })
      .eq("id", candidaturaId);
    if (updErr) throw updErr;

    await admin.from("log_stato_candidature").insert({
      candidatura_id: candidaturaId,
      stato_precedente: existing.stato,
      stato_nuovo: existing.stato,
      cambiato_da: userData.user.id,
      note: "Generato link form completo",
    });

    return json({ token, scade_il: scadenza });
  } catch (e) {
    console.error("generate-completion-link error:", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});