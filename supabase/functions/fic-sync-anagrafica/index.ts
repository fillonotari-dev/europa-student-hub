import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { campiMancantiPerFicSync, mappaAnagraficaPerFic } from '../_shared/fic-anagrafica.ts'

/**
 * fic-sync-anagrafica — allinea una riga di anagrafiche_fatturazione al
 * corrispondente cliente su Fatture in Cloud e salva l'id remoto in fic_entity_id.
 *
 * - verify_jwt = true in config.toml; qui si verifica inoltre il ruolo admin.
 * - fic_entity_id nullo  -> POST /c/{company_id}/entities/clients (creazione)
 * - fic_entity_id valorizzato -> PUT /c/{company_id}/entities/clients/{id}
 *   Mai una seconda creazione: sarebbe un doppione nel registro fiscale.
 * - PUT 404 (cliente cancellato su FIC) -> fic_entity_id azzerato e dichiarato.
 * - Nessun documento fiscale viene creato.
 * - Ogni chiamata scrive in public.fic_log; il token non vi finisce mai.
 */

const FIC_BASE = 'https://api-v2.fattureincloud.it'
const OPERAZIONE = 'sync_anagrafica'
const MAX_RETRIES = 2
const RETRY_AFTER_CAP_MS = 30000

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

function isQuotaError(status: number, bodyText: string): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  const t = bodyText.toLowerCase()
  return t.includes('quota') || t.includes('rate') || t.includes('limit')
}

