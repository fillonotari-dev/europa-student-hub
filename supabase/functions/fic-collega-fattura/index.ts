import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { FIC_BASE, ficFetch, estraiDiagnosticaFic, isQuotaError } from '../_shared/fic-client.ts'
import { importiDocumento, rispostaClient4xx, stessoId, stessoImporto } from '../_shared/fic-collega.ts'

/**
 * fic-collega-fattura — registra nel gestionale fatture GIÀ ESISTENTI su
 * Fatture in Cloud e le collega alla mensilità.
 *
 * SOLA LETTURA verso Fatture in Cloud: esegue esclusivamente chiamate GET.
 * Non crea, non modifica e non cancella alcun documento né cliente remoto.
 *
 * - verify_jwt = true in config.toml; qui si verifica inoltre il ruolo admin.
 * - modo 'elenca': fatture (type=invoice) del cliente del contratto, filtro
 *   q = "entity.id = {id}", esclusi gli id già in fatture.fic_document_id.
 * - modo 'collega': rilegge il documento, verifica tipo, cliente, stato del
 *   canone e importo lordo (amount_gross) prima di qualunque scrittura, poi
 *   chiama la RPC registra_fattura_esistente (una transazione) con il client
 *   dell'admin chiamante.
 * - Ogni chiamata esterna scrive in fic_log (operazione 'collega_fattura');
 *   il token e i dati personali non vi finiscono mai.
 */

const OPERAZIONE = 'collega_fattura'

const Body = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('elenca'), canone_id: z.string().uuid() }),
  z.object({ modo: z.literal('collega'), canone_id: z.string().uuid(), fic_document_id: z.number().int().positive() }),
])

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// deno-lint-ignore no-explicit-any
async function logFic(admin: any, entry: {
  endpoint: string; http_status: number | null; esito: 'ok' | 'errore'; messaggio: string
  payload_ridotto: Record<string, unknown> | null
}) {
  try {
    await admin.from('fic_log').insert({ operazione: OPERAZIONE, metodo: 'GET', ...entry })
  } catch (e) {
    console.error('fic-collega-fattura: scrittura fic_log fallita', e)
  }
}

