// Regole di mappatura fra public.anagrafiche_fatturazione e il cliente di
// Fatture in Cloud. Unico posto dove vivono: importato sia dall'edge function
// fic-sync-anagrafica sia dal frontend (alias @shared), così le due strade
// non possono divergere. Nessun import esterno, come countries.ts.

export type AnagraficaFic = {
  tipo?: string | null;
  denominazione?: string | null;
  nome?: string | null;
  cognome?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  indirizzo_via?: string | null;
  indirizzo_civico?: string | null;
  indirizzo_cap?: string | null;
  indirizzo_comune?: string | null;
  indirizzo_provincia?: string | null;
  indirizzo_nazione?: string | null;
  codice_destinatario?: string | null;
  pec?: string | null;
  email_recapito?: string | null;
};

/** Codici ISO 3166-1 alpha-2 dei 27 Stati membri UE. */
export const EU_COUNTRY_CODES: string[] = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

/** Codice partita IVA convenzionale per i soggetti Extra-UE. */
export const TAX_ID_EXTRA_UE = 'OO99999999999';

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Normalizzazione verso il payload di Fatture in Cloud: MAI null esplicito.
 * FIC risponde 422 "must be a string" a qualunque proprietà stringa inviata
 * come null (verificato su certified_email e vat_number). La stringa vuota
 * soddisfa il validatore e su un PUT svuota il campo remoto — a differenza
 * dell'omissione della chiave, che significherebbe "lascia com'era" e non
 * permetterebbe mai di svuotare (es. tax_code delle anagrafiche estere).
 * Se in futuro FIC rifiutasse "" su un campo specifico, per quel campo si
 * ripiega sull'omissione della chiave, dichiarandolo qui.
 */
const fv = (v: unknown): string => s(v);


export const nazioneDi = (a: AnagraficaFic): string => (s(a.indirizzo_nazione) || 'IT').toUpperCase();
export const isEstera = (a: AnagraficaFic): boolean => nazioneDi(a) !== 'IT';
export const isUe = (codice: string): boolean => EU_COUNTRY_CODES.includes(codice.toUpperCase());

/** Codice destinatario proposto: 0000000 per l'Italia, XXXXXXX per l'estero. */
export const codiceDestinatarioProposto = (nazione?: string | null): string =>
  (s(nazione) || 'IT').toUpperCase() === 'IT' ? '0000000' : 'XXXXXXX';

export const nomeCompleto = (a: AnagraficaFic): string =>
  a.tipo === 'soggetto_giuridico' ? s(a.denominazione) : `${s(a.nome)} ${s(a.cognome)}`.trim();

/**
 * Logica comune alle due soglie: i campi necessari a identificare il soggetto
 * su Fatture in Cloud, indipendentemente dal contesto d'uso.
 * La lista è NOSTRA: lo schema ufficiale models/schemas/Client.yaml del
 * repository OpenAPI di Fatture in Cloud non dichiara alcun campo `required`
 * e ogni proprietà è nullable. Serve a evitare fatture inintestabili, non a
 * riflettere un vincolo dell'API.
 *
 * Italia: nome/denominazione, via, comune, CAP, provincia, e almeno un
 * identificativo fiscale.
 * Estero: solo nome/denominazione, via, comune, nazione. Niente identificativo
 * fiscale (con P.IVA vuota Fatture in Cloud scrive da sé codice ISO ed ESTERO),
 * niente CAP e niente provincia, perché la mappatura invia comunque 00000 ed EE.
 */
function baseCampiMancantiPerFic(a: AnagraficaFic): string[] {
  const m: string[] = [];
  if (!nomeCompleto(a)) m.push(a.tipo === 'soggetto_giuridico' ? 'denominazione' : 'nome e cognome');
  if (!s(a.indirizzo_via)) m.push('indirizzo (via)');
  if (!s(a.indirizzo_comune)) m.push('comune');
  if (isEstera(a)) {
    if (!s(a.indirizzo_nazione)) m.push('nazione');
    return m;
  }
  if (!s(a.indirizzo_cap)) m.push('CAP');
  if (!s(a.indirizzo_provincia)) m.push('provincia');
  if (!s(a.codice_fiscale) && !s(a.partita_iva)) m.push('codice fiscale o partita IVA');
  return m;
}

