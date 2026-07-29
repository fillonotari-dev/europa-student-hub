import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enqueueTransactional, SITE_NAME } from "../_shared/enqueue-transactional.ts";
import { CandidaturaRicevutaEmail } from "../_shared/email-templates/candidatura-ricevuta.tsx";
import { CandidaturaNuovaAdminEmail } from "../_shared/email-templates/candidatura-nuova-admin.tsx";
import { getContatti } from "../_shared/contatti.ts";
import { DOCUMENTO_TIPI_SET, extractTipoFromPath } from "../_shared/documenti-tipi.ts";
import { moveDocumentToFinal } from "../_shared/move-documenti.ts";
import { validateCodiceFiscale } from "../_shared/codice-fiscale.ts";
import { SIGLE_PROVINCE_SET } from "../_shared/province.ts";
import { COUNTRY_CODE_SET } from "../_shared/countries.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANNO_ACC_RE = /^\d{4}\/\d{4}$/;
const STORAGE_PATH_RE = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z][a-z0-9_]{0,99}\/[A-Za-z0-9._-]{1,200}$/;

const GENERIC_ERROR = "Si è verificato un errore. Riprova più tardi.";

// Codice neutro restituito al client per ogni forma di duplicazione (email
// esistente, race 23505 su studenti, race 23505 su candidature). Nessun
// dettaglio: il client non deve poter distinguere il motivo esatto, altrimenti
// diventa un oracolo per capire se un'email è già registrata.
const REJECT_CODE = "invio_rifiutato";