function messaggioErrore(status: number | null, body: string): string {
  if (status === null) return 'Impossibile raggiungere i server di Fatture in Cloud.'
  if (status === 401) return 'Il token di accesso non è valido o è scaduto.'
  if (status === 403) return isQuotaError(status, body) ? 'Quota di chiamate esaurita: riprova più tardi.' : 'Il token non ha i permessi di lettura dei documenti.'
  if (status === 404) return 'Documento non trovato su Fatture in Cloud.'
  return `Fatture in Cloud ha risposto con errore ${status}.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { ok: false, message: 'Configurazione del server incompleta.' })

  // --- Ruolo admin ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json(403, { ok: false, message: 'Accesso riservato agli amministratori.' })
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  })
  const { data: claims } = await caller.auth.getClaims(authHeader.replace('Bearer ', ''))
  const userId = claims?.claims?.sub
  if (!userId) return json(403, { ok: false, message: 'Accesso riservato agli amministratori.' })
  const { data: isAdmin, error: roleErr } = await caller.rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (roleErr || !isAdmin) return json(403, { ok: false, message: 'Accesso riservato agli amministratori.' })

  let raw: unknown = {}
  try { raw = await req.json() } catch { /* corpo assente */ }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) return json(400, { ok: false, message: 'Richiesta non valida.', errori: parsed.error.flatten().fieldErrors })
  const input = parsed.data

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')
  if (!token || !companyId) return json(200, { ok: false, message: 'Le credenziali di Fatture in Cloud non sono configurate.' })

  // --- Canone -> contratto -> anagrafica ---
  const { data: canone } = await admin.from('canoni')
    .select('id, contratto_id, stato, totale').eq('id', input.canone_id).maybeSingle()
  if (!canone) return json(200, { ok: false, message: 'Mensilità non trovata.' })
  if (canone.stato !== 'da_fatturare') return json(200, { ok: false, message: `La mensilità è in stato ${canone.stato}: non può essere collegata.` })
  const { data: contratto } = await admin.from('contratti')
    .select('id, anagrafica_fatturazione_id').eq('id', canone.contratto_id).maybeSingle()
  const { data: ana } = contratto
    ? await admin.from('anagrafiche_fatturazione').select('id, fic_entity_id').eq('id', contratto.anagrafica_fatturazione_id).maybeSingle()
    : { data: null }
  if (!ana) return json(200, { ok: false, message: 'Intestazione di fatturazione non trovata.' })
  if (ana.fic_entity_id == null) return json(200, { ok: false, message: 'L\'intestazione non è collegata a Fatture in Cloud: sincronizzala prima.' })

  // ===================== elenca =====================
  if (input.modo === 'elenca') {
    const q = encodeURIComponent(`entity.id = ${Number(ana.fic_entity_id)}`)
    // deno-lint-ignore no-explicit-any
    const documenti: any[] = []
    for (let page = 1; page <= 10; page++) {
      const url = `${FIC_BASE}/c/${companyId}/issued_documents?type=invoice&fieldset=basic&per_page=100&page=${page}&sort=-date&q=${q}`
      const r = await ficFetch(url, { method: 'GET', token })
      if (!r.ok) {
        const msg = messaggioErrore(r.status, r.body)
        const ridotto: Record<string, unknown> = { canone_id: canone.id, page, ...r.quota }
        if (rispostaClient4xx(r.status)) Object.assign(ridotto, estraiDiagnosticaFic(r.body))
        await logFic(admin, { endpoint: '/c/{company_id}/issued_documents', http_status: r.status, esito: 'errore', messaggio: msg, payload_ridotto: ridotto })
        return json(200, { ok: false, message: msg })
      }
      // deno-lint-ignore no-explicit-any
      let body: any = null
      try { body = JSON.parse(r.body) } catch { /* */ }
      const dati = Array.isArray(body?.data) ? body.data : []
      await logFic(admin, {
        endpoint: '/c/{company_id}/issued_documents', http_status: r.status, esito: 'ok',
        messaggio: `Elenco fatture del cliente letto (pagina ${page}, ${dati.length} documenti).`,
        payload_ridotto: { canone_id: canone.id, fic_entity_id: ana.fic_entity_id, page, ...r.quota },
      })
      documenti.push(...dati)
      if (!body?.last_page || page >= Number(body.last_page)) break
    }

    const ids = documenti.map((d) => Number(d.id)).filter(Number.isFinite)
    const giaRegistrati = new Set<number>()
    if (ids.length) {
      const { data: reg } = await admin.from('fatture').select('fic_document_id').in('fic_document_id', ids)
      for (const f of reg ?? []) giaRegistrati.add(Number(f.fic_document_id))
    }
    const elenco = documenti
      .filter((d) => !giaRegistrati.has(Number(d.id)))
      .map((d) => ({
        id: Number(d.id), number: d.number ?? null, numeration: d.numeration ?? '',
        date: d.date ?? null, amount_gross: d.amount_gross != null ? Number(d.amount_gross) : null,
      }))
    return json(200, { ok: true, totale_canone: Number(canone.totale), documenti: elenco })
  }

  // ===================== collega =====================
  const url = `${FIC_BASE}/c/${companyId}/issued_documents/${input.fic_document_id}?fieldset=detailed`
  const r = await ficFetch(url, { method: 'GET', token })
  if (!r.ok) {
    const msg = messaggioErrore(r.status, r.body)
    await logFic(admin, {
      endpoint: '/c/{company_id}/issued_documents/{document_id}', http_status: r.status, esito: 'errore', messaggio: msg,
      payload_ridotto: {
        canone_id: canone.id, fic_document_id: input.fic_document_id, ...r.quota,
        ...(rispostaClient4xx(r.status) ? estraiDiagnosticaFic(r.body) : {}),
      },
    })
    return json(200, { ok: false, message: msg })
  }
  await logFic(admin, {
    endpoint: '/c/{company_id}/issued_documents/{document_id}', http_status: r.status, esito: 'ok',
    messaggio: 'Documento riletto per il collegamento.',
    payload_ridotto: { canone_id: canone.id, fic_document_id: input.fic_document_id, ...r.quota },
  })
  // deno-lint-ignore no-explicit-any
  let d: any = null
  try { d = JSON.parse(r.body)?.data } catch { /* */ }
  if (!d) return json(200, { ok: false, message: 'Risposta di Fatture in Cloud non leggibile.' })

  if (d.type !== 'invoice') return json(200, { ok: false, message: `Il documento è di tipo "${d.type}", non una fattura.` })
  if (!stessoId(d.entity?.id, ana.fic_entity_id)) return json(200, { ok: false, message: 'Il documento è intestato a un altro cliente.' })
  if (!stessoId(d.id, input.fic_document_id)) return json(200, { ok: false, message: 'Il documento riletto non corrisponde a quello scelto.' })
  const importi = importiDocumento(d)
  if (!importi) return json(200, { ok: false, message: 'Gli importi del documento non sono coerenti (netto + IVA ≠ lordo): collegamento non eseguito.' })
  if (!stessoImporto(importi.totale, canone.totale)) {
    return json(200, {
      ok: false, differenza_importo: true,
      importo_documento: importi.totale, importo_canone: Number(canone.totale),
      message: `Importo diverso: la fattura vale ${importi.totale.toFixed(2)} €, la mensilità ${Number(canone.totale).toFixed(2)} €. Nessun collegamento eseguito.`,
    })
  }

  const { data: fatturaId, error: rpcErr } = await caller.rpc('registra_fattura_esistente', {
    p_canone_id: canone.id,
    p_fic_document_id: Number(d.id),
    p_numero: typeof d.number === 'number' ? d.number : null,
    p_numerazione: typeof d.numeration === 'string' ? d.numeration : '',
    p_data: typeof d.date === 'string' ? d.date : null,
    p_ei_status: typeof d.ei_status === 'string' ? d.ei_status : null,
    p_imponibile: importi.imponibile,
    p_iva: importi.iva,
    p_totale: importi.totale,
  })
  if (rpcErr) {
    console.error('fic-collega-fattura: registra_fattura_esistente', rpcErr)
    return json(200, { ok: false, message: rpcErr.message || 'Registrazione non riuscita.' })
  }
  return json(200, {
    ok: true, fattura_id: fatturaId, fic_document_id: Number(d.id),
    message: `Fattura ${d.number ?? ''}${d.numeration ?? ''} collegata alla mensilità. Nulla è stato creato su Fatture in Cloud.`,
  })
})
