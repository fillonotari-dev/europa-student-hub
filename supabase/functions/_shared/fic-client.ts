/**
 * Impianto minimo per le chiamate all'API di Fatture in Cloud: retry sulle sole
 * risposte di quota, lettura delle quote residue, estrazione della diagnostica
 * dei rifiuti 400/422.
 *
 * UNIFICAZIONE RINVIATA, DI PROPOSITO. fic-sync-anagrafica contiene oggi le
 * stesse funzioni scritte a mano e NON viene riscritta per usare questo modulo:
 * è l'unico percorso verso Fatture in Cloud già validato sul campo, e
 * riportarla qui dentro lo stesso intervento che introduce la lettura dei
 * registri renderebbe impossibile attribuire un'eventuale rottura all'una o
 * all'altra cosa. È duplicazione di impianto, non di logica di dominio: o si
 * rompe o non si rompe, e può aspettare un intervento dedicato.
 */

export const FIC_BASE = 'https://api-v2.fattureincloud.it'

const MAX_RETRIES = 2
const RETRY_AFTER_CAP_MS = 30000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function isQuotaError(status: number, bodyText: string): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  const t = bodyText.toLowerCase()
  return t.includes('quota') || t.includes('rate') || t.includes('limit')
}

/**
 * Estrae la spiegazione di un rifiuto 400/422: error.message e
 * error.validation_result. Se il corpo non è JSON conserva i primi 500
 * caratteri in fic_error_raw — è il caso in cui altrimenti non resterebbe
 * niente. Mai il corpo integrale: contiene dati personali.
 */
export function estraiDiagnosticaFic(bodyText: string): Record<string, unknown> {
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

export type EsitoFic = {
  ok: boolean
  status: number | null
  body: string
  quota: { quota_ora: string | null; quota_mese: string | null }
  /** Vero solo se la chiamata non è mai partita (rete irraggiungibile). */
  rete: boolean
}

export async function ficFetch(
  url: string,
  init: { method: string; token: string; body?: unknown },
): Promise<EsitoFic> {
  let res: Response | null = null
  let body = ''
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${init.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
      body = await res.text()
    } catch (e) {
      console.error('ficFetch: errore di rete', e)
      return {
        ok: false, status: null, body: '', rete: true,
        quota: { quota_ora: null, quota_mese: null },
      }
    }
    if (res.ok || !isQuotaError(res.status, body) || attempt === MAX_RETRIES) break
    await sleep(retryDelayMs(res, attempt))
  }
  if (!res) {
    return { ok: false, status: null, body: '', rete: true, quota: { quota_ora: null, quota_mese: null } }
  }
  return {
    ok: res.ok,
    status: res.status,
    body,
    rete: false,
    quota: {
      quota_ora: res.headers.get('RateLimit-HourlyRemaining'),
      quota_mese: res.headers.get('RateLimit-MonthlyRemaining'),
    },
  }
}