function rejected() {
  return new Response(JSON.stringify({ ok: false, code: REJECT_CODE }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
      universita, dipartimento, corso_di_studi,
      struttura_preferita_id, tipo_camera_preferito, periodo_inizio, periodo_fine,
      messaggio, documenti,
      indirizzo_via, indirizzo_civico, indirizzo_cap, indirizzo_comune,
      indirizzo_provincia, indirizzo_nazione, cf_non_disponibile,
      documento_identita_n, tipo_studente, tipo_studente_altro,
      data_arrivo_prevista, come_conosciuto, come_conosciuto_altro, preferenze_note,
      dichiarazioni, lingua, temp_id,
    } = body;

    // Validate session
    if (typeof temp_id !== "string" || !UUID_RE.test(temp_id)) {
      return bad("Sessione non valida");
    }
    const { data: sessOk, error: sessErr } = await supabase
      .rpc("check_candidatura_sessione", { p_temp_id: temp_id });
    if (sessErr) throw sessErr;
    if (sessOk !== true) return bad("Sessione di invio non valida o scaduta");

    const vLingua: 'it' | 'en' = (lingua === 'en') ? 'en' : 'it';

    // Required strings with length limits
    const vNome = str(nome, 100);
    const vCognome = str(cognome, 100);
    const vEmailRaw = str(email, 255);
    const vUniversita = str(universita, 200);
    const vCorso = str(corso_di_studi, 200);
    if (!vNome || !vCognome || !vEmailRaw || !vUniversita || !vCorso) {
      return bad("Campi obbligatori mancanti o troppo lunghi");
    }
    const vEmail = vEmailRaw.toLowerCase();
    if (!EMAIL_RE.test(vEmail)) return bad("Email non valida");

    const vMatricola: string | null = null;
    const vAnnoCorso: string | null = null;

    // Optional fields
    const vTelefono = optStr(telefono, 30);
    const vNazionalita = optStr(nazionalita, 100);
    const vCodiceFiscale = optStr(codice_fiscale, 32);
    const vDipartimento = optStr(dipartimento, 200);
    const vTipoCamera = optStr(tipo_camera_preferito, 50);
    const vMessaggio = optStr(messaggio, 2000);
    if ([vTelefono, vNazionalita, vCodiceFiscale, vDipartimento, vTipoCamera, vMessaggio].includes(undefined as any)) {
      return bad("Campo opzionale non valido");
    }

    // Anagrafica residenza: obbligatoria (provincia solo se nazione = IT).
    // Nazione: ISO-3166 alpha-2. Default IT se assente.
    const vNazione = (typeof indirizzo_nazione === "string" && indirizzo_nazione.trim())
      ? indirizzo_nazione.trim().toUpperCase()
      : "IT";
    if (!COUNTRY_CODE_SET.has(vNazione)) return bad("Nazione non valida");

    const vVia = str(indirizzo_via, 200);
    const vCivico = str(indirizzo_civico, 20);
    const vComune = str(indirizzo_comune, 100);
    if (!vVia || !vCivico || !vComune) return bad("Indirizzo di residenza incompleto");

    const rawCap = typeof indirizzo_cap === "string" ? indirizzo_cap.trim() : "";
    if (!rawCap) return bad("CAP obbligatorio");
    if (vNazione === "IT") {
      if (!/^\d{5}$/.test(rawCap)) return bad("CAP italiano non valido");
    } else if (rawCap.length > 20) {
      return bad("CAP non valido");
    }
    const vCap = rawCap;

    let vProvincia: string | null = null;
    if (vNazione === "IT") {
      const rawProv = typeof indirizzo_provincia === "string" ? indirizzo_provincia.trim().toUpperCase() : "";
      if (!rawProv) return bad("Provincia obbligatoria per residenza in Italia");
      if (!SIGLE_PROVINCE_SET.has(rawProv)) return bad("Provincia non valida");
      vProvincia = rawProv;
    } else {
      const optProv = optStr(indirizzo_provincia, 100);
      if (optProv === undefined) return bad("Provincia non valida");
      vProvincia = optProv;
    }

    const vCfNonDisp = !!cf_non_disponibile;
    if (!vCfNonDisp) {
      const cfCheck = validateCodiceFiscale(vCodiceFiscale ?? "");
      if (!cfCheck.ok) return bad("Codice fiscale non valido");
    }

    const vDocIdN = optStr(documento_identita_n, 64);
    const vTipoStud = optStr(tipo_studente, 30);
    const vTipoStudAltro = optStr(tipo_studente_altro, 200);
    const vComeConosc = optStr(come_conosciuto, 30);
    const vComeConoscAltro = optStr(come_conosciuto_altro, 200);
    const vPrefNote = optStr(preferenze_note, 1000);
    if ([vDocIdN, vTipoStud, vTipoStudAltro, vComeConosc, vComeConoscAltro, vPrefNote].includes(undefined as any)) {
      return bad("Campo opzionale non valido");
    }

    // Limiti temporali (server-side).
    const TODAY = new Date();
    TODAY.setUTCHours(0, 0, 0, 0);
    const MAX_DATE = new Date(TODAY);
    MAX_DATE.setUTCFullYear(MAX_DATE.getUTCFullYear() + 2);

    if (data_arrivo_prevista !== undefined && data_arrivo_prevista !== null && data_arrivo_prevista !== "") {
      if (typeof data_arrivo_prevista !== "string" || !DATE_RE.test(data_arrivo_prevista)) return bad("Data arrivo non valida");
      const d = new Date(data_arrivo_prevista);
      if (isNaN(d.getTime()) || d < TODAY || d > MAX_DATE) return bad("Data arrivo fuori intervallo consentito");
    }

    // Declarations (block 7) — required on public form too
    if (!dichiarazioni || typeof dichiarazioni !== "object" || Array.isArray(dichiarazioni)) {
      return bad("Dichiarazioni mancanti");
    }
    const requiredDecl = ["veridicita", "privacy", "info_struttura", "contatto"];
    for (const k of requiredDecl) {
      if ((dichiarazioni as any)[k] !== true) return bad("Devi accettare tutte le dichiarazioni");
    }
    const dichiarazioniSafe = {
      veridicita: !!(dichiarazioni as any).veridicita,
      privacy: !!(dichiarazioni as any).privacy,
      info_struttura: !!(dichiarazioni as any).info_struttura,
      contatto: !!(dichiarazioni as any).contatto,
      firmate_il: new Date().toISOString(),
    };

    // Data di nascita: obbligatoria, ≥ 1900-01-01 e ≤ oggi - 16 anni.
    if (typeof data_nascita !== "string" || !DATE_RE.test(data_nascita)) return bad("Data di nascita non valida");
    const dobDate = new Date(data_nascita);
    if (isNaN(dobDate.getTime())) return bad("Data di nascita non valida");
    const MIN_DOB = new Date("1900-01-01T00:00:00Z");
    const MAX_DOB = new Date(TODAY);
    MAX_DOB.setUTCFullYear(MAX_DOB.getUTCFullYear() - 16);
    if (dobDate < MIN_DOB || dobDate > MAX_DOB) return bad("Data di nascita fuori intervallo consentito");

    // Periodo permanenza: entrambe obbligatorie, entro 2 anni, fine > inizio.
    if (typeof periodo_inizio !== "string" || !DATE_RE.test(periodo_inizio)) return bad("Periodo inizio non valido");
    if (typeof periodo_fine !== "string" || !DATE_RE.test(periodo_fine)) return bad("Periodo fine non valido");
    const dInizio = new Date(periodo_inizio);
    const dFine = new Date(periodo_fine);
    if (isNaN(dInizio.getTime()) || isNaN(dFine.getTime())) return bad("Periodo non valido");
    if (dInizio < TODAY || dInizio > MAX_DATE) return bad("Data di inizio fuori intervallo consentito");
    if (dFine < TODAY || dFine > MAX_DATE) return bad("Data di fine fuori intervallo consentito");
    if (dFine <= dInizio) return bad("La data di fine deve essere successiva alla data di inizio");

    // Struttura preferita: opzionale ("Nessuna preferenza").
    let vStrutturaId: string | null = null;
    if (struttura_preferita_id !== undefined && struttura_preferita_id !== null && struttura_preferita_id !== "") {
      if (typeof struttura_preferita_id !== "string" || !UUID_RE.test(struttura_preferita_id)) {
        return bad("Struttura preferita non valida");
      }
      vStrutturaId = struttura_preferita_id;
    }

    // Anno accademico: derivato da periodo_inizio. Settembre incluso → anno corrente/prossimo.
    const _startYear = dInizio.getUTCMonth() >= 8 ? dInizio.getUTCFullYear() : dInizio.getUTCFullYear() - 1;
    const vAnnoAccComputed = `${_startYear}/${_startYear + 1}`;

    // Validate documenti shape and path
    const docsIn: Array<{ tipo: string; nome_file: string; url: string }> = [];
    if (documenti !== undefined && documenti !== null) {
      if (!Array.isArray(documenti) || documenti.length > 4) return bad("Documenti non validi");
      const expectedPrefix = `pending/${temp_id}/`;
      for (const d of documenti) {
        if (!d || typeof d !== "object") return bad("Documento non valido");
        const tipo = typeof d.tipo === "string" ? d.tipo : "";
        const nome_file = typeof d.nome_file === "string" ? d.nome_file : "";
        const url = typeof d.url === "string" ? d.url : "";
        if (!DOCUMENTO_TIPI_SET.has(tipo)) return bad("Tipo documento non valido");
        if (!nome_file || nome_file.length > 200) return bad("Nome file non valido");
        if (!STORAGE_PATH_RE.test(url)) return bad("Riferimento documento non valido");
        if (!url.startsWith(expectedPrefix)) return bad("Riferimento documento non corrispondente alla sessione");
        if (extractTipoFromPath(url) !== tipo) return bad("Riferimento documento non valido");
        docsIn.push({ tipo, nome_file, url });
      }
    }

    const corsoCompleto = vDipartimento ? `${vCorso} — ${vDipartimento}` : vCorso;

    // Check if student exists by email
    const { data: existingStudent } = await supabase
      .from("studenti")
      .select("id")
      .eq("email", vEmail)
      .maybeSingle();

    let studenteId: string;

    if (existingStudent) {
      // Un'email può avere una sola candidatura viva nel sistema. Rifiuto con
      // codice neutro e non creo nulla. Log server-side per diagnosi, mai
      // esposto al client.
      const emailHash = vEmail.slice(0, 3) + "***";
      console.warn("submit-candidatura: refused, existing student", { existing_id: existingStudent.id, email_hint: emailHash });
      return rejected();
    } else {
      // Create new student
      const { data: newStudent, error: studentError } = await supabase
        .from("studenti")
        .insert({
          nome: vNome, cognome: vCognome, email: vEmail, telefono: vTelefono,
          data_nascita: data_nascita || null, nazionalita: vNazionalita,
          codice_fiscale: vCfNonDisp ? null : vCodiceFiscale,
          cf_non_disponibile: vCfNonDisp,
          indirizzo_via: vVia, indirizzo_civico: vCivico, indirizzo_cap: vCap,
          indirizzo_comune: vComune, indirizzo_provincia: vProvincia,
          indirizzo_nazione: vNazione,
          universita: vUniversita,
          corso_di_studi: corsoCompleto, anno_di_corso: vAnnoCorso, matricola: vMatricola,
        })
        .select("id")
        .single();

      if (studentError) {
        if ((studentError as any).code === "23505") {
          console.warn("submit-candidatura: refused, studenti 23505");
          return rejected();
        }
        throw studentError;
      }
      studenteId = newStudent.id;
    }

    // Create new candidatura
    const { data: candidatura, error: candidaturaError } = await supabase
      .from("candidature")
      .insert({
        studente_id: studenteId,
        stato: "da_valutare",
        struttura_preferita_id: vStrutturaId,
        tipo_camera_preferito: vTipoCamera,
        periodo_inizio: periodo_inizio,
        periodo_fine: periodo_fine,
        anno_accademico: vAnnoAccComputed,
        messaggio: vMessaggio,
        universita_snapshot: vUniversita,
        corso_snapshot: corsoCompleto,
        anno_corso_snapshot: vAnnoCorso,
        matricola_snapshot: vMatricola,
        versione_form: "pre_screening",
        documento_identita_n: vDocIdN,
        tipo_studente: vTipoStud,
        tipo_studente_altro: vTipoStudAltro,
        data_arrivo_prevista: data_arrivo_prevista || null,
        come_conosciuto: vComeConosc,
        come_conosciuto_altro: vComeConoscAltro,
        preferenze_note: vPrefNote,
        dichiarazioni: dichiarazioniSafe,
        lingua: vLingua,
      })
      .select("id")
      .single();

    if (candidaturaError) throw candidaturaError;

    // Log initial state
    await supabase.from("log_stato_candidature").insert({
      candidatura_id: candidatura.id,
      stato_nuovo: "da_valutare",
    });

    // Register documents if any (already validated)
    for (const doc of docsIn) {
      const moved = await moveDocumentToFinal(supabase, {
        tempPath: doc.url,
        candidaturaId: candidatura.id,
        tipo: doc.tipo,
      });
      await supabase.from("documenti").insert({
        studente_id: studenteId,
        candidatura_id: candidatura.id,
        tipo: doc.tipo,
        nome_file: doc.nome_file,
        url: moved.path,
        caricato_da: "studente",
      });
    }

    // Consume session on success
    await supabase.rpc("consume_candidatura_sessione", { p_temp_id: temp_id });

    // Fire-and-log conferma ricezione email. Never rollback the application on email failure.
    try {
      const contatti = await getContatti(supabase);
      const subject = vLingua === 'en'
        ? `We received your application - ${SITE_NAME}`
        : `Abbiamo ricevuto la tua candidatura - ${SITE_NAME}`;
      const res = await enqueueTransactional({
        component: CandidaturaRicevutaEmail,
        props: { lang: vLingua, nome: vNome, siteName: SITE_NAME, contatti },
        subject,
        to: vEmail,
        label: 'candidatura-ricevuta',
      });
      if (!res.ok) console.error('submit-candidatura: enqueue conferma failed', res.error);

      // Notifica interna alla Direzione. Non blocca il flusso in caso di errore.
      try {
        const resAdmin = await enqueueTransactional({
          component: CandidaturaNuovaAdminEmail,
          props: {
            nome: vNome,
            cognome: vCognome,
            studenteId,
          },
          subject: `Nuova candidatura — ${vNome} ${vCognome}`,
          to: contatti.notifica_email,
          label: 'candidatura-nuova-admin',
        });
        if (!resAdmin.ok) console.error('submit-candidatura: enqueue notifica admin failed', resAdmin.error);
      } catch (e) {
        console.error('submit-candidatura: enqueue notifica admin exception', e);
      }
    } catch (e) {
      console.error('submit-candidatura: enqueue conferma exception', e);
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
