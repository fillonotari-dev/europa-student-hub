import { describe, it, expect } from 'vitest';
import {
  costruisciPayloadFattura,
  descrizioneCanone,
  aggiungiGiorni,
  meseAnnoIt,
  scadenzaDocumento,
  scrittureLocaliAttive,
  tipoDocumentoDa,
  type DatiFattura,
} from '../../supabase/functions/_shared/fic-fattura';
import { nomeCompleto } from '../../supabase/functions/_shared/fic-anagrafica';

// La forma del payload viene dalla guida ufficiale "Invoice creation" di
// Fatture in Cloud e non si ricostruisce a memoria: se regredisce, il sintomo
// è un 422 in emissione o, peggio, una fattura con l'aliquota sbagliata.

const base: DatiFattura = {
  tipo: 'proforma',
  ficEntityId: 123456,
  nomeCliente: 'Mario Rossi',
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
    expect(descrizioneCanone('2026-03-01')).toBe('Canone di ospitalità — marzo 2026');
  });
});

describe('tipo del documento come impostazione', () => {
  it('interruttore spento: proforma senza scritture locali', () => {
    expect(tipoDocumentoDa(false)).toBe('proforma');
    expect(scrittureLocaliAttive('proforma')).toBe(false);
  });

  it('interruttore acceso: fattura con scritture locali', () => {
    expect(tipoDocumentoDa(true)).toBe('invoice');
    expect(scrittureLocaliAttive('invoice')).toBe(true);
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

  it('usa il tipo ricevuto come argomento', () => {
    expect(data.type).toBe('proforma');
    expect(costruisciPayloadFattura({ ...base, tipo: 'invoice' }).data.type).toBe('invoice');
  });

  it('non invia il numero: il progressivo lo assegna Fatture in Cloud', () => {
    expect('number' in data).toBe(false);
  });

  it('descrive la riga col mese in lettere', () => {
    expect((data.items_list as any[])[0].name).toBe('Canone di ospitalità — marzo 2026');
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

  it('manda entity con id e name valorizzati', () => {
    expect(data.entity).toEqual({ id: 123456, name: 'Mario Rossi' });
  });

  it('compone entity.name per una persona fisica con nomeCompleto', () => {
    const nome = nomeCompleto({ tipo: 'persona_fisica', nome: 'Mario', cognome: 'Rossi' });
    const { data: d } = costruisciPayloadFattura({ ...base, nomeCliente: nome });
    expect((d.entity as any).name).toBe('Mario Rossi');
  });

  it('compone entity.name per un soggetto giuridico con la denominazione', () => {
    const nome = nomeCompleto({ tipo: 'soggetto_giuridico', denominazione: 'Navona SRL', nome: 'Ignorato', cognome: 'Ignorato' });
    const { data: d } = costruisciPayloadFattura({ ...base, nomeCliente: nome });
    expect((d.entity as any).name).toBe('Navona SRL');
  });

  it('con tipo proforma non manda il flag di fattura elettronica', () => {
    expect('e_invoice' in costruisciPayloadFattura({ ...base, tipo: 'proforma' }).data).toBe(false);
  });

  it('con tipo invoice manda il flag di fattura elettronica', () => {
    expect(costruisciPayloadFattura({ ...base, tipo: 'invoice' }).data.e_invoice).toBe(true);
  });
});
