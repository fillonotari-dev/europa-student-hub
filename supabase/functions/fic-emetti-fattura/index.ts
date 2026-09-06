import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { FIC_BASE, ficFetch, estraiDiagnosticaFic, isQuotaError } from '../_shared/fic-client.ts'
import { campiMancantiPerFattura, mappaAnagraficaPerFic } from '../_shared/fic-anagrafica.ts'
import {
  TIPO_DOCUMENTO,
  SCRITTURE_LOCALI_ATTIVE,
  costruisciPayloadFattura,
  descrizioneCanone,
  aggiungiGiorni,
} from '../_shared/fic-fattura.ts'

/**
 * fic-emetti-fattura — crea su Fatture in Cloud il documento di una mensilità.
 *
 * - verify_jwt = true in config.toml; qui si verifica inoltre il ruolo admin.
 * - Riceve { canone_ids, conferma }. Senza conferma NON esegue alcuna chiamata
 *   esterna e non scrive nulla: esegue le guardie, costruisce il payload e lo
 *   restituisce. È il primo tempo dell'anteprima, non una modalità esposta.
 * - I canoni si elaborano uno alla volta: un fallimento non ferma gli altri.
 * - Le scritture locali (fatture, canoni) avvengono SOLO con
 *   TIPO_DOCUMENTO === 'invoice'; con 'proforma' il documento viene creato su
 *   Fatture in Cloud e registrato in fic_log, ma il gestionale non lo registra
 *   e non tocca il canone. Ogni esito dichiara i passi saltati.
 * - Il gestionale NON trasmette allo SDI: resta un'azione manuale.
 * - Ogni chiamata scrive in public.fic_log; il token non vi finisce mai.
 */

const OPERAZIONE = 'emetti_fattura'

const Body = z.object({
  canone_ids: z.array(z.string().uuid()).min(1).max(50),
  conferma: z.boolean().default(false),
})

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// deno-lint-ignore no-explicit-any
async function logFic(admin: any, entry: {
  metodo: string
  endpoint: string
  http_status: number | null
  esito: 'ok' | 'errore'
  messaggio: string
  payload_ridotto: Record<string, unknown> | null
}) {
  try {
    await admin.from('fic_log').insert({ operazione: OPERAZIONE, ...entry })
  } catch (e) {
    console.error('fic-emetti-fattura: scrittura fic_log fallita', e)
  }
}

function messaggioErrore(status: number | null, body: string, contesto: string): string {
  if (status === 401) return 'Il token di accesso non è valido o è scaduto.'
  if (status === 403) {
    return isQuotaError(status, body)
      ? 'Quota di chiamate esaurita: riprova più tardi.'
      : `Il token non ha i permessi necessari per ${contesto}.`
  }
  if (status === 400 || status === 422) return `Fatture in Cloud ha rifiutato ${contesto}.`
  return `Fatture in Cloud ha risposto con errore ${status}.`
}

/** Solo i NOMI dei campi valorizzati: il payload contiene dati personali. */
const campiValorizzati = (o: Record<string, unknown>) =>
  Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k]) => k)

const arrotonda2 = (n: number) => Math.round(n * 100) / 100

