import { describe, it, expect } from 'vitest';
import {
  TIPO_DOCUMENTO,
  SCRITTURE_LOCALI_ATTIVE,
  costruisciPayloadFattura,
  descrizioneCanone,
  aggiungiGiorni,
  meseAnnoIt,
  type DatiFattura,
} from '../../supabase/functions/_shared/fic-fattura';

// La forma del payload viene dalla guida ufficiale "Invoice creation" di
// Fatture in Cloud e non si ricostruisce a memoria: se regredisce, il sintomo
// è un 422 in emissione o, peggio, una fattura con l'aliquota sbagliata.

const base: DatiFattura = {
  ficEntityId: 123456,
  competenza: '2026-03-01',
  imponibile: 272.73,
  totale: 300,
  dataEmissione: '2026-03-10',
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

  it('somma i giorni attraversando il cambio di mese', () => {
    expect(aggiungiGiorni('2026-03-10', 30)).toBe('2026-04-09');
    expect(aggiungiGiorni('2026-12-20', 30)).toBe('2027-01-19');
  });

  it('compone la descrizione del canone', () => {
    expect(descrizioneCanone('2026-03-01')).toBe('Canone di ospitalità — marzo 2026');
  });
});

describe('costruisciPayloadFattura', () => {
  const { data } = costruisciPayloadFattura(base);

  it('usa il tipo preso dalla costante', () => {
    expect(data.type).toBe(TIPO_DOCUMENTO);
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

  it('calcola due_date come data di emissione più i giorni di scadenza', () => {
    expect((data.payments_list as any[])[0].due_date).toBe('2026-04-09');
  });

  it('manda amount uguale al totale del canone', () => {
    expect((data.payments_list as any[])[0].amount).toBe(300);
  });

  it('imposta il flag di fattura elettronica solo sul tipo invoice', () => {
    if (TIPO_DOCUMENTO === 'invoice') expect(data.e_invoice).toBe(true);
    else expect('e_invoice' in data).toBe(false);
  });

  it('attiva le scritture locali solo sul tipo invoice', () => {
    expect(SCRITTURE_LOCALI_ATTIVE).toBe(TIPO_DOCUMENTO === 'invoice');
  });
});
