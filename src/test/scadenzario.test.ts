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

  it('usa giorno_scadenza per la data di scadenza di ogni mese', () => {
    const r = generaScadenzario({ ...base, giornoScadenza: 10, dataInizio: '2026-09-01', dataFine: '2026-11-30' });
    expect(r.map(x => x.scadenza)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
  });

  it('non restituisce mai il campo totale', () => {
    const r = generaScadenzario({ ...base, dataInizio: '2026-09-01', dataFine: '2026-10-31' });
    for (const riga of r) expect(Object.keys(riga)).not.toContain('totale');
  });
});