/** Passi che il valore della costante fa saltare: dichiarati in ogni esito. */
const passiSaltati = (): string[] =>
  SCRITTURE_LOCALI_ATTIVE
    ? []
    : [
      `documento creato con tipo "${TIPO_DOCUMENTO}": nessuna riga registrata in fatture`,
      'il canone resta da_fatturare e non viene collegato ad alcuna fattura',
    ]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('fic-emetti-fattura: variabili ambiente mancanti')
    return jsonResponse(500, { ok: false, message: 'Configurazione del server incompleta.' })
  }

  // --- Ruolo admin ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse(403, { ok: false, message: 'Accesso riservato agli amministratori.' })
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: isAdmin, error: roleErr } = await caller.rpc('has_role', {
    _user_id: (await caller.auth.getUser()).data.user?.id,
    _role: 'admin',
  })
  if (roleErr || !isAdmin) return jsonResponse(403, { ok: false, message: 'Accesso riservato agli amministratori.' })

  // --- Input ---
  let raw: unknown = {}
  try { raw = await req.json() } catch { /* corpo assente */ }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return jsonResponse(400, { ok: false, message: 'Richiesta non valida.', errori: parsed.error.flatten().fieldErrors })
  }
  const { canone_ids, conferma } = parsed.data

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')

  const { data: imp } = await admin
    .from('impostazioni')
    .select('fic_numerazione, fic_giorni_scadenza, fic_metodo_pagamento_id, fic_vat_id, fic_vat_valore, fic_metodo_pagamento')
    .eq('id', 1)
    .maybeSingle()

  const oggi = new Date().toISOString().slice(0, 10)
  const esiti: Record<string, unknown>[] = []

  for (const canoneId of canone_ids) {
    const fallisci = (message: string, extra: Record<string, unknown> = {}) => {
      esiti.push({ canone_id: canoneId, ok: false, message, ...extra })
    }

    // --- (a) canone esistente e da_fatturare ---
    const { data: canone } = await admin
      .from('canoni')
      .select('id, contratto_id, competenza, imponibile, aliquota_iva, totale, stato')
      .eq('id', canoneId)
      .maybeSingle()
    if (!canone) { fallisci('Mensilità non trovata.', { guardia: 'canone' }); continue }
    if (canone.stato !== 'da_fatturare') {
      fallisci(`La mensilità è in stato ${canone.stato}: non può essere fatturata.`, { guardia: 'canone' })
      continue
    }

    // --- (b) contratto attivo ---
    const { data: contratto } = await admin
      .from('contratti')
      .select('id, stato, anagrafica_fatturazione_id')
      .eq('id', canone.contratto_id)
      .maybeSingle()
    if (!contratto) { fallisci('Contratto non trovato.', { guardia: 'contratto' }); continue }
    if (contratto.stato !== 'attivo') {
      fallisci(`Il contratto è in stato ${contratto.stato}: si fatturano solo i contratti attivi.`, { guardia: 'contratto' })
      continue
    }

    // --- (c) anagrafica collegata a Fatture in Cloud ---
    const { data: ana } = await admin
      .from('anagrafiche_fatturazione')
      .select('*')
      .eq('id', contratto.anagrafica_fatturazione_id)
      .maybeSingle()
    if (!ana) { fallisci('Intestazione di fatturazione non trovata.', { guardia: 'anagrafica' }); continue }
    if (ana.fic_entity_id == null) {
      fallisci('L\'intestazione non è ancora collegata a Fatture in Cloud: sincronizzala prima di emettere.', { guardia: 'fic_entity_id' })
      continue
    }

    // --- (d) dati sufficienti per la fattura ---
    const mancanti = campiMancantiPerFattura(ana)
    if (mancanti.length > 0) {
      fallisci(`Dati incompleti nell'intestazione: ${mancanti.join(', ')}.`, { guardia: 'campi_mancanti', campi_mancanti: mancanti })
      continue
    }

    // --- (e) impostazioni di emissione complete ---
    if (!imp || imp.fic_metodo_pagamento_id == null || imp.fic_vat_id == null) {
      fallisci('Metodo di pagamento o aliquota IVA non ancora scelti nelle impostazioni di fatturazione.', { guardia: 'impostazioni' })
      continue
    }

    // --- (f) aliquota del canone uguale a quella scelta ---
    if (Number(canone.aliquota_iva) !== Number(imp.fic_vat_valore)) {
      fallisci(
        `L'aliquota della mensilità (${canone.aliquota_iva}%) è diversa da quella scelta nelle impostazioni (${imp.fic_vat_valore}%): la fattura uscirebbe con un'aliquota diversa da quella pattuita.`,
        { guardia: 'aliquota' },
      )
      continue
    }

    const imponibile = Number(canone.imponibile)
    const totale = Number(canone.totale)
    const iva = arrotonda2(totale - imponibile)
    const numerazione = imp.fic_numerazione ?? ''
    const giorniScadenza = Number(imp.fic_giorni_scadenza ?? 30)

    const payload = costruisciPayloadFattura({
      ficEntityId: Number(ana.fic_entity_id),
      competenza: canone.competenza,
      imponibile,
      totale,
      dataEmissione: oggi,
      numerazione,
      giorniScadenza,
      metodoPagamentoId: Number(imp.fic_metodo_pagamento_id),
      vatId: Number(imp.fic_vat_id),
    })

    const anteprima = {
      intestatario: ana.tipo === 'soggetto_giuridico'
        ? (ana.denominazione ?? '')
        : `${ana.nome ?? ''} ${ana.cognome ?? ''}`.trim(),
      descrizione: descrizioneCanone(canone.competenza),
      imponibile,
      iva,
      totale,
      aliquota: Number(canone.aliquota_iva),
      data_emissione: oggi,
      scadenza: aggiungiGiorni(oggi, giorniScadenza),
      numerazione,
      metodo_pagamento_id: Number(imp.fic_metodo_pagamento_id),
      metodo_pagamento_nome: imp.fic_metodo_pagamento ?? '',
      vat_id: Number(imp.fic_vat_id),
      vat_valore: Number(imp.fic_vat_valore),
      tipo_documento: TIPO_DOCUMENTO,
    }

    // --- Primo tempo dell'anteprima: nessuna chiamata esterna, nessuna scrittura ---
    if (!conferma) {
      esiti.push({
        canone_id: canoneId, ok: true, anteprima: true,
        dati: anteprima, payload, passi_saltati: passiSaltati(),
      })
      continue
    }

    if (!token || !companyId) {
      await logFic(admin, {
        metodo: '-', endpoint: '-', http_status: null, esito: 'errore',
        messaggio: 'Credenziali Fatture in Cloud non configurate.',
        payload_ridotto: { canone_id: canoneId },
      })
      fallisci('Le credenziali di Fatture in Cloud non sono configurate.')
      continue
    }

    // --- Risincronizzazione dell'intestazione: il gestionale è la fonte di
    // verità, e una fattura sbagliata si corregge solo con nota di credito. ---
    const mappatura = mappaAnagraficaPerFic(ana)
    const urlCliente = `${FIC_BASE}/c/${companyId}/entities/clients/${ana.fic_entity_id}`
    const sync = await ficFetch(urlCliente, { method: 'PUT', token, body: { data: mappatura.data } })

    if (sync.rete) {
      await logFic(admin, {
        metodo: 'PUT', endpoint: '/c/{company_id}/entities/clients/{client_id}', http_status: null, esito: 'errore',
        messaggio: 'Impossibile raggiungere i server di Fatture in Cloud (risincronizzazione intestazione).',
        payload_ridotto: { canone_id: canoneId, anagrafica_id: ana.id },
      })
      fallisci('Impossibile raggiungere i server di Fatture in Cloud: nessun documento è stato creato.')
      continue
    }

    if (!sync.ok && sync.status === 404) {
      await admin.from('anagrafiche_fatturazione').update({ fic_entity_id: null }).eq('id', ana.id)
      await logFic(admin, {
        metodo: 'PUT', endpoint: '/c/{company_id}/entities/clients/{client_id}', http_status: 404, esito: 'errore',
        messaggio: 'Cliente inesistente su Fatture in Cloud: collegamento azzerato, emissione fermata.',
        payload_ridotto: { canone_id: canoneId, anagrafica_id: ana.id, fic_entity_id_precedente: ana.fic_entity_id, ...sync.quota },
      })
      fallisci('Il cliente non esiste più su Fatture in Cloud: il collegamento è stato azzerato. Risincronizza l\'intestazione e riprova.')
      continue
    }

    if (!sync.ok) {
      const msg = messaggioErrore(sync.status, sync.body, 'i dati dell\'intestazione')
      const ridotto: Record<string, unknown> = { canone_id: canoneId, anagrafica_id: ana.id, ...sync.quota }
      if (sync.status === 400 || sync.status === 422) {
        ridotto.campi_inviati = campiValorizzati(mappatura.data as unknown as Record<string, unknown>)
        Object.assign(ridotto, estraiDiagnosticaFic(sync.body))
      }
      await logFic(admin, {
        metodo: 'PUT', endpoint: '/c/{company_id}/entities/clients/{client_id}',
        http_status: sync.status, esito: 'errore', messaggio: msg, payload_ridotto: ridotto,
      })
      fallisci(`${msg} Nessun documento è stato creato.`)
      continue
    }

    await logFic(admin, {
      metodo: 'PUT', endpoint: '/c/{company_id}/entities/clients/{client_id}',
      http_status: sync.status, esito: 'ok',
      messaggio: 'Intestazione risincronizzata prima dell\'emissione.',
      payload_ridotto: { canone_id: canoneId, anagrafica_id: ana.id, ...sync.quota },
    })

    // --- Scrittura in due fasi: prima la riga in_invio, poi la chiamata. ---
    // Con TIPO_DOCUMENTO = 'proforma' la fase locale è deliberatamente saltata
    // (vedi _shared/fic-fattura.ts): il codice resta scritto per intero e verrà
    // eseguito la prima volta con la prima fattura vera.
    let fatturaId: string | null = null
    if (SCRITTURE_LOCALI_ATTIVE) {
      const { data: riga, error: insErr } = await admin
        .from('fatture')
        .insert({
          contratto_id: contratto.id,
          imponibile, iva, totale,
          numerazione,
          stato: 'in_invio',
        })
        .select('id')
        .single()
      if (insErr || !riga) {
        console.error('fic-emetti-fattura: insert fatture fallito', insErr)
        fallisci('Non è stato possibile registrare la fattura nel gestionale: nessun documento è stato creato.')
        continue
      }
      fatturaId = riga.id
    }

    const urlDoc = `${FIC_BASE}/c/${companyId}/issued_documents`
    const doc = await ficFetch(urlDoc, { method: 'POST', token, body: payload })

    // Rete o timeout: il documento POTREBBE esistere. La riga resta in_invio.
    if (doc.rete) {
      await logFic(admin, {
        metodo: 'POST', endpoint: '/c/{company_id}/issued_documents', http_status: null, esito: 'errore',
        messaggio: 'Impossibile raggiungere i server di Fatture in Cloud durante la creazione del documento.',
        payload_ridotto: { canone_id: canoneId, fattura_id: fatturaId, campi_inviati: campiValorizzati(payload.data) },
      })
      fallisci(
        SCRITTURE_LOCALI_ATTIVE
          ? 'Connessione persa durante la creazione: la fattura resta in stato "in invio" perché il documento potrebbe esistere su Fatture in Cloud. Verificare prima di riprovare.'
          : 'Connessione persa durante la creazione: il documento potrebbe esistere su Fatture in Cloud. Verificare prima di riprovare.',
        { passi_saltati: passiSaltati() },
      )
      continue
    }

    if (!doc.ok) {
      const definitivo = doc.status === 400 || doc.status === 422
      const msg = messaggioErrore(doc.status, doc.body, 'il documento')
      const ridotto: Record<string, unknown> = {
        canone_id: canoneId, fattura_id: fatturaId,
        campi_inviati: campiValorizzati(payload.data), ...doc.quota,
      }
      if (definitivo) Object.assign(ridotto, estraiDiagnosticaFic(doc.body))
      await logFic(admin, {
        metodo: 'POST', endpoint: '/c/{company_id}/issued_documents',
        http_status: doc.status, esito: 'errore', messaggio: msg, payload_ridotto: ridotto,
      })
      // Rifiuto definitivo: il documento sicuramente non esiste -> errore.
      // Altrimenti resta in_invio, perché potrebbe esistere.
      if (fatturaId && definitivo) {
        await admin.from('fatture').update({ stato: 'errore', messaggio_errore: msg }).eq('id', fatturaId)
      }
      fallisci(msg, { passi_saltati: passiSaltati() })
      continue
    }

    // deno-lint-ignore no-explicit-any
    let d: any = null
    try { d = JSON.parse(doc.body)?.data } catch { /* risposta non JSON */ }
    const docId = typeof d?.id === 'number' ? d.id : null

    await logFic(admin, {
      metodo: 'POST', endpoint: '/c/{company_id}/issued_documents',
      http_status: doc.status, esito: 'ok',
      messaggio: `Documento ${TIPO_DOCUMENTO} creato su Fatture in Cloud${docId != null ? ` (ID ${docId})` : ''}.`,
      payload_ridotto: {
        canone_id: canoneId, fattura_id: fatturaId, fic_document_id: docId,
        tipo_documento: TIPO_DOCUMENTO, scritture_locali: SCRITTURE_LOCALI_ATTIVE, ...doc.quota,
      },
    })

    if (!SCRITTURE_LOCALI_ATTIVE) {
      esiti.push({
        canone_id: canoneId, ok: true, fic_document_id: docId, tipo_documento: TIPO_DOCUMENTO,
        message: `Documento ${TIPO_DOCUMENTO} creato su Fatture in Cloud${docId != null ? ` (ID ${docId})` : ''}. Non è una fattura: il gestionale non l'ha registrato.`,
        passi_saltati: passiSaltati(),
      })
      continue
    }

    const { error: updErr } = await admin.from('fatture').update({
      fic_document_id: docId,
      numero: typeof d?.number === 'number' ? d.number : null,
      numerazione: typeof d?.numeration === 'string' ? d.numeration : numerazione,
      data: typeof d?.date === 'string' ? d.date : oggi,
      ei_status: typeof d?.ei_status === 'string' ? d.ei_status : null,
      url_documento: typeof d?.url === 'string' ? d.url : null,
      stato: 'emessa',
    }).eq('id', fatturaId!)

    if (updErr) {
      console.error('fic-emetti-fattura: update fattura fallito', updErr)
      fallisci('Il documento è stato creato su Fatture in Cloud ma la registrazione nel gestionale non è andata a buon fine. Non ripetere l\'emissione: segnala l\'errore.')
      continue
    }

    // Unica UPDATE: fattura_id e stato insieme. Scritti separatamente, il
    // secondo aggiornamento troverebbe OLD.stato = 'fatturato' e verrebbe
    // rifiutato dal trigger canoni_protect_fatturati.
    const { error: canErr } = await admin.from('canoni')
      .update({ fattura_id: fatturaId, stato: 'fatturato' })
      .eq('id', canoneId)

    if (canErr) {
      console.error('fic-emetti-fattura: collegamento canone fallito', canErr)
      fallisci('Fattura emessa e registrata, ma il collegamento con la mensilità non è riuscito. Segnala l\'errore.')
      continue
    }

    esiti.push({
      canone_id: canoneId, ok: true, fattura_id: fatturaId, fic_document_id: docId,
      numero: typeof d?.number === 'number' ? d.number : null,
      tipo_documento: TIPO_DOCUMENTO,
      message: `Fattura emessa su Fatture in Cloud${docId != null ? ` (ID ${docId})` : ''}. La trasmissione allo SDI resta un'azione manuale.`,
      passi_saltati: [],
    })
  }

  return jsonResponse(200, {
    ok: esiti.every((e) => e.ok),
    tipo_documento: TIPO_DOCUMENTO,
    scritture_locali: SCRITTURE_LOCALI_ATTIVE,
    passi_saltati: passiSaltati(),
    esiti,
  })
})