/**
 * Soglia per la sincronizzazione anagrafica → cliente (fic-sync-anagrafica):
 * solo i campi necessari a creare il cliente. L'email di recapito NON è
 * richiesta: non serve a creare il cliente su Fatture in Cloud.
 */
export function campiMancantiPerFicSync(a: AnagraficaFic): string[] {
  return baseCampiMancantiPerFic(a);
}

/**
 * Soglia per l'emissione della fattura: risponde alla domanda "cosa manca per
 * emettere". Uguale alla sincronizzazione più l'email di recapito: al momento
 * della fattura serve un recapito, e per gli studenti esteri l'email è l'unico
 * possibile, dato che lo SDI non consegna all'estero.
 * Non è legata al dialogo del contratto: in D2 la riusa chi emette il documento.
 */
export function campiMancantiPerFattura(a: AnagraficaFic): string[] {
  const m = baseCampiMancantiPerFic(a);
  if (!s(a.email_recapito)) m.push('email di recapito');
  return m;
}

export type ClientePayloadFic = {
  type: 'person' | 'company';
  name: string;
  first_name: string;
  last_name: string;
  tax_code: string;
  vat_number: string;
  address_street: string;
  address_postal_code: string;
  address_city: string;
  address_province: string;
  country_iso: string;
  certified_email: string;
  email: string;
  ei_code: string;
};

export type MappaturaFic = {
  data: ClientePayloadFic;
  estera: boolean;
  /** Riepilogo leggibile delle trasformazioni applicate alle anagrafiche estere. */
  trasformazioni: string[];
};

export function mappaAnagraficaPerFic(a: AnagraficaFic): MappaturaFic {
  const nazione = nazioneDi(a);
  const estera = nazione !== 'IT';
  const persona = a.tipo !== 'soggetto_giuridico';
  const trasformazioni: string[] = [];

  let via = [s(a.indirizzo_via), s(a.indirizzo_civico)].filter(Boolean).join(' ');
  let cap = fv(a.indirizzo_cap);
  let provincia = fv(a.indirizzo_provincia);
  let taxCode = fv(a.codice_fiscale);
  let vat = fv(a.partita_iva);

  if (estera) {
    if (taxCode) trasformazioni.push('codice fiscale non inviato (anagrafica estera)');
    taxCode = '';

    const capReale = s(a.indirizzo_cap);
    if (capReale) {
      via = `${via} - ${capReale}`.trim();
      trasformazioni.push(`CAP inviato 00000, CAP reale ${capReale} accodato all'indirizzo`);
    } else {
      trasformazioni.push('CAP inviato 00000');
    }
    cap = '00000';

    if (!provincia) {
      provincia = 'EE';
      trasformazioni.push('provincia inviata EE');
    }

    if (!isUe(nazione)) {
      vat = TAX_ID_EXTRA_UE;
      trasformazioni.push(`paese Extra-UE: partita IVA inviata ${TAX_ID_EXTRA_UE}`);
    } else if (vat) {
      trasformazioni.push(`identificativo estero inviato nel campo partita IVA (${vat})`);
    } else {
      trasformazioni.push('partita IVA lasciata vuota: Fatture in Cloud scrive codice paese ed ESTERO');
    }
  }

  return {
    estera,
    trasformazioni,
    data: {
      type: persona ? 'person' : 'company',
      name: nomeCompleto(a),
      first_name: persona ? fv(a.nome) : '',
      last_name: persona ? fv(a.cognome) : '',
      tax_code: taxCode,
      vat_number: vat,
      address_street: fv(via),
      address_postal_code: cap,
      address_city: fv(a.indirizzo_comune),
      address_province: provincia,
      country_iso: nazione,
      certified_email: fv(a.pec),
      email: fv(a.email_recapito),
      // Il ripiego è sul valore VUOTO (||), non sul nullo (??): con la
      // normalizzazione a "" un ?? lascerebbe passare la stringa vuota e
      // spedirebbe un ei_code vuoto, non ammesso sulla fattura elettronica.
      ei_code: (fv(a.codice_destinatario) || codiceDestinatarioProposto(nazione)).toUpperCase(),
    },
  };
}
