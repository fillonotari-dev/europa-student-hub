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
const nz = (v: unknown): string | null => (s(v) === '' ? null : s(v));

export const nazioneDi = (a: AnagraficaFic): string => (s(a.indirizzo_nazione) || 'IT').toUpperCase();
export const isEstera = (a: AnagraficaFic): boolean => nazioneDi(a) !== 'IT';
export const isUe = (codice: string): boolean => EU_COUNTRY_CODES.includes(codice.toUpperCase());

/** Codice destinatario proposto: 0000000 per l'Italia, XXXXXXX per l'estero. */
export const codiceDestinatarioProposto = (nazione?: string | null): string =>
  (s(nazione) || 'IT').toUpperCase() === 'IT' ? '0000000' : 'XXXXXXX';

export const nomeCompleto = (a: AnagraficaFic): string =>
  a.tipo === 'soggetto_giuridico' ? s(a.denominazione) : `${s(a.nome)} ${s(a.cognome)}`.trim();

/**
 * Campi mancanti prima di poter inviare l'anagrafica a Fatture in Cloud.
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
export function campiMancantiPerFic(a: AnagraficaFic): string[] {
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

export type ClientePayloadFic = {
  type: 'person' | 'company';
  name: string;
  first_name: string | null;
  last_name: string | null;
  tax_code: string | null;
  vat_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_province: string | null;
  country_iso: string;
  certified_email: string | null;
  email: string | null;
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
  let cap = nz(a.indirizzo_cap);
  let provincia = nz(a.indirizzo_provincia);
  let taxCode = nz(a.codice_fiscale);
  let vat = nz(a.partita_iva);

  if (estera) {
    if (taxCode) trasformazioni.push('codice fiscale non inviato (anagrafica estera)');
    taxCode = null;

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
      first_name: persona ? nz(a.nome) : null,
      last_name: persona ? nz(a.cognome) : null,
      tax_code: taxCode,
      vat_number: vat,
      address_street: nz(via),
      address_postal_code: cap,
      address_city: nz(a.indirizzo_comune),
      address_province: provincia,
      country_iso: nazione,
      certified_email: nz(a.pec),
      email: nz(a.email_recapito),
      ei_code: (nz(a.codice_destinatario) ?? codiceDestinatarioProposto(nazione)).toUpperCase(),
    },
  };
}
