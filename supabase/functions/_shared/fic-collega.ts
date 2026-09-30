// Criteri puri per il collegamento di fatture esistenti e per la guardia
// contro i doppioni. Senza import: li usano fic-collega-fattura e
// fic-emetti-fattura, e li fissano i test in src/test/fic-collega.test.ts.

export const centesimi = (n: number | string | null | undefined): number =>
  Math.round(Number(n ?? 0) * 100)

export const stessoImporto = (a: number | string, b: number | string): boolean =>
  centesimi(a) === centesimi(b)

/** Confronto numerico di id che arrivano da fonti diverse (bigint/stringa/numero). */
export const stessoId = (a: unknown, b: unknown): boolean =>
  a != null && b != null && Number(a) === Number(b) && Number.isFinite(Number(a))

/**
 * Importi di un documento di Fatture in Cloud (campi amount_net, amount_vat,
 * amount_gross dello schema IssuedDocument). null se incoerenti: il CHECK
 * fatture_importi_coerenti (totale = imponibile + iva) non reggerebbe.
 */
export function importiDocumento(d: { amount_net?: unknown; amount_vat?: unknown; amount_gross?: unknown }):
  { imponibile: number; iva: number; totale: number } | null {
  const net = centesimi(d.amount_net as number)
  const vat = centesimi(d.amount_vat as number)
  const gross = centesimi(d.amount_gross as number)
  if (d.amount_gross == null || net + vat !== gross) return null
  return { imponibile: net / 100, iva: vat / 100, totale: gross / 100 }
}

export type FatturaPerGuardia = { id: string; stato: string }

/**
 * Guardia doppioni: vero se per il contratto esiste una fattura 'in_invio',
 * oppure 'emessa' senza alcuna mensilità che la punti.
 */
export function esisteFatturaDaRiconciliare(
  fatture: FatturaPerGuardia[],
  fattureCollegate: Set<string>,
): boolean {
  return fatture.some((f) =>
    f.stato === 'in_invio' || (f.stato === 'emessa' && !fattureCollegate.has(f.id))
  )
}

export const MESSAGGIO_DOPPIONE =
  'Esiste una fattura da riconciliare per questo contratto: verificala nel pannello Da riconciliare prima di emettere.'

/**
 * Rifiuto definitivo di Fatture in Cloud: il documento sicuramente NON esiste.
 * 400 e 422: richiesta non valida. 409: la documentazione ufficiale
 * (developers.fattureincloud.it/docs/basics/errors) dice che "the request has
 * no effect"; fra le cause il numero duplicato e la violazione dell'ordine
 * cronologico del sezionale. Ogni altro esito (rete, 5xx, 429...) lascia il
 * dubbio che il documento esista.
 */
export const rifiutoDefinitivoFic = (status: number | null): boolean =>
  status === 400 || status === 409 || status === 422

/** Risposta 4xx: si registra la diagnostica (estraiDiagnosticaFic) in fic_log. */
export const rispostaClient4xx = (status: number | null): boolean =>
  status != null && status >= 400 && status < 500
