import { describe, it, expect } from 'vitest';
import {
  STATI_SDI_DEFINITIVI, confrontaFattura, parametriDaRemoto, ammettiAnnullamenti, codiceErroreRpc,
  type FatturaLocale, type FatturaRemota,
} from '../../supabase/functions/_shared/fic-riallinea';

const locale: FatturaLocale = {
  numero: 7, numerazione: '/S', data: '2026-09-30', imponibile: 500, iva: 110, totale: 610,
  ei_status: 'not_sent', url_documento: 'https://x/7',
};
const remoto: FatturaRemota = {
  numero: 7, numerazione: '/S', data: '2026-09-30', imponibile: 500, iva: 110, totale: 610,
  ei_status: 'not_sent', url: 'https://x/7',
};

describe('STATI_SDI_DEFINITIVI', () => {
  it('contiene i sette stati definitivi e non quelli in corso', () => {
    expect(STATI_SDI_DEFINITIVI.size).toBe(7);
    for (const s of ['discarded', 'not_delivered', 'accepted', 'rejected', 'no_response', 'manual_accepted', 'manual_rejected'])
      expect(STATI_SDI_DEFINITIVI.has(s)).toBe(true);
    for (const s of ['not_sent', 'sent', 'pending', 'processing', 'error', 'attempt', 'missing'])
      expect(STATI_SDI_DEFINITIVI.has(s)).toBe(false);
  });
});

describe('confrontaFattura', () => {
  it('invariata quando tutto coincide', () => {
    expect(confrontaFattura(locale, remoto)).toEqual({ decisione: 'invariata', campi: [] });
  });
  it('aggiorna la data (7/S: 30/09 nel gestionale, 01/10 su FIC)', () => {
    expect(confrontaFattura(locale, { ...remoto, data: '2026-10-01' })).toEqual({ decisione: 'aggiorna', campi: ['data'] });
  });
  it('confronta gli importi in centesimi', () => {
    expect(confrontaFattura({ ...locale, totale: '610.00' }, { ...remoto, totale: 610.001 }).decisione).toBe('invariata');
    expect(confrontaFattura(locale, { ...remoto, imponibile: 501, iva: 110, totale: 611 }).campi).toEqual(['imponibile', 'totale']);
  });
  it('ei_status remoto nullo non è una differenza', () => {
    expect(confrontaFattura(locale, { ...remoto, ei_status: null }).decisione).toBe('invariata');
  });
  it('ei_status cambiato', () => {
    expect(confrontaFattura(locale, { ...remoto, ei_status: 'accepted' }).campi).toEqual(['ei_status']);
  });
  it('url solo se quello locale è vuoto', () => {
    expect(confrontaFattura({ ...locale, url_documento: null }, remoto).campi).toEqual(['url_documento']);
    expect(confrontaFattura(locale, { ...remoto, url: 'https://altro' }).decisione).toBe('invariata');
  });
  it('404 su fattura non trasmessa: annulla', () => {
    expect(confrontaFattura(locale, null).decisione).toBe('annulla');
    expect(confrontaFattura({ ...locale, ei_status: null }, null).decisione).toBe('annulla');
  });
  it('404 su fattura già trasmessa: anomalia', () => {
    expect(confrontaFattura({ ...locale, ei_status: 'sent' }, null).decisione).toBe('anomalia');
    expect(confrontaFattura({ ...locale, ei_status: 'accepted' }, null).decisione).toBe('anomalia');
  });
});

describe('parametriDaRemoto', () => {
  it('estrae i campi del documento', () => {
    expect(parametriDaRemoto({ number: 8, numeration: '/S', date: '2026-10-01', amount_net: 500, amount_vat: 110, amount_gross: 610, ei_status: 'sent', url: 'u' }))
      .toEqual({ numero: 8, numerazione: '/S', data: '2026-10-01', imponibile: 500, iva: 110, totale: 610, ei_status: 'sent', url: 'u' });
  });
  it('importi incoerenti diventano null', () => {
    const r = parametriDaRemoto({ number: 8, amount_net: 500, amount_vat: 110, amount_gross: 999 });
    expect(r.totale).toBeNull();
  });
});

describe('ammettiAnnullamenti (interruttore)', () => {
  it('0, 1, 2 inesistenti: ammessi', () => {
    expect(ammettiAnnullamenti(0)).toBe(true);
    expect(ammettiAnnullamenti(1)).toBe(true);
    expect(ammettiAnnullamenti(2)).toBe(true);
  });
  it('3 inesistenti: bloccati', () => {
    expect(ammettiAnnullamenti(3)).toBe(false);
  });
});

describe('codiceErroreRpc', () => {
  it('estrae il prefisso', () => {
    expect(codiceErroreRpc('documento_trasmesso_scomparso: il documento…')).toBe('documento_trasmesso_scomparso');
    expect(codiceErroreRpc('boh')).toBe('errore_rpc');
  });
});