function retryDelayMs(res: Response, attempt: number): number {
  const ra = res.headers.get('Retry-After')
  const secs = ra ? parseInt(ra, 10) : NaN
  const base = Number.isFinite(secs) && secs > 0 ? secs * 1000 : 1000 * (attempt + 1)
  return Math.min(base, RETRY_AFTER_CAP_MS)
}

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
    console.error('fic-sync-anagrafica: scrittura fic_log fallita', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('fic-sync-anagrafica: variabili ambiente mancanti')
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
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corpo assente */ }
  const anagraficaId = body?.anagrafica_id
  if (!isUuid(anagraficaId)) {
    return jsonResponse(400, { ok: false, message: 'Identificativo anagrafica non valido.' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: ana, error: anaErr } = await admin
    .from('anagrafiche_fatturazione')
    .select('*')
    .eq('id', anagraficaId as string)
    .maybeSingle()
  if (anaErr || !ana) {
    return jsonResponse(404, { ok: false, message: 'Anagrafica non trovata.' })
  }

  // --- Guardia sui dati incompleti: nessuna chiamata all'API ---
  const mancanti = campiMancantiPerFicSync(ana)
  if (mancanti.length > 0) {
    await logFic(admin, {
      metodo: '-',
      endpoint: '-',
      http_status: null,
      esito: 'errore',
      messaggio: `Sincronizzazione non eseguita: dati incompleti (${mancanti.join(', ')}).`,
      payload_ridotto: { anagrafica_id: anagraficaId, campi_mancanti: mancanti },
    })
    return jsonResponse(200, {
      ok: false,
      campi_mancanti: mancanti,
      message: 'Dati incompleti: completa l\'anagrafica prima di sincronizzare.',
    })
  }

  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')
  if (!token || !companyId) {
    await logFic(admin, {
      metodo: '-', endpoint: '-', http_status: null, esito: 'errore',
      messaggio: 'Credenziali Fatture in Cloud non configurate.',
      payload_ridotto: { anagrafica_id: anagraficaId },
    })
    return jsonResponse(200, { ok: false, message: 'Le credenziali di Fatture in Cloud non sono configurate.' })
  }

  const mappatura = mappaAnagraficaPerFic(ana)
  const entityId: number | null = ana.fic_entity_id ?? null
  const creazione = entityId == null
  const metodo = creazione ? 'POST' : 'PUT'
  const endpointLabel = creazione
    ? '/c/{company_id}/entities/clients'
    : '/c/{company_id}/entities/clients/{client_id}'
  const url = creazione
    ? `${FIC_BASE}/c/${companyId}/entities/clients`
    : `${FIC_BASE}/c/${companyId}/entities/clients/${entityId}`

  let res: Response | null = null
  let lastStatus: number | null = null
  let lastBody = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: mappatura.data }),
      })
      lastStatus = res.status
      lastBody = await res.text()
    } catch (e) {
      console.error('fic-sync-anagrafica: errore di rete', e)
      await logFic(admin, {
        metodo, endpoint: endpointLabel, http_status: null, esito: 'errore',
        messaggio: 'Impossibile raggiungere i server di Fatture in Cloud.',
        payload_ridotto: { anagrafica_id: anagraficaId },
      })
      return jsonResponse(200, {
        ok: false,
        message: 'Impossibile raggiungere i server di Fatture in Cloud. Riprova tra poco.',
      })
    }
    if (res.ok || !isQuotaError(res.status, lastBody) || attempt === MAX_RETRIES) break
    await sleep(retryDelayMs(res, attempt))
  }

  if (!res) return jsonResponse(500, { ok: false, message: 'Errore interno inatteso.' })

  const quota = {
    quota_ora: res.headers.get('RateLimit-HourlyRemaining'),
    quota_mese: res.headers.get('RateLimit-MonthlyRemaining'),
  }

  // --- Cliente cancellato su Fatture in Cloud: si scollega l'anagrafica ---
  if (!res.ok && !creazione && lastStatus === 404) {
    await admin.from('anagrafiche_fatturazione')
      .update({ fic_entity_id: null })
      .eq('id', anagraficaId as string)
    await logFic(admin, {
      metodo, endpoint: endpointLabel, http_status: 404, esito: 'errore',
      messaggio: 'Cliente inesistente su Fatture in Cloud: collegamento azzerato.',
      payload_ridotto: { anagrafica_id: anagraficaId, fic_entity_id_precedente: entityId, ...quota },
    })
    return jsonResponse(200, {
      ok: false,
      scollegata: true,
      fic_entity_id: null,
      message: 'Il cliente non esiste più su Fatture in Cloud: il collegamento è stato azzerato. Ripeti la sincronizzazione per crearlo di nuovo.',
    })
  }

  if (!res.ok) {
    let msg: string
    if (lastStatus === 401) msg = 'Il token di accesso non è valido o è scaduto.'
    else if (lastStatus === 403) msg = isQuotaError(lastStatus, lastBody)
      ? 'Quota di chiamate esaurita: riprova più tardi.'
      : 'Il token non ha i permessi necessari per gestire i clienti.'
    else if (lastStatus === 422 || lastStatus === 400) msg = 'Fatture in Cloud ha rifiutato i dati dell\'anagrafica.'
    else msg = `Fatture in Cloud ha risposto con errore ${lastStatus}.`
    await logFic(admin, {
      metodo, endpoint: endpointLabel, http_status: lastStatus, esito: 'errore',
      messaggio: msg,
      payload_ridotto: { anagrafica_id: anagraficaId, ...quota },
    })
    return jsonResponse(200, { ok: false, message: msg })
  }

  let nuovoId: number | null = entityId
  try {
    const parsed = JSON.parse(lastBody)
    const id = parsed?.data?.id
    if (typeof id === 'number') nuovoId = id
  } catch { /* risposta non JSON: si tiene l'id noto */ }

  if (creazione) {
    if (nuovoId == null) {
      await logFic(admin, {
        metodo, endpoint: endpointLabel, http_status: lastStatus, esito: 'errore',
        messaggio: 'Cliente creato ma identificativo assente nella risposta.',
        payload_ridotto: { anagrafica_id: anagraficaId, ...quota },
      })
      return jsonResponse(200, {
        ok: false,
        message: 'Il cliente risulta creato ma Fatture in Cloud non ha restituito l\'identificativo. Verifica su Fatture in Cloud prima di riprovare.',
      })
    }
    const { error: upErr } = await admin.from('anagrafiche_fatturazione')
      .update({ fic_entity_id: nuovoId })
      .eq('id', anagraficaId as string)
    if (upErr) {
      await logFic(admin, {
        metodo, endpoint: endpointLabel, http_status: lastStatus, esito: 'errore',
        messaggio: 'Cliente creato ma salvataggio dell\'identificativo fallito.',
        payload_ridotto: { anagrafica_id: anagraficaId, fic_entity_id: nuovoId, ...quota },
      })
      return jsonResponse(200, {
        ok: false,
        fic_entity_id: nuovoId,
        message: `Cliente creato su Fatture in Cloud (ID ${nuovoId}) ma il collegamento non è stato salvato. Non ripetere la sincronizzazione: segnala l'errore.`,
      })
    }
  }

  await logFic(admin, {
    metodo, endpoint: endpointLabel, http_status: lastStatus, esito: 'ok',
    messaggio: creazione ? 'Cliente creato su Fatture in Cloud.' : 'Cliente aggiornato su Fatture in Cloud.',
    payload_ridotto: {
      anagrafica_id: anagraficaId,
      fic_entity_id: nuovoId,
      estera: mappatura.estera,
      trasformazioni: mappatura.trasformazioni,
      ...quota,
    },
  })

  return jsonResponse(200, {
    ok: true,
    creata: creazione,
    fic_entity_id: nuovoId,
    estera: mappatura.estera,
    trasformazioni: mappatura.trasformazioni,
    message: creazione
      ? `Cliente creato su Fatture in Cloud (ID ${nuovoId}).`
      : `Cliente aggiornato su Fatture in Cloud (ID ${nuovoId}).`,
  })
})
