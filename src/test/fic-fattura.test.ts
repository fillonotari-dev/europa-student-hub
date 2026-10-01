import { describe, it, expect } from 'vitest';
import {
  costruisciPayloadFattura,
  descrizioneCanone,
  giorniFra,
  aggiungiGiorni,
  meseAnnoIt,
  oggiRoma,
  scadenzaDocumento,
  type DatiFattura,
} from '../../supabase/functions/_shared/fic-fattura';
import { mappaAnagraficaPerFic } from '../../supabase/functions/_shared/fic-anagrafica';

// La forma del payload viene dalla guida ufficiale "Invoice creation" di
// Fatture in Cloud e non si ricostruisce a memoria: se regredisce, il sintomo
// è un 422 alla creazione o, peggio, una fattura con l'aliquota sbagliata.

const anaIt = {
  tipo: 'persona_fisica', nome: 'Mario', cognome: 'Rossi', codice_fiscale: 'RSSMRA80A01H501U',
  indirizzo_via: 'Via Roma', indirizzo_civico: '1', indirizzo_cap: '42121',
  indirizzo_comune: 'Reggio Emilia', indirizzo_provincia: 'RE', indirizzo_nazione: 'IT',
  email_recapito: 'mario@example.com',
};
const anaEstera = {
  tipo: 'persona_fisica', nome: 'Jean', cognome: 'Dupont', codice_fiscale: 'XXX',
  indirizzo_via: 'Rue de Rivoli', indirizzo_civico: '10', indirizzo_cap: '75001',
  indirizzo_comune: 'Paris', indirizzo_nazione: 'FR', email_recapito: 'jean@example.com',
};

const base: DatiFattura = {
  ficEntityId: 123456,
  entity: mappaAnagraficaPerFic(anaIt).data,
  eiMetodoPagamento: 'MP05',
  iban: 'IT60X0542811101000000123456',
  competenza: '2026-03-01',
  imponibile: 272.73,
  totale: 300,
  dataEmissione: '2026-03-10',
  scadenza: '2026-03-05',
  numerazione: '/S',
  giorniScadenza: 30,
  metodoPagamentoId: 2537205,
  vatId: 3,
};

describe('helper di data e descrizione', () => {
  it('rende il mese in italiano', () => {
    expect(meseAnnoIt('2026-03-01')).toBe('marzo 2026');
    expect(meseAnnoIt('2026-12-01')).toBe('dicembre 2026');
  });

  it('somma i giorni attraversando il confine del mese', () => {
    expect(aggiungiGiorni('2026-03-10', 30)).toBe('2026-04-09');
  });

  it('compone la descrizione del canone', () => {
    expect(descrizioneCanone('2026-03-01')).toBe('Canone di ospitalità Studentato Europa, marzo 2026');
  });
});

describe('scadenzaDocumento', () => {
  it('usa la scadenza del canone quando è successiva alla data di emissione', () => {
    expect(scadenzaDocumento('2026-03-10', '2026-03-31', 30)).toBe('2026-03-31');
  });

  it('ripiega su data di emissione più i giorni quando la scadenza manca', () => {
    expect(scadenzaDocumento('2026-03-10', null, 30)).toBe('2026-04-09');
    expect(scadenzaDocumento('2026-03-10', undefined, 15)).toBe('2026-03-25');
  });

  it('usa la data di emissione quando la scadenza è già passata', () => {
    expect(scadenzaDocumento('2026-06-10', '2026-03-05', 30)).toBe('2026-06-10');
  });

  it('accetta una scadenza uguale alla data di emissione', () => {
    expect(scadenzaDocumento('2026-03-10', '2026-03-10', 30)).toBe('2026-03-10');
  });
});

