// Criteri puri del riallineamento con Fatture in Cloud (P5b). Senza import di
// rete: li usa fic-riallinea e li fissano i test in src/test/fic-riallinea.test.ts.
import { centesimi, importiDocumento } from './fic-collega.ts'

/** Stati SDI dopo i quali il documento non cambia più (schema IssuedDocument). */
export const STATI_SDI_DEFINITIVI: ReadonlySet<string> = new Set([
  'discarded', 'not_delivered', 'accepted', 'rejected', 'no_response',
  'manual_accepted', 'manual_rejected',
])

/** Oltre questa soglia di documenti inesistenti nello stesso giro non si annulla nulla. */
export const SOGLIA_INESISTENTI = 2

export type FatturaLocale = {
  numero: number | null
  numerazione: string | null
  data: string | null
  imponibile: number | string
  iva: number | string
  totale: number | string
  ei_status: string | null
  url_documento: string | null
}

/** Valori di un documento letto da Fatture in Cloud, già normalizzati. */
export type FatturaRemota = {
  numero: number | null
  numerazione: string | null
  data: string | null
  imponibile: number | null
  iva: number | null
  totale: number | null
  ei_status: string | null
  url: string | null
}

export type Decisione = 'aggiorna' | 'annulla' | 'anomalia' | 'invariata'

/** Fattura con ei_status locale NULL o not_sent: non risulta trasmessa allo SDI. */
export const nonTrasmessa = (ei: string | null | undefined): boolean => ei == null || ei === 'not_sent'

/**
 * Confronta la fattura locale con il documento remoto. remoto = null significa
 * documento inesistente (doppio 404): annulla se non trasmessa, altrimenti anomalia.
 */
export function confrontaFattura(locale: FatturaLocale, remoto: FatturaRemota | null):
  { decisione: Decisione; campi: string[] } {
  if (remoto === null) {
    return { decisione: nonTrasmessa(locale.ei_status) ? 'annulla' : 'anomalia', campi: [] }
  }
  const campi: string[] = []
  if (remoto.numero !== locale.numero) campi.push('numero')
  if ((remoto.numerazione ?? null) !== (locale.numerazione ?? null)) campi.push('numerazione')
  if ((remoto.data ?? null) !== (locale.data ?? null)) campi.push('data')
  if (remoto.imponibile == null || centesimi(remoto.imponibile) !== centesimi(locale.imponibile)) campi.push('imponibile')
  if (remoto.iva == null || centesimi(remoto.iva) !== centesimi(locale.iva)) campi.push('iva')
  if (remoto.totale == null || centesimi(remoto.totale) !== centesimi(locale.totale)) campi.push('totale')
  if (remoto.ei_status != null && remoto.ei_status !== locale.ei_status) campi.push('ei_status')
  if (!locale.url_documento && remoto.url) campi.push('url_documento')
  return { decisione: campi.length > 0 ? 'aggiorna' : 'invariata', campi }
}

/** Estrae i valori dal documento IssuedDocument (fieldset detailed). */
// deno-lint-ignore no-explicit-any
export function parametriDaRemoto(doc: any): FatturaRemota {
  const imp = importiDocumento(doc ?? {})
  const num = doc?.number != null && Number.isFinite(Number(doc.number)) ? Number(doc.number) : null
  return {
    numero: num,
    numerazione: typeof doc?.numeration === 'string' ? doc.numeration : null,
    data: typeof doc?.date === 'string' ? doc.date : null,
    imponibile: imp?.imponibile ?? null,
    iva: imp?.iva ?? null,
    totale: imp?.totale ?? null,
    ei_status: typeof doc?.ei_status === 'string' ? doc.ei_status : null,
    url: typeof doc?.url === 'string' && doc.url ? doc.url : null,
  }
}

/**
 * Interruttore di sicurezza: un annullamento è irreversibile, quindi con più
 * di SOGLIA_INESISTENTI documenti inesistenti nello stesso giro non se ne
 * esegue nessuno (anomalia 'troppi_404').
 */
export const ammettiAnnullamenti = (nInesistenti: number): boolean => nInesistenti <= SOGLIA_INESISTENTI

/** Codice d'errore della RPC riallinea_fattura (prefisso prima dei due punti). */
export function codiceErroreRpc(messaggio: string | null | undefined): string {
  const m = (messaggio ?? '').match(/^([a-z_]+):/)
  return m ? m[1] : 'errore_rpc'
}
