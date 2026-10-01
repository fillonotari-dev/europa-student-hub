import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { FIC_BASE, ficFetch, estraiDiagnosticaFic, type EsitoFic } from '../_shared/fic-client.ts'
import { rispostaClient4xx } from '../_shared/fic-collega.ts'
import { aggiungiGiorni, oggiRoma } from '../_shared/fic-fattura.ts'
import {
  STATI_SDI_DEFINITIVI, ammettiAnnullamenti, codiceErroreRpc, confrontaFattura, parametriDaRemoto,
  type FatturaRemota,
} from '../_shared/fic-riallinea.ts'

/**
 * fic-riallinea — rilegge da Fatture in Cloud le fatture create dal gestionale
 * e le riallinea con la RPC riallinea_fattura (service_role).
 *
 * SOLA LETTURA verso Fatture in Cloud: esclusivamente GET.
 *
 * Accesso: verify_jwt = true e solo admin (getClaims + has_role). Nessun job:
 * il giro parte all'apertura di Fatturazione e dal pulsante dell'Archivio.
 * Origine 'apertura': se un giro si è concluso negli ultimi 10 minuti non ne
 * parte un altro e si risponde con il riepilogo di quello. Origine 'pulsante'
 * (default): sempre un giro nuovo.
 *
 * Interruttore di sicurezza (un annullamento è irreversibile):
 *  - GET company/info all'inizio: se fallisce, nessuna fattura elaborata;
 *  - un 404 si ricontrolla con un secondo GET: solo il doppio 404 è "inesistente";
 *  - si raccolgono tutti gli esiti prima di scrivere; con più di 2 inesistenti
 *    nessun annullamento: tutti anomalia 'troppi_404'.
 *
 * fic_log (operazione 'riallinea'): esito, decisione, nomi dei campi, codici.
 * Mai dati personali.
 */

const OPERAZIONE = 'riallinea'
const GIORNI = 90
const MINUTI_GIRO_RECENTE = 10

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const numeroDi = (f: { numero: number | null; numerazione: string | null } | null) =>
  f && f.numero != null ? `${f.numero}${f.numerazione ?? ''}` : '—'
// deno-lint-ignore no-explicit-any
const studenteDi = (f: any) => {
  const s = f?.contratti?.studenti
  return s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '—'
}

/** Ricostruisce il riepilogo di un giro concluso da fic_log + fatture. */
// deno-lint-ignore no-explicit-any
async function riepilogoDaLog(admin: any, chiusura: { created_at: string; payload_ridotto: any }) {
  const giroId = chiusura.payload_ridotto?.giro_id
  const { data: righe } = await admin.from('fic_log').select('payload_ridotto')
    .eq('operazione', OPERAZIONE).eq('payload_ridotto->>giro_id', giroId)
  // deno-lint-ignore no-explicit-any
  const per = ((righe ?? []) as any[]).map((r) => r.payload_ridotto).filter((p) => p?.fattura_id)
  const ids = [...new Set(per.map((p) => p.fattura_id))]
  // deno-lint-ignore no-explicit-any
  const mappa = new Map<string, any>()
  if (ids.length) {
    const { data: ff } = await admin.from('fatture').select('id, numero, numerazione, contratti(studenti(nome, cognome))').in('id', ids)
    for (const f of ff ?? []) mappa.set(f.id, f)
  }
  const aggiornate = per.filter((p) => p.decisione === 'aggiornata').map((p) => ({
    fattura_id: p.fattura_id, numero: numeroDi(mappa.get(p.fattura_id)), campi: p.campi ?? [], importo_divergente: !!p.importo_divergente,
  }))
  const annullate = per.filter((p) => p.decisione === 'annullata').map((p) => ({
    fattura_id: p.fattura_id, numero: numeroDi(mappa.get(p.fattura_id)), studente: studenteDi(mappa.get(p.fattura_id)),
  }))
  const anomalie = per.filter((p) => p.decisione === 'anomalia').map((p) => ({
    fattura_id: p.fattura_id, numero: numeroDi(mappa.get(p.fattura_id)), studente: studenteDi(mappa.get(p.fattura_id)), codice: p.codice,
  }))
  // deno-lint-ignore no-unused-vars
  const { giro_id, origine, giro_concluso, ...riepilogo } = chiusura.payload_ridotto ?? {}
  return { ok: true, recente: true, concluso_il: chiusura.created_at, riepilogo, aggiornate, annullate, anomalie }
}

