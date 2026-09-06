import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { FIC_BASE, ficFetch, estraiDiagnosticaFic, isQuotaError } from '../_shared/fic-client.ts'

/**
 * fic-registri — legge in SOLA LETTURA i due registri dell'azienda su Fatture
 * in Cloud che servono per costruire un documento:
 *   GET /c/{company_id}/info/payment_methods
 *   GET /c/{company_id}/info/vat_types
 *
 * Non crea, non modifica e non invia alcun documento fiscale, e non scrive su
 * nessuna tabella di dominio. Ogni chiamata è registrata in public.fic_log;
 * il token non vi finisce mai.
 *
 * verify_jwt = true in config.toml; qui si verifica inoltre il ruolo admin.
 */

const OPERAZIONE = 'leggi_registri'

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
    console.error('fic-registri: scrittura fic_log fallita', e)
  }
}

function messaggioErrore(status: number | null, body: string): string {
  if (status === 401) return 'Il token di accesso non è valido o è scaduto.'
  if (status === 403) {
    return isQuotaError(status, body)
      ? 'Quota di chiamate esaurita: riprova più tardi.'
      : 'Il token non ha i permessi necessari per leggere i registri dell\'azienda.'
  }
  if (status === 400 || status === 422) return 'Fatture in Cloud ha rifiutato la richiesta.'
  return `Fatture in Cloud ha risposto con errore ${status}.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('fic-registri: variabili ambiente mancanti')
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

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const token = Deno.env.get('FIC_ACCESS_TOKEN')
  const companyId = Deno.env.get('FIC_COMPANY_ID')
  if (!token || !companyId) {
    await logFic(admin, {
      metodo: '-', endpoint: '-', http_status: null, esito: 'errore',
      messaggio: 'Credenziali Fatture in Cloud non configurate.',
      payload_ridotto: null,
    })
    return jsonResponse(200, { ok: false, message: 'Le credenziali di Fatture in Cloud non sono configurate.' })
  }

  const letture = [
    { chiave: 'metodi', path: 'payment_methods', label: '/c/{company_id}/info/payment_methods' },
    { chiave: 'aliquote', path: 'vat_types', label: '/c/{company_id}/info/vat_types' },
  ] as const

  const risultato: Record<string, unknown[]> = { metodi: [], aliquote: [] }

  for (const l of letture) {
    const esito = await ficFetch(`${FIC_BASE}/c/${companyId}/info/${l.path}`, { method: 'GET', token })

    if (esito.rete) {
      await logFic(admin, {
        metodo: 'GET', endpoint: l.label, http_status: null, esito: 'errore',
        messaggio: 'Impossibile raggiungere i server di Fatture in Cloud.',
        payload_ridotto: { registro: l.chiave },
      })
      return jsonResponse(200, {
        ok: false,
        message: 'Impossibile raggiungere i server di Fatture in Cloud. Riprova tra poco.',
      })
    }

    if (!esito.ok) {
      const msg = messaggioErrore(esito.status, esito.body)
      const ridotto: Record<string, unknown> = { registro: l.chiave, ...esito.quota }
      if (esito.status === 400 || esito.status === 422) Object.assign(ridotto, estraiDiagnosticaFic(esito.body))
      await logFic(admin, {
        metodo: 'GET', endpoint: l.label, http_status: esito.status, esito: 'errore',
        messaggio: msg, payload_ridotto: ridotto,
      })
      return jsonResponse(200, { ok: false, message: msg })
    }

    let righe: unknown[] = []
    try {
      const parsed = JSON.parse(esito.body)
      righe = Array.isArray(parsed?.data) ? parsed.data : []
    } catch {
      await logFic(admin, {
        metodo: 'GET', endpoint: l.label, http_status: esito.status, esito: 'errore',
        messaggio: 'Risposta non leggibile da Fatture in Cloud.',
        payload_ridotto: { registro: l.chiave, ...esito.quota },
      })
      return jsonResponse(200, { ok: false, message: 'Fatture in Cloud ha restituito una risposta non leggibile.' })
    }

    if (l.chiave === 'metodi') {
      risultato.metodi = righe
        // deno-lint-ignore no-explicit-any
        .map((m: any) => ({ id: m?.id, name: typeof m?.name === 'string' ? m.name : '' }))
        // deno-lint-ignore no-explicit-any
        .filter((m: any) => typeof m.id === 'number')
    } else {
      risultato.aliquote = righe
        // deno-lint-ignore no-explicit-any
        .map((v: any) => ({
          id: v?.id,
          value: typeof v?.value === 'number' ? v.value : Number(v?.value),
          description: typeof v?.description === 'string' ? v.description : '',
        }))
        // deno-lint-ignore no-explicit-any
        .filter((v: any) => typeof v.id === 'number' && Number.isFinite(v.value))
    }

    await logFic(admin, {
      metodo: 'GET', endpoint: l.label, http_status: esito.status, esito: 'ok',
      messaggio: `Registro ${l.chiave} letto: ${(risultato[l.chiave] as unknown[]).length} voci.`,
      payload_ridotto: { registro: l.chiave, voci: (risultato[l.chiave] as unknown[]).length, ...esito.quota },
    })
  }

  return jsonResponse(200, { ok: true, ...risultato })
})
