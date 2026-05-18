import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANNO_ACC_RE = /^\d{4}\/\d{4}$/;
const DOC_KEY_RE = /^[a-z][a-z0-9_]{0,99}$/;
const STORAGE_PATH_RE = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z][a-z0-9_]{0,99}\/[A-Za-z0-9._-]{1,200}$/;

const GENERIC_ERROR = "Si è verificato un errore. Riprova più tardi.";

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}
function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return undefined; // signal invalid
  const t = v.trim();
  if (t.length > max) return undefined;
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any;
    try { body = await req.json(); } catch { return bad("Richiesta non valida"); }
    if (!body || typeof body !== "object") return bad("Richiesta non valida");

    const {
      nome, cognome, email, telefono, data_nascita, nazionalita, codice_fiscale,
      universita, dipartimento, corso_di_studi, anno_di_corso, matricola,
      struttura_preferita_id, tipo_camera_preferito, periodo_inizio, periodo_fine,
      anno_accademico, messaggio, documenti, risposte_custom
    } = body;

    // Required strings with length limits
    const vNome = str(nome, 100);
    const vCognome = str(cognome, 100);
    const vEmailRaw = str(email, 255);
    const vUniversita = str(universita, 200);
    const vCorso = str(corso_di_studi, 200);
    const vMatricola = str(matricola, 50);
    const vAnnoAcc = str(anno_accademico, 9);
    if (!vNome || !vCognome || !vEmailRaw || !vUniversita || !vCorso || !vMatricola || !vAnnoAcc) {
      return bad("Campi obbligatori mancanti o troppo lunghi");
    }
    const vEmail = vEmailRaw.toLowerCase();
    if (!EMAIL_RE.test(vEmail)) return bad("Email non valida");
    if (!ANNO_ACC_RE.test(vAnnoAcc)) return bad("Anno accademico non valido");

    // Optional fields
    const vTelefono = optStr(telefono, 30);
    const vNazionalita = optStr(nazionalita, 100);
    const vCodiceFiscale = optStr(codice_fiscale, 32);
    const vDipartimento = optStr(dipartimento, 200);
    const vAnnoCorso = optStr(anno_di_corso, 30);
    const vTipoCamera = optStr(tipo_camera_preferito, 50);
    const vMessaggio = optStr(messaggio, 2000);
    if ([vTelefono, vNazionalita, vCodiceFiscale, vDipartimento, vAnnoCorso, vTipoCamera, vMessaggio].includes(undefined as any)) {
      return bad("Campo opzionale non valido");
    }
    if (data_nascita !== undefined && data_nascita !== null && data_nascita !== "") {
      if (typeof data_nascita !== "string" || !DATE_RE.test(data_nascita)) return bad("Data di nascita non valida");
    }
    if (periodo_inizio !== undefined && periodo_inizio !== null && periodo_inizio !== "") {
      if (typeof periodo_inizio !== "string" || !DATE_RE.test(periodo_inizio)) return bad("Periodo inizio non valido");
    }
    if (periodo_fine !== undefined && periodo_fine !== null && periodo_fine !== "") {
      if (typeof periodo_fine !== "string" || !DATE_RE.test(periodo_fine)) return bad("Periodo fine non valido");
    }
    if (struttura_preferita_id) {
      if (typeof struttura_preferita_id !== "string" || !UUID_RE.test(struttura_preferita_id)) {
        return bad("Struttura non valida");
      }
    }

    // Validate documenti shape and path
    const docsIn: Array<{ tipo: string; nome_file: string; url: string }> = [];
    if (documenti !== undefined && documenti !== null) {
      if (!Array.isArray(documenti) || documenti.length > 20) return bad("Documenti non validi");
      for (const d of documenti) {
        if (!d || typeof d !== "object") return bad("Documento non valido");
        const tipo = typeof d.tipo === "string" ? d.tipo : "";
        const nome_file = typeof d.nome_file === "string" ? d.nome_file : "";
        const url = typeof d.url === "string" ? d.url : "";
        if (!DOC_KEY_RE.test(tipo)) return bad("Tipo documento non valido");
        if (!nome_file || nome_file.length > 200) return bad("Nome file non valido");
        if (!STORAGE_PATH_RE.test(url)) return bad("Riferimento documento non valido");
        docsIn.push({ tipo, nome_file, url });
      }
    }

    const corsoCompleto = vDipartimento ? `${vCorso} — ${vDipartimento}` : vCorso;

    // Validate custom required fields and documents
    const safeRisposte = (risposte_custom && typeof risposte_custom === "object" && !Array.isArray(risposte_custom))
      ? risposte_custom as Record<string, unknown>
      : {};

    // Enforce limits on risposte_custom to prevent DB bloat
    const RISPOSTE_KEYS_MAX = 50;
    const RISPOSTE_STR_MAX = 5000;
    const RISPOSTE_ARR_MAX = 50;
    const risposteKeys = Object.keys(safeRisposte);
    if (risposteKeys.length > RISPOSTE_KEYS_MAX) return bad("Troppi campi personalizzati");
    for (const k of risposteKeys) {
      if (!DOC_KEY_RE.test(k)) return bad("Chiave risposta non valida");
      const v = safeRisposte[k];
      if (v === null || v === undefined || typeof v === "boolean" || typeof v === "number") continue;
      if (typeof v === "string") {
        if (v.length > RISPOSTE_STR_MAX) return bad(`Risposta troppo lunga: ${k}`);
        continue;
      }
      if (Array.isArray(v)) {
        if (v.length > RISPOSTE_ARR_MAX) return bad(`Troppi valori per: ${k}`);
        for (const item of v) {
          if (item === null || typeof item === "boolean" || typeof item === "number") continue;
          if (typeof item !== "string" || item.length > RISPOSTE_STR_MAX) {
            return bad(`Valore non valido in: ${k}`);
          }
        }
        continue;
      }
      return bad(`Tipo risposta non supportato: ${k}`);
    }

    const { data: campiAttivi } = await supabase
      .from("form_campi_custom")
      .select("chiave, obbligatorio, tipo, label_it")
      .eq("attivo", true);

    for (const c of campiAttivi ?? []) {
      if (!c.obbligatorio) continue;
      const v = safeRisposte[c.chiave];
      const empty =
        v === undefined || v === null || v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        return new Response(JSON.stringify({ error: `Campo obbligatorio mancante: ${c.label_it}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: docsAttivi } = await supabase
      .from("form_documenti_custom")
      .select("chiave, obbligatorio, label_it")
      .eq("attivo", true);

    const docTipiCaricati = new Set(docsIn.map((d) => d.tipo));
    for (const d of docsAttivi ?? []) {
      if (!d.obbligatorio) continue;
      if (!docTipiCaricati.has(d.chiave)) {
        return new Response(JSON.stringify({ error: `Documento obbligatorio mancante: ${d.label_it}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if student exists by email
    const { data: existingStudent } = await supabase
      .from("studenti")
      .select("id")
      .eq("email", vEmail)
      .maybeSingle();

    let studenteId: string;

    if (existingStudent) {
      // Do NOT overwrite PII of an existing student from a public, unauthenticated form
      // (prevents takeover via known email). The new candidatura snapshot still captures
      // the submitted academic data below.
      studenteId = existingStudent.id;
      console.warn("submit-candidatura: existing student matched by email; PII not overwritten", { studenteId });
    } else {
      // Create new student
      const { data: newStudent, error: studentError } = await supabase
        .from("studenti")
        .insert({
          nome: vNome, cognome: vCognome, email: vEmail, telefono: vTelefono,
          data_nascita: data_nascita || null, nazionalita: vNazionalita,
          codice_fiscale: vCodiceFiscale, universita: vUniversita,
          corso_di_studi: corsoCompleto, anno_di_corso: vAnnoCorso, matricola: vMatricola,
        })
        .select("id")
        .single();

      if (studentError) throw studentError;
      studenteId = newStudent.id;
    }

    // Check for existing active candidatura for same anno_accademico
    const { data: existingCandidatura } = await supabase
      .from("candidature")
      .select("id")
      .eq("studente_id", studenteId)
      .eq("anno_accademico", vAnnoAcc)
      .not("stato", "in", '("sostituita","ritirata","rifiutata")')
      .maybeSingle();

    if (existingCandidatura) {
      // Mark old candidatura as "sostituita"
      await supabase.from("candidature").update({ stato: "sostituita" }).eq("id", existingCandidatura.id);
      await supabase.from("log_stato_candidature").insert({
        candidatura_id: existingCandidatura.id,
        stato_precedente: "ricevuta",
        stato_nuovo: "sostituita",
        note: "Sostituita da nuova candidatura",
      });
    }

    // Create new candidatura
    const { data: candidatura, error: candidaturaError } = await supabase
      .from("candidature")
      .insert({
        studente_id: studenteId,
        stato: "ricevuta",
        struttura_preferita_id: struttura_preferita_id || null,
        tipo_camera_preferito: vTipoCamera,
        periodo_inizio: periodo_inizio || null,
        periodo_fine: periodo_fine || null,
        anno_accademico: vAnnoAcc,
        messaggio: vMessaggio,
        universita_snapshot: vUniversita,
        corso_snapshot: corsoCompleto,
        anno_corso_snapshot: vAnnoCorso,
        matricola_snapshot: vMatricola,
        risposte_custom: safeRisposte,
      })
      .select("id")
      .single();

    if (candidaturaError) throw candidaturaError;

    // Log initial state
    await supabase.from("log_stato_candidature").insert({
      candidatura_id: candidatura.id,
      stato_nuovo: "ricevuta",
    });

    // Register documents if any (already validated)
    for (const doc of docsIn) {
      await supabase.from("documenti").insert({
        studente_id: studenteId,
        candidatura_id: candidatura.id,
        tipo: doc.tipo,
        nome_file: doc.nome_file,
        url: doc.url,
        caricato_da: "studente",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      candidatura_id: candidatura.id,
      studente_id: studenteId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
