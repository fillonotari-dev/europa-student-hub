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
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone([riga()], CANONE, OGGI);
    expect(aggiornate).toHaveLength(1);
    expect(protette).toHaveLength(0);
    expect(fuoriPerimetro).toHaveLength(0);
  });

  it('aggiorna una riga allineata con competenza nel mese corrente', () => {
    const { aggiornate } = partizionaMensilitaPerCambioCanone([riga({ competenza: '2026-09-01' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(1);
  });

  it('protegge una riga da_fatturare futura con importo diverso dal canone', () => {
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone([riga({ imponibile: 300 })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(1);
    expect(fuoriPerimetro).toHaveLength(0);
  });

  it('una riga di un mese passato finisce in fuoriPerimetro', () => {
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone([riga({ competenza: '2026-08-01' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(0);
    expect(fuoriPerimetro).toHaveLength(1);
  });

  it('una riga da_fatturare di un mese passato con importo diverso finisce in fuoriPerimetro, non in protette', () => {
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone(
      [riga({ competenza: '2026-08-01', imponibile: 300 })], CANONE, OGGI,
    );
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(0);
    expect(fuoriPerimetro).toHaveLength(1);
  });

  it('una riga già fatturata finisce in fuoriPerimetro', () => {
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone([riga({ stato: 'fatturato' })], CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(0);
    expect(fuoriPerimetro).toHaveLength(1);
  });

  it('una riga fatturato con importo diverso dal canone finisce in fuoriPerimetro, non in protette', () => {
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone(
      [riga({ stato: 'fatturato', imponibile: 300 })], CANONE, OGGI,
    );
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(0);
    expect(fuoriPerimetro).toHaveLength(1);
  });

  it('protette e fatturate sono insiemi disgiunti: i conteggi non si sovrappongono', () => {
    const righe = [
      riga({ imponibile: 300 }),                       // protetta
      riga({ competenza: '2026-11-01', imponibile: 320 }), // protetta
      riga({ stato: 'fatturato', imponibile: 350 }),   // fuoriPerimetro
      riga({ stato: 'fatturato', imponibile: 340 }),   // fuoriPerimetro (importo diverso, ma fatturata)
      riga({ competenza: '2026-12-01' }),              // aggiornata
    ];
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone(righe, CANONE, OGGI);
    expect(aggiornate).toHaveLength(1);
    expect(protette).toHaveLength(2);
    expect(fuoriPerimetro).toHaveLength(2);
    // Nessuna riga compare in più di un gruppo.
    const tutte = [...aggiornate, ...protette, ...fuoriPerimetro];
    expect(new Set(tutte).size).toBe(righe.length);
  });

  it('restituisce tre partizioni con aggiornate vuote quando nessuna riga è aggiornabile', () => {
    const righe = [
      riga({ imponibile: 300 }),
      riga({ stato: 'incassato' }),
      riga({ competenza: '2026-07-01' }),
    ];
    const { aggiornate, protette, fuoriPerimetro } = partizionaMensilitaPerCambioCanone(righe, CANONE, OGGI);
    expect(aggiornate).toHaveLength(0);
    expect(protette).toHaveLength(1);
    expect(fuoriPerimetro).toHaveLength(2);
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
