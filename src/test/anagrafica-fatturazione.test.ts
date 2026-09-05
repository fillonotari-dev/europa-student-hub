import { describe, expect, it } from 'vitest';
import { rigaDestinazioneAnagrafica } from '@/lib/anagraficaFatturazione';

/**
 * Quale identità fiscale viene sovrascritta. Un caso per esito.
 */
describe('rigaDestinazioneAnagrafica', () => {
  it('studente con anagrafica esistente: aggiorna quella riga', () => {
    expect(
      rigaDestinazioneAnagrafica({
        modalita: 'studente',
        anagraficaStudenteId: 'ana-studente',
        anaCorrente: { id: 'ana-studente', studente_id: 'stu-1' },
      }),
    ).toEqual({ azione: 'aggiorna', id: 'ana-studente' });
  });

  it('studente, id non ancora caricato, anagrafica corrente dello studente: aggiorna quella riga', () => {
    expect(
      rigaDestinazioneAnagrafica({
        modalita: 'studente',
        anagraficaStudenteId: null,
        anaCorrente: { id: 'ana-studente', studente_id: 'stu-1' },
      }),
    ).toEqual({ azione: 'aggiorna', id: 'ana-studente' });
  });

  it('studente senza anagrafica: crea una riga nuova', () => {
    expect(
      rigaDestinazioneAnagrafica({
        modalita: 'studente',
        anagraficaStudenteId: null,
        anaCorrente: null,
      }),
    ).toEqual({ azione: 'crea', id: null });
  });

  it('terzo partendo da terzo: aggiorna quella riga', () => {
    expect(
      rigaDestinazioneAnagrafica({
        modalita: 'terzo',
        anagraficaStudenteId: 'ana-studente',
        anaCorrente: { id: 'ana-societa', studente_id: null },
      }),
    ).toEqual({ azione: 'aggiorna', id: 'ana-societa' });
  });

  it('da studente a terzo: crea una riga nuova e non tocca quella dello studente', () => {
    expect(
      rigaDestinazioneAnagrafica({
        modalita: 'terzo',
        anagraficaStudenteId: 'ana-studente',
        anaCorrente: { id: 'ana-studente', studente_id: 'stu-1' },
      }),
    ).toEqual({ azione: 'crea', id: null });
  });
});
