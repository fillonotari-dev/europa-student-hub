import { describe, expect, it } from 'vitest';
import { imponibilePersonalizzato, partizionaMensilitaPerCambioCanone } from '@/lib/canoniRicalcolo';

const OGGI = '2026-09-05';
const CANONE = 350;

const riga = (over: Partial<{ stato: string; competenza: string; imponibile: number }> = {}) => ({
  stato: 'da_fatturare',
  competenza: '2026-10-01',
  imponibile: 350,
  ...over,
});

describe('partizionaMensilitaPerCambioCanone', () => {
  it('aggiorna una riga allineata al canone con competenza futura', () => {
    const { aggiornate, intatte } = partizionaMensilitaPerCambioCanone([riga()], CANONE, OGGI);
    expect(aggiornate).toHaveLength(1);
    expect(intatte).toHaveLength(0);
  });

  it('aggiorna una riga allineata con competenza nel mese corrente', () => {
    const { aggiornate } = partizionaMensilitaPerCambioCanone([riga({ competenza: '2026-09-01' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(1);
  });

  it('non aggiorna una riga con importo diverso dal canone', () => {
    const { aggiornate, intatte } = partizionaMensilitaPerCambioCanone([riga({ imponibile: 300 })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(intatte).toHaveLength(1);
  });

  it('non aggiorna una riga di un mese passato', () => {
    const { aggiornate, intatte } = partizionaMensilitaPerCambioCanone([riga({ competenza: '2026-08-01' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(intatte).toHaveLength(1);
  });

  it('non aggiorna una riga già fatturata', () => {
    const { aggiornate, intatte } = partizionaMensilitaPerCambioCanone([riga({ stato: 'fatturato' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(intatte).toHaveLength(1);
  });

  it('restituisce due partizioni vuote quando nessuna riga è aggiornabile', () => {
    const righe = [
      riga({ imponibile: 300 }),
      riga({ stato: 'incassato' }),
      riga({ competenza: '2026-07-01' }),
    ];
    const { aggiornate, intatte } = partizionaMensilitaPerCambioCanone(righe, CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(intatte).toHaveLength(3);
  });

  it('confronta l\'imponibile come numero anche se arriva come stringa dal database', () => {
    const { aggiornate } = partizionaMensilitaPerCambioCanone(
      [riga({ imponibile: '350.00' as unknown as number })], CANONE, OGGI,
    );
    expect(aggiornate).toHaveLength(1);
  });
});

describe('imponibilePersonalizzato', () => {
  it('riconosce un importo diverso dal canone', () => {
    expect(imponibilePersonalizzato(riga({ imponibile: 300 }), CANONE)).toBe(true);
    expect(imponibilePersonalizzato(riga(), CANONE)).toBe(false);
  });
});
