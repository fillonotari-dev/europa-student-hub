import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const DOC_KEY_RE = /^[a-z][a-z0-9_]{0,99}$/;
const STORAGE_PATH_RE = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z][a-z0-9_]{0,99}\/[A-Za-z0-9._-]{1,200}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "Si è verificato un errore. Riprova più tardi.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > max) return undefined;
  return t;
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
      return json({ error: "Token non valido" }, 400);
    }
    const hash = await sha256Hex(token);

    const { data: cand, error: candErr } = await supabase
      .from("candidature")
      .select("id, token_scade_il, completata_il, studente_id")
      .eq("completamento_token_hash", hash)
      .maybeSingle();
    if (candErr) throw candErr;
    if (!cand) return json({ error: "Link non valido" }, 404);
    if (cand.completata_il) return json({ error: "Candidatura già completata" }, 410);
    if (!cand.token_scade_il || new Date(cand.token_scade_il) < new Date()) {
      return json({ error: "Link scaduto" }, 410);
    }

    // Validate block 4
    const lingue_parlate = optStr(body.lingue_parlate, 300);
    const orari = optStr(body.orari, 30);
    const personalita = optStr(body.personalita, 30);
    const personalita_altro = optStr(body.personalita_altro, 200);
    const ordine_pulizia = optStr(body.ordine_pulizia, 30);
    const presentazione = optStr(body.presentazione, 2000);
    // Block 5
    const garante_nome = optStr(body.garante_nome, 200);
    const garante_relazione = optStr(body.garante_relazione, 100);
    const garante_telefono = optStr(body.garante_telefono, 30);
    const garante_email = optStr(body.garante_email, 255);
    if ([lingue_parlate, orari, personalita, personalita_altro, ordine_pulizia, presentazione,
         garante_nome, garante_relazione, garante_telefono, garante_email].includes(undefined as any)) {
      return json({ error: "Campo non valido" }, 400);
    }
    if (garante_email && !EMAIL_RE.test(garante_email)) {
      return json({ error: "Email garante non valida" }, 400);
    }
    const fumatore = typeof body.fumatore === "boolean" ? body.fumatore : null;

    // Required: garante_nome, garante_relazione, garante_telefono
    if (!garante_nome || !garante_relazione || !garante_telefono) {
      return json({ error: "Dati garante obbligatori mancanti" }, 400);
    }

    // Declarations
    const decl = body.dichiarazioni;
    if (!decl || typeof decl !== "object" || Array.isArray(decl)) {
      return json({ error: "Dichiarazioni mancanti" }, 400);
    }
    const requiredDecl = ["veridicita", "privacy", "info_struttura", "contatto"];
    for (const k of requiredDecl) {
      if (decl[k] !== true) return json({ error: "Devi accettare tutte le dichiarazioni" }, 400);
    }

    // Documents
    const docsIn: Array<{ tipo: string; nome_file: string; url: string }> = [];
    if (body.documenti !== undefined && body.documenti !== null) {
      if (!Array.isArray(body.documenti) || body.documenti.length > 20) {
        return json({ error: "Documenti non validi" }, 400);
      }
      for (const d of body.documenti) {
        if (!d || typeof d !== "object") return json({ error: "Documento non valido" }, 400);
        const tipo = typeof d.tipo === "string" ? d.tipo : "";
        const nome_file = typeof d.nome_file === "string" ? d.nome_file : "";
        const url = typeof d.url === "string" ? d.url : "";
        if (!DOC_KEY_RE.test(tipo)) return json({ error: "Tipo documento non valido" }, 400);
        if (!nome_file || nome_file.length > 200) return json({ error: "Nome file non valido" }, 400);
        if (!STORAGE_PATH_RE.test(url)) return json({ error: "Riferimento documento non valido" }, 400);
        docsIn.push({ tipo, nome_file, url });
      }
    }

    const dichiarazioniSafe = {
      veridicita: !!decl.veridicita,
      privacy: !!decl.privacy,
      info_struttura: !!decl.info_struttura,
      contatto: !!decl.contatto,
      firmate_il: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from("candidature")
      .update({
        versione_form: "completa",
        completata_il: new Date().toISOString(),
        completamento_token_hash: null,
        token_scade_il: null,
        lingue_parlate,
        orari,
        personalita,
        personalita_altro,
        ordine_pulizia,
        fumatore,
        presentazione,
        garante_nome,
        garante_relazione,
        garante_telefono,
        garante_email,
        dichiarazioni: dichiarazioniSafe,
      })
      .eq("id", cand.id);
    if (updErr) throw updErr;

    for (const doc of docsIn) {
      await supabase.from("documenti").insert({
        studente_id: cand.studente_id,
        candidatura_id: cand.id,
        tipo: doc.tipo,
        nome_file: doc.nome_file,
        url: doc.url,
        caricato_da: "studente",
      });
    }

    await supabase.from("log_stato_candidature").insert({
      candidatura_id: cand.id,
      stato_precedente: null,
      stato_nuovo: "completata_form",
      note: "Form completo inviato dallo studente",
    });

    return json({ success: true });
  } catch (e) {
    console.error("complete-candidatura error:", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});