// deno-lint-ignore no-explicit-any
async function logFic(admin: any, entry: {
  endpoint: string; http_status: number | null; esito: 'ok' | 'errore' | 'anomalia'; messaggio: string
  payload_ridotto: Record<string, unknown> | null
}) {
  try {
    await admin.from('fic_log').insert({ operazione: OPERAZIONE, metodo: 'GET', ...entry })
  } catch (e) {
    console.error('fic-riallinea: scrittura fic_log fallita', e)
  }
}

const EP_DOC = '/c/{company_id}/issued_documents/{document_id}'

type Raccolto =
  | { tipo: 'trovato'; remoto: FatturaRemota; status: number }
  | { tipo: 'inesistente' }
  | { tipo: 'saltato'; r: EsitoFic }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { ok: false, message: 'Configurazione del server incompleta.' })

  // --- Accesso: solo admin ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json(401, { ok: false, message: 'Accesso non autenticato.' })
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  })
  const { data: claims, error: claimsErr } = await caller.auth.getClaims(authHeader.replace('Bearer ', ''))
  const userId = claims?.claims?.sub
  if (claimsErr || !userId) return json(401, { ok: false, message: 'Accesso non autenticato.' })
  const { data: isAdmin, error: roleErr } = await caller.rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (roleErr || !isAdmin) return json(403, { ok: false, message: 'Accesso riservato agli amministratori.' })

  // deno-lint-ignore no-explicit-any
  let corpo: any = null
  try { corpo = await req.json() } catch { /* corpo assente */ }
  const origine: 'apertura' | 'pulsante' = corpo?.origine === 'apertura' ? 'apertura' : 'pulsante'

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // --- Regola dei 10 minuti, solo per l'apertura della pagina ---
  if (origine === 'apertura') {
    const { data: ultimo } = await admin.from('fic_log').select('created_at, payload_ridotto')
      .eq('operazione', OPERAZIONE).eq('payload_ridotto->>giro_concluso', 'true')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < MINUTI_GIRO_RECENTE * 60_000) {
      return json(200, await riepilogoDaLog(admin, ultimo))
    }
  }

  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')
  if (!token || !companyId) return json(200, { ok: false, message: 'Le credenziali di Fatture in Cloud non sono configurate.' })

  const giroId = crypto.randomUUID()

  // --- 1. L'azienda risponde? ---
  const info = await ficFetch(`${FIC_BASE}/c/${companyId}/company/info`, { method: 'GET', token })
  if (!info.ok) {
    const msg = 'Fatture in Cloud non risponde: riallineamento non eseguito, nessuna fattura elaborata.'
    await logFic(admin, {
      endpoint: '/c/{company_id}/company/info', http_status: info.status, esito: 'errore', messaggio: msg,
      payload_ridotto: { giro_id: giroId, origine, ...info.quota, ...(rispostaClient4xx(info.status) ? estraiDiagnosticaFic(info.body) : {}) },
    })
    return json(200, { ok: false, message: msg })
  }

  // --- 2. Selezione ---
  const dal = aggiungiGiorni(oggiRoma(), -GIORNI)
  const definitivi = [...STATI_SDI_DEFINITIVI].join(',')
  const { data: fatture, error: selErr } = await admin.from('fatture')
    .select('id, fic_document_id, numero, numerazione, data, imponibile, iva, totale, ei_status, url_documento, contratti(studenti(nome, cognome))')
    .eq('stato', 'emessa')
    .not('fic_document_id', 'is', null)
    .gte('data', dal)
    .or(`ei_status.is.null,ei_status.not.in.(${definitivi}),riallineata_il.is.null`)
    .order('data', { ascending: true })
  if (selErr) return json(200, { ok: false, message: 'Lettura delle fatture non riuscita.' })

  // --- 3. Raccolta (solo GET, nessuna scrittura sulle fatture) ---
  const raccolti = new Map<string, Raccolto>()
  for (const f of fatture ?? []) {
    const url = `${FIC_BASE}/c/${companyId}/issued_documents/${f.fic_document_id}?fieldset=detailed`
    let r = await ficFetch(url, { method: 'GET', token })
    if (r.status === 404) r = await ficFetch(url, { method: 'GET', token })
    if (r.ok) {
      // deno-lint-ignore no-explicit-any
      let body: any = null
      try { body = JSON.parse(r.body) } catch { /* */ }
      if (body?.data) { raccolti.set(f.id, { tipo: 'trovato', remoto: parametriDaRemoto(body.data), status: r.status! }); continue }
    }
    if (r.status === 404) { raccolti.set(f.id, { tipo: 'inesistente' }); continue }
    raccolti.set(f.id, { tipo: 'saltato', r })
  }

  const nInesistenti = [...raccolti.values()].filter((x) => x.tipo === 'inesistente').length
  const annullamentiAmmessi = ammettiAnnullamenti(nInesistenti)

  // --- 4. Scrittura ---
  const aggiornate: { fattura_id: string; numero: string; campi: string[]; importo_divergente: boolean }[] = []
  const annullate: { fattura_id: string; numero: string; studente: string }[] = []
  const anomalie: { fattura_id: string; numero: string; studente: string; codice: string }[] = []
  let invariate = 0, saltate = 0

  for (const f of fatture ?? []) {
    const x = raccolti.get(f.id)!
    const numero = f.numero != null ? `${f.numero}${f.numerazione ?? ''}` : '—'
    // deno-lint-ignore no-explicit-any
    const s = (f as any).contratti?.studenti
    const studente = s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '—'
    const base = { giro_id: giroId, origine, fattura_id: f.id, fic_document_id: f.fic_document_id }

    if (x.tipo === 'saltato') {
      saltate++
      await logFic(admin, {
        endpoint: EP_DOC, http_status: x.r.status, esito: 'errore',
        messaggio: x.r.status === null ? 'Fatture in Cloud irraggiungibile: fattura saltata.' : `Errore ${x.r.status}: fattura saltata.`,
        payload_ridotto: { ...base, decisione: 'saltata', ...x.r.quota, ...(rispostaClient4xx(x.r.status) ? estraiDiagnosticaFic(x.r.body) : {}) },
      })
      continue
    }

    const remoto = x.tipo === 'trovato' ? x.remoto : null
    const { decisione, campi } = confrontaFattura(f, remoto)

    const anomalia = async (codice: string, status: number | null, messaggioRpc?: string) => {
      anomalie.push({ fattura_id: f.id, numero, studente, codice })
      await logFic(admin, { endpoint: EP_DOC, http_status: status, esito: 'anomalia', messaggio: `Anomalia: ${codice}.`, payload_ridotto: { ...base, decisione: 'anomalia', codice, ...(messaggioRpc ? { messaggio_rpc: messaggioRpc.slice(0, 300) } : {}) } })
    }

    if (x.tipo === 'inesistente' && !annullamentiAmmessi) { await anomalia('troppi_404', 404); continue }
    if (decisione === 'anomalia') { await anomalia('documento_trasmesso_scomparso', 404); continue }

    const p = remoto
      ? {
          p_fattura_id: f.id, p_esiste: true, p_numero: remoto.numero, p_numerazione: remoto.numerazione,
          p_data: remoto.data, p_imponibile: remoto.imponibile, p_iva: remoto.iva, p_totale: remoto.totale,
          p_ei_status: remoto.ei_status, p_url: remoto.url,
        }
      : {
          p_fattura_id: f.id, p_esiste: false, p_numero: null, p_numerazione: null, p_data: null,
          p_imponibile: null, p_iva: null, p_totale: null, p_ei_status: null, p_url: null,
        }
    const { data: esito, error } = await admin.rpc('riallinea_fattura', p)
    if (error) { await anomalia(codiceErroreRpc(error.message), remoto ? 200 : 404); continue }

    // deno-lint-ignore no-explicit-any
    const e = esito as any
    if (e?.esito === 'annullata') {
      annullate.push({ fattura_id: f.id, numero, studente })
    } else if (e?.esito === 'aggiornata') {
      aggiornate.push({ fattura_id: f.id, numero, campi: e.campi ?? campi, importo_divergente: !!e.importo_divergente })
    } else {
      invariate++
    }
    await logFic(admin, {
      endpoint: EP_DOC, http_status: remoto ? 200 : 404, esito: 'ok',
      messaggio: `Fattura ${e?.esito ?? 'invariata'}.`,
      payload_ridotto: { ...base, decisione: e?.esito ?? 'invariata', campi: e?.campi ?? [], importo_divergente: !!e?.importo_divergente },
    })
  }

  const riepilogo = {
    controllate: (fatture ?? []).length, aggiornate: aggiornate.length, annullate: annullate.length,
    anomalie: anomalie.length, invariate, saltate, annullamenti_bloccati: !annullamentiAmmessi,
  }
  await logFic(admin, {
    endpoint: '/c/{company_id}/issued_documents', http_status: null, esito: anomalie.length ? 'anomalia' : 'ok',
    messaggio: 'Giro di riallineamento concluso.', payload_ridotto: { giro_id: giroId, origine, giro_concluso: true, ...riepilogo },
  })

  return json(200, { ok: true, riepilogo, aggiornate, annullate, anomalie })
})
