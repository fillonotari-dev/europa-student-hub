// Costruzione del payload del documento di vendita su Fatture in Cloud.
// Funzione PURA e senza import esterni: la usa l'edge function fic-emetti-fattura
// e la fissano i test in src/test/fic-fattura.test.ts (alias @shared).
//
// Due campi sono facili da sbagliare e sono la ragione per cui questo modulo
// esiste separato dalla funzione:
//   - l'IVA della riga è un ID del registro aliquote (vat.id), NON il valore
//     percentuale (vat.value);
//   - il metodo di pagamento sta al PRIMO LIVELLO del documento
//     (payment_method.id), non dentro payments_list.
// Forma verificata sulla guida ufficiale "Invoice creation" e sullo schema
// models/schemas/IssuedDocument.yaml del repository OpenAPI di Fatture in Cloud.
//
// Il tipo del documento NON è più una costante di questo modulo: è
// l'impostazione `impostazioni.fic_emette_fatture`, letta da fic-emetti-fattura
// e passata qui come argomento. Una sola fonte di verità.

export type TipoDocumento = 'proforma' | 'invoice';

/** Dall'interruttore delle impostazioni al tipo del documento. */
export function tipoDocumentoDa(emetteFatture: boolean): TipoDocumento {
  return emetteFatture ? 'invoice' : 'proforma';
}

/**
 * Le scritture locali (riga in `fatture`, collegamento del canone e passaggio a
 * `fatturato`) e il flag di fattura elettronica valgono SOLO per 'invoice'.
 * Una proforma non fattura un mese: marcare il canone sarebbe sbagliato nel
 * merito e irreversibile, perché canoni_protect_fatturati da 'fatturato'
 * ammette solo 'incassato', vieta la cancellazione della riga, e
 * riporta_contratto_in_bozza rifiuta un contratto con canoni fatturati.
 */
export function scrittureLocaliAttive(tipo: TipoDocumento): boolean {
  return tipo === 'invoice';
}

const MESI_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "2026-03-01" -> "marzo 2026". Nessun fuso orario di mezzo: si legge la stringa. */
export function meseAnnoIt(competenzaIso: string): string {
  const [a, m] = competenzaIso.split('-');
  const idx = Number(m) - 1;
  return `${MESI_IT[idx] ?? m} ${a}`;
}

/** Somma di giorni a una data ISO, in UTC per non dipendere dal fuso del server. */
export function aggiungiGiorni(dataIso: string, giorni: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/**
 * Data di scadenza del pagamento sul documento.
 *
 * La data che vale è `canoni.scadenza`, cioè quella concordata nel contratto e
 * mostrata nello scadenzario: se il documento ne dichiarasse un'altra, il
 * gestionale e la fattura direbbero due cose diverse sulla stessa mensilità.
 * `giorniScadenza` è solo un ripiego per il canone senza scadenza. Se la
 * scadenza è anteriore alla data di emissione — arretrato fatturato in ritardo
 * — si usa la data di emissione, per non creare un documento già scaduto.
 */
export function scadenzaDocumento(
  dataEmissione: string,
  scadenza: string | null | undefined,
  giorniScadenza: number,
): string {
  if (!scadenza) return aggiungiGiorni(dataEmissione, giorniScadenza);
  return scadenza < dataEmissione ? dataEmissione : scadenza;
}

export function descrizioneCanone(competenzaIso: string): string {
  return `Canone di ospitalità — ${meseAnnoIt(competenzaIso)}`;
}

export type DatiFattura = {
  tipo: TipoDocumento;
  ficEntityId: number;
  // Nome del cliente così come composto da nomeCompleto in fic-anagrafica.ts:
  // lo passa il chiamante, così questo modulo resta puro e il nome sul
  // documento non può divergere da quello dell'anagrafica remota. Fatture in
  // Cloud rifiuta con 422 un entity senza name.
  nomeCliente: string;
  competenza: string;
  imponibile: number;
  totale: number;
  dataEmissione: string;
  /** Scadenza del canone: è questa la data che finisce sul documento. */
  scadenza?: string | null;
  numerazione: string;
  giorniScadenza: number;
  metodoPagamentoId: number;
  vatId: number;
};

export type PayloadFattura = {
  data: Record<string, unknown>;
};

export function costruisciPayloadFattura(d: DatiFattura): PayloadFattura {
  const data: Record<string, unknown> = {
    // `number` è deliberatamente OMESSO: il progressivo del sezionale lo
    // assegna Fatture in Cloud.
    type: d.tipo,
    entity: { id: d.ficEntityId, name: d.nomeCliente },
    date: d.dataEmissione,
    numeration: d.numerazione,
    payment_method: { id: d.metodoPagamentoId },
    items_list: [{
      name: descrizioneCanone(d.competenza),
      net_price: d.imponibile,
      qty: 1,
      vat: { id: d.vatId },
    }],
    payments_list: [{
      due_date: scadenzaDocumento(d.dataEmissione, d.scadenza, d.giorniScadenza),
      amount: d.totale,
      status: 'not_paid',
    }],
  };

  // e_invoice: booleano di IssuedDocument ("Issued document is an e-invoice",
  // models/schemas/IssuedDocument.yaml), presupposto dalla guida "E-Invoice
  // management" per poter poi trasmettere il documento allo SDI. Ha senso solo
  // su una fattura: su una proforma non è un documento fiscale e la richiesta
  // può essere rifiutata.
  if (scrittureLocaliAttive(d.tipo)) data.e_invoice = true;

  return { data };
}