describe('costruisciPayloadFattura', () => {
  const { data } = costruisciPayloadFattura({ ...base, scadenza: '2026-03-31' });

  it('il documento è sempre una fattura', () => {
    expect(data.type).toBe('invoice');
  });

  it('non invia il numero: il progressivo lo assegna Fatture in Cloud', () => {
    expect('number' in data).toBe(false);
  });

  it('descrive la riga col mese in lettere', () => {
    expect((data.items_list as any[])[0].name).toBe('Canone di ospitalità Studentato Europa, marzo 2026');
  });

  it('manda net_price uguale all\'imponibile del canone', () => {
    expect((data.items_list as any[])[0].net_price).toBe(272.73);
  });

  it('manda l\'IVA come id e mai come valore percentuale', () => {
    const riga = (data.items_list as any[])[0];
    expect(riga.vat).toEqual({ id: 3 });
    expect(riga.vat.value).toBeUndefined();
  });

  it('mette il metodo di pagamento al primo livello, non dentro payments_list', () => {
    expect(data.payment_method).toEqual({ id: 2537205 });
    expect((data.payments_list as any[])[0].payment_method).toBeUndefined();
  });

  it('usa la scadenza del canone come due_date', () => {
    expect((data.payments_list as any[])[0].due_date).toBe('2026-03-31');
  });

  it('senza scadenza del canone ripiega sui giorni di scadenza', () => {
    const { data: d } = costruisciPayloadFattura({ ...base, scadenza: null });
    expect((d.payments_list as any[])[0].due_date).toBe('2026-04-09');
  });

  it('con scadenza già passata usa la data di emissione', () => {
    const { data: d } = costruisciPayloadFattura({ ...base, scadenza: '2026-01-31' });
    expect((d.payments_list as any[])[0].due_date).toBe('2026-03-10');
  });

  it('manda amount uguale al totale del canone', () => {
    expect((data.payments_list as any[])[0].amount).toBe(300);
  });

  it('entity completa per anagrafica italiana: stesso oggetto della mappatura', () => {
    const m = mappaAnagraficaPerFic(anaIt).data;
    expect(data.entity).toEqual({ id: 123456, ...m });
    const e = data.entity as any;
    expect(e.first_name).toBe('Mario');
    expect(e.last_name).toBe('Rossi');
    expect(e.tax_code).toBe('RSSMRA80A01H501U');
    expect(e.address_street).toBe('Via Roma 1');
    expect(e.address_postal_code).toBe('42121');
  });

  it('entity completa per anagrafica estera: vale la mappatura estera', () => {
    const { data: d } = costruisciPayloadFattura({ ...base, entity: mappaAnagraficaPerFic(anaEstera).data });
    const e = d.entity as any;
    expect(e.country_iso).toBe('FR');
    expect(e.address_postal_code).toBe('00000');
    expect(e.address_province).toBe('EE');
    expect(e.tax_code).toBe('');
    expect(e.ei_code).toBe('XXXXXXX');
  });

  it('entity per soggetto giuridico usa la denominazione', () => {
    const m = mappaAnagraficaPerFic({ ...anaIt, tipo: 'soggetto_giuridico', denominazione: 'Navona SRL', partita_iva: '01234567890' }).data;
    const { data: d } = costruisciPayloadFattura({ ...base, entity: m });
    expect((d.entity as any).name).toBe('Navona SRL');
    expect((d.entity as any).type).toBe('company');
  });

  it('payment_terms coerente con due_date', () => {
    const p = (data.payments_list as any[])[0];
    expect(p.payment_terms).toEqual({ days: giorniFra('2026-03-10', p.due_date), type: 'standard' });
    expect(p.payment_terms.days).toBe(21);
  });

  it('payment_terms su arretrato: days = 0', () => {
    const { data: d } = costruisciPayloadFattura({ ...base, scadenza: '2026-01-31' });
    expect((d.payments_list as any[])[0].payment_terms).toEqual({ days: 0, type: 'standard' });
  });

  it('payment_terms col ripiego sui giorni di scadenza', () => {
    const { data: d } = costruisciPayloadFattura({ ...base, scadenza: null });
    expect((d.payments_list as any[])[0].payment_terms.days).toBe(30);
  });

  it('ei_data in invoice con payment_method e bank_iban', () => {
    const { data: d } = costruisciPayloadFattura({ ...base });
    expect(d.ei_data).toEqual({ payment_method: 'MP05', bank_iban: 'IT60X0542811101000000123456' });
  });

  it('ei_data in invoice senza IBAN non contiene bank_iban', () => {
    for (const iban of [null, undefined, '', '  ']) {
      const { data: d } = costruisciPayloadFattura({ ...base, iban });
      expect(d.ei_data).toEqual({ payment_method: 'MP05' });
      expect('bank_iban' in (d.ei_data as any)).toBe(false);
    }
  });

  it('invariante: nessuna proprietà null o undefined a qualunque profondità', () => {
    const cerca = (v: unknown, path: string): string[] => {
      if (v === null || v === undefined) return [path];
      if (typeof v !== 'object') return [];
      return Object.entries(v as object).flatMap(([k, x]) => cerca(x, `${path}.${k}`));
    };
    for (const ana of [anaIt, anaEstera]) {
      for (const extra of [{}, { scadenza: null, iban: null }]) {
        const p = costruisciPayloadFattura({ ...base, ...extra, entity: mappaAnagraficaPerFic(ana).data });
        expect(cerca(p.data, 'data')).toEqual([]);
      }
    }
  });

  it('manda show_payment_method e show_payments', () => {
    expect(data.show_payment_method).toBe(true);
    expect(data.show_payments).toBe(true);
  });

  it('notes non è mai presente, con o senza IBAN', () => {
    for (const iban of ['IT60X0542811101000000123456', null, undefined, '', '  ']) {
      expect('notes' in costruisciPayloadFattura({ ...base, iban }).data).toBe(false);
    }
  });

  it('manda sempre il flag di fattura elettronica ed ei_data', () => {
    for (const iban of ['IT60X0542811101000000123456', null]) {
      const { data: d } = costruisciPayloadFattura({ ...base, iban });
      expect(d.e_invoice).toBe(true);
      expect((d.ei_data as any).payment_method).toBe('MP05');
    }
  });
});

describe('oggiRoma: data odierna nel fuso Europe/Rome', () => {
  it('23:30 UTC del 30/09 è già il 1° ottobre in Italia', () => {
    expect(oggiRoma(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
  it('12:00 UTC è lo stesso giorno', () => {
    expect(oggiRoma(new Date('2026-09-30T12:00:00Z'))).toBe('2026-09-30');
  });
  it('a cavallo del cambio d\'ora di fine ottobre (25/10/2026)', () => {
    expect(oggiRoma(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25'); // 00:30 CEST
    expect(oggiRoma(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25'); // 23:30 CET
    expect(oggiRoma(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26'); // 00:30 CET
  });
});
