import { describe, expect, it } from 'vitest';
import { generaScadenzario } from '@/lib/scadenzario';

const base = { canoneMensile: 350, aliquotaIva: 10, giornoScadenza: 1 };

describe('generaScadenzario', () => {
  it('genera 12 righe per un anno pieno', () => {
    const r = generaScadenzario({ ...base, dataInizio: '2026-09-01', dataFine: '2027-08-31' });
    expect(r).toHaveLength(12);
    expect(r[0].competenza).toBe('2026-09-01');
    expect(r[11].competenza).toBe('2027-08-01');
  });

  it('genera 4 righe a canone intero per un periodo con mesi parziali', () => {
    const r = generaScadenzario({ ...base, dataInizio: '2026-09-15', dataFine: '2026-12-20' });
    expect(r.map(x => x.competenza)).toEqual([
      '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    ]);
    expect(r.every(x => x.imponibile === 350)).toBe(true);
  });

  it('genera una sola riga per un periodo dentro un solo mese', () => {
    const r = generaScadenzario({ ...base, dataInizio: '2026-09-05', dataFine: '2026-09-28' });
    expect(r).toHaveLength(1);
    expect(r[0].competenza).toBe('2026-09-01');
  });

  it('scade il giorno_scadenza del mese successivo alla competenza', () => {
    const r = generaScadenzario({ ...base, giornoScadenza: 10, dataInizio: '2026-09-01', dataFine: '2026-11-30' });
    expect(r.map(x => x.scadenza)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
  });

  it('gestisce il passaggio d\'anno: dicembre 2026 scade a gennaio 2027', () => {
    const r = generaScadenzario({ ...base, giornoScadenza: 5, dataInizio: '2026-12-01', dataFine: '2026-12-31' });
    expect(r).toHaveLength(1);
    expect(r[0].competenza).toBe('2026-12-01');
    expect(r[0].scadenza).toBe('2027-01-05');
  });

  it('con giorno 28 una competenza di gennaio scade il 28 febbraio', () => {
    const r = generaScadenzario({ ...base, giornoScadenza: 28, dataInizio: '2027-01-01', dataFine: '2027-01-31' });
    expect(r[0].scadenza).toBe('2027-02-28');
  });

  it('un contratto di un solo mese scade nel mese dopo data_fine', () => {
    const r = generaScadenzario({ ...base, giornoScadenza: 15, dataInizio: '2026-08-10', dataFine: '2026-08-31' });
    expect(r).toHaveLength(1);
    expect(r[0].scadenza).toBe('2026-09-15');
  });

  it('non restituisce mai il campo totale', () => {
    const r = generaScadenzario({ ...base, dataInizio: '2026-09-01', dataFine: '2026-10-31' });
    for (const riga of r) expect(Object.keys(riga)).not.toContain('totale');
  });
});
