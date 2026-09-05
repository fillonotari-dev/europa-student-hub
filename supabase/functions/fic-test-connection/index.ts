import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

/**
 * fic-test-connection — verifica in SOLA LETTURA della connessione a Fatture in Cloud.
 *
 * - verify_jwt = true in config.toml; il gateway valida il JWT del chiamante.
 * - Qui si verifica inoltre il ruolo admin via has_role (403 altrimenti).
 * - Unica chiamata: GET /c/{company_id}/company/info (specifica OpenAPI ufficiale).
 *   Non viene interrogata /user/companies: esporrebbe token di accesso.
 * - Ogni chiamata scrive una riga in public.fic_log. Il token non finisce mai
 *   nella tabella né nei log.
 */

const FIC_BASE = 'https://api-v2.fattureincloud.it'
const OPERAZIONE = 'test_connection'
const METODO = 'GET'
const ENDPOINT_LABEL = '/c/{company_id}/company/info'
const MAX_RETRIES = 2
const RETRY_AFTER_CAP_MS = 30000

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isQuotaError(status: number, bodyText: string): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  // 403 è anche "permessi mancanti": si riprova solo se la risposta indica quota
  const t = bodyText.toLowerCase()
  return t.includes('quota') || t.includes('rate') || t.includes('limit')
}

/**
 * Estrae la spiegazione di un rifiuto 400/422 dal corpo della risposta FIC:
 * error.message e error.validation_result. Se il corpo non è JSON conserva i
 * primi 500 caratteri in fic_error_raw: è il caso in cui altrimenti non
 * resterebbe niente. Mai il corpo integrale.
 */
function estraiDiagnosticaFic(bodyText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(bodyText)
    const out: Record<string, unknown> = {}
    if (typeof parsed?.error?.message === 'string') out.fic_error_message = parsed.error.message
    if (parsed?.error?.validation_result != null) out.fic_validation_result = parsed.error.validation_result
    return out
  } catch {
    return { fic_error_raw: bodyText.slice(0, 500) }
  }
}

function retryDelayMs(res: Response, attempt: number): number {
  const ra = res.headers.get('Retry-After')
  const secs = ra ? parseInt(ra, 10) : NaN
  const base = Number.isFinite(secs) && secs > 0 ? secs * 1000 : 1000 * (attempt + 1)
  return Math.min(base, RETRY_AFTER_CAP_MS)
}

async function logFic(
  admin: ReturnType<typeof createClient>,
  entry: {
    http_status: number | null
    esito: 'ok' | 'errore'
    messaggio: string
    payload_ridotto: Record<string, unknown> | null
  }
) {
  // Best effort: un fallimento del registro non deve mascherare l'esito reale.
  try {
    await admin.from('fic_log').insert({
      operazione: OPERAZIONE,
      metodo: METODO,
      endpoint: ENDPOINT_LABEL,
      http_status: entry.http_status,
      esito: entry.esito,
      messaggio: entry.messaggio,
      payload_ridotto: entry.payload_ridotto,
    })
  } catch (e) {
    console.error('fic-test-connection: scrittura fic_log fallita', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('fic-test-connection: variabili ambiente mancanti')
    return jsonResponse(500, { ok: false, message: 'Configurazione del server incompleta.' })
  }

  // --- Verifica ruolo admin ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse(403, { ok: false, message: 'Accesso riservato agli amministratori.' })
  }
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: isAdmin, error: roleErr } = await caller.rpc('has_role', {
    _user_id: (await caller.auth.getUser()).data.user?.id,
    _role: 'admin',
  })
  if (roleErr || !isAdmin) {
    return jsonResponse(403, { ok: false, message: 'Accesso riservato agli amministratori.' })
  }

  // --- Credenziali FIC ---
  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  if (!token || !companyId) {
    await logFic(admin, {
      http_status: null,
      esito: 'errore',
      messaggio: 'Credenziali Fatture in Cloud non configurate (FIC_ACCESS_TOKEN / FIC_COMPANY_ID).',
      payload_ridotto: null,
    })
    return jsonResponse(200, {
      ok: false,
      message: 'Le credenziali di Fatture in Cloud non sono configurate.',
    })
  }

  // --- Chiamata in sola lettura con retry su quota ---
  const url = `${FIC_BASE}/c/${companyId}/company/info`
  let lastStatus: number | null = null
  let lastBody = ''
  let res: Response | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      lastStatus = res.status
      lastBody = await res.text()
    } catch (e) {
      console.error('fic-test-connection: errore di rete', e)
      await logFic(admin, {
        http_status: null,
        esito: 'errore',
        messaggio: 'Impossibile raggiungere i server di Fatture in Cloud.',
        payload_ridotto: null,
      })
      return jsonResponse(200, {
        ok: false,
        message: 'Impossibile raggiungere i server di Fatture in Cloud. Riprova tra poco.',
      })
    }

    if (res.ok || !isQuotaError(res.status, lastBody) || attempt === MAX_RETRIES) break
    await sleep(retryDelayMs(res, attempt))
  }

  if (!res) {
    return jsonResponse(500, { ok: false, message: 'Errore interno inatteso.' })
  }

  const hourly = res.headers.get('RateLimit-HourlyRemaining')
  const monthly = res.headers.get('RateLimit-MonthlyRemaining')

  if (!res.ok) {
    let msg: string
    if (lastStatus === 401) msg = 'Il token di accesso non è valido o è scaduto.'
    else if (lastStatus === 403) msg = isQuotaError(lastStatus, lastBody)
      ? 'Quota di chiamate esaurita: riprova più tardi.'
      : 'Il token non ha i permessi necessari per leggere i dati dell\'azienda.'
    else if (lastStatus === 404) msg = 'Azienda non trovata: verifica l\'ID azienda configurato.'
    else msg = `Fatture in Cloud ha risposto con errore ${lastStatus}.`

    const ridotto: Record<string, unknown> = { quota_ora: hourly, quota_mese: monthly }
    if (lastStatus === 400 || lastStatus === 422) {
      Object.assign(ridotto, estraiDiagnosticaFic(lastBody))
    }

    await logFic(admin, {
      http_status: lastStatus,
      esito: 'errore',
      messaggio: msg,
      payload_ridotto: ridotto,
    })
    return jsonResponse(200, { ok: false, message: msg })
  }

  let companyName: string | null = null
  try {
    const data = JSON.parse(lastBody)
    companyName = typeof data?.data?.name === 'string' ? data.data.name : null
  } catch {
    companyName = null
  }
  if (!companyName) {
    await logFic(admin, {
      http_status: lastStatus,
      esito: 'errore',
      messaggio: 'Risposta di Fatture in Cloud valida ma senza nome azienda.',
      payload_ridotto: { quota_ora: hourly, quota_mese: monthly },
    })
    return jsonResponse(200, {
      ok: false,
      message: 'La connessione funziona ma la risposta non contiene il nome dell\'azienda.',
    })
  }

  await logFic(admin, {
    http_status: lastStatus,
    esito: 'ok',
    messaggio: 'Connessione verificata.',
    payload_ridotto: { azienda: companyName, quota_ora: hourly, quota_mese: monthly },
  })
  return jsonResponse(200, {
    ok: true,
    company: { name: companyName },
    quota: { hourly_remaining: hourly, monthly_remaining: monthly },
  })
})
