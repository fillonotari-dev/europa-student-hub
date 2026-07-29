import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enqueueTransactional, SITE_NAME } from "../_shared/enqueue-transactional.ts";
import { CandidaturaEsitoApprovataEmail } from "../_shared/email-templates/candidatura-esito-approvata.tsx";
import { CandidaturaEsitoRifiutataEmail } from "../_shared/email-templates/candidatura-esito-rifiutata.tsx";
import { getContatti } from "../_shared/contatti.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Si è verificato un errore. Riprova più tardi.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin check (same pattern as generate-completion-link)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "Non autorizzato" }, 401);
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

    let nota: string | null = null;
    if (body?.nota !== undefined && body?.nota !== null && body?.nota !== "") {
      if (typeof body.nota !== "string" || body.nota.length > 2000) {
        return json({ error: "Nota non valida" }, 400);
      }
      nota = body.nota.trim() || null;
    }

    const { data: cand, error: candErr } = await admin
      .from("candidature")
      .select("id, stato, lingua, esito_email_inviata_il, studenti(nome, email)")
      .eq("id", candidaturaId)
      .maybeSingle();
    if (candErr) throw candErr;
    if (!cand) return json({ error: "Candidatura non trovata" }, 404);
    if (!(cand.stato === "accolta" || cand.stato === "rifiutata")) {
      return json({ error: "La candidatura non è in stato accolta o rifiutata" }, 400);
    }
    if ((cand as any).esito_email_inviata_il) {
      return json({ error: "Comunicazione esito già inviata o non richiesta" }, 400);
    }

    const recipient: string | undefined = (cand as any).studenti?.email;
    const nomeStudente: string | undefined = (cand as any).studenti?.nome;
    if (!recipient) return json({ error: "Email studente mancante" }, 400);

    const lang: "it" | "en" = (cand as any).lingua === "en" ? "en" : "it";
    const accolta = cand.stato === "accolta";
    const Component = accolta ? CandidaturaEsitoApprovataEmail : CandidaturaEsitoRifiutataEmail;
    const subject = accolta
      ? (lang === "en" ? `Your application has been approved - ${SITE_NAME}` : `Candidatura approvata - ${SITE_NAME}`)
      : (lang === "en" ? `Update about your application - ${SITE_NAME}` : `Esito della candidatura - ${SITE_NAME}`);

    const contatti = await getContatti(admin);
    const res = await enqueueTransactional({
      component: Component,
      props: { lang, nome: nomeStudente, siteName: SITE_NAME, contatti },
      subject,
      to: recipient,
      label: accolta ? "candidatura-esito-approvata" : "candidatura-esito-rifiutata",
    });
    if (!res.ok) {
      console.error("send-esito-email: enqueue failed", res.error);
      return json({ error: GENERIC_ERROR }, 500);
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin
      .from("candidature")
      .update({
        esito_email_nota: nota,
        esito_email_inviata_il: nowIso,
      })
      .eq("id", candidaturaId);
    if (updErr) throw updErr;

    const notaShort = nota ? ` — Nota: ${nota.slice(0, 200)}` : "";
    await admin.from("log_stato_candidature").insert({
      candidatura_id: candidaturaId,
      stato_precedente: cand.stato,
      stato_nuovo: cand.stato,
      cambiato_da: userData.user.id,
      note: `Comunicazione esito inviata${notaShort}`,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("send-esito-email error:", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});