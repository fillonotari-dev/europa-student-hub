import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/admin/contratti/anagraficaStudente', () => ({ caricaAnaStudente: vi.fn() }));
vi.mock('@/components/admin/contratti/AnagraficaFatturazioneFields', () => ({ payloadAnagrafica: vi.fn() }));
import {
  scegliAssegnazione, campiDaAssegnazione, garanteDaCandidatura, canoneDaListino,
  bloccantiAttivazione, motivoErroreBozza, DEPOSITO_DA_DEFINIRE, GIORNO_SCADENZA_PREDEFINITO,
} from '@/lib/precompilaContratto';

describe('precompilazione contratto', () => {
  it('sceglie la prima assegnazione non conclusa, altrimenti la più recente', () => {
    const a = [{ id: '1', data_inizio: '2025-01-01', data_fine: '2025-06-30' }, { id: '2', data_inizio: '2026-01-01', data_fine: '2026-12-31' }];
    expect(scegliAssegnazione(a, '2026-10-01')?.id).toBe('2');
    expect(scegliAssegnazione([a[0]], '2026-10-01')?.id).toBe('1');
    expect(scegliAssegnazione([], '2026-10-01')).toBeNull();
  });
  it('deriva i campi dall assegnazione', () => {
    expect(campiDaAssegnazione({ id: 'x', data_inizio: '2026-09-15', data_fine: null, camere: { tipo: 'singola', struttura_id: 's' } }))
      .toEqual({ assegnazioneId: 'x', dataInizio: '2026-09-15', dataFine: '', strutturaId: 's', tipoCamera: 'singola' });
  });
  it('garante vuoto senza candidatura', () => {
    expect(garanteDaCandidatura(null)).toEqual({ nome: '', relazione: '', telefono: '', email: '' });
    expect(garanteDaCandidatura({ garante_nome: 'Ada' }).nome).toBe('Ada');
  });
  it('canone dal listino oppure 0 con listino mancante', () => {
    expect(canoneDaListino({ importo_mensile_lordo: '550' })).toEqual({ lordo: 550, listinoMancante: false });
    expect(canoneDaListino(null)).toEqual({ lordo: 0, listinoMancante: true });
  });
  it('giorno di scadenza predefinito 15', () => { expect(GIORNO_SCADENZA_PREDEFINITO).toBe(15); });
  it('bloccanti: canone 0 e deposito da definire insieme', () => {
    expect(bloccantiAttivazione({ canone_mensile: 0, deposito_richiesto: false, deposito_motivo_esenzione: DEPOSITO_DA_DEFINIRE })).toHaveLength(2);
    expect(bloccantiAttivazione({ canone_mensile: 500, deposito_richiesto: false, deposito_motivo_esenzione: 'Borsa di studio' })).toEqual([]);
    expect(bloccantiAttivazione({ canone_mensile: 500, deposito_richiesto: true, deposito_motivo_esenzione: null })).toEqual([]);
  });
  it('motivo in italiano per durata oltre un anno', () => {
    expect(motivoErroreBozza({ message: 'violates check constraint "contratti_durata_max_chk"' })).toContain('supera un anno');
    expect(motivoErroreBozza(new Error('senza_data_fine'))).toContain('data di fine');
  });
});

import { contrattoCheEsclude } from '@/lib/precompilaContratto';
describe('contrattoCheEsclude', () => {
  it('nessun contratto: non esclude', () => { expect(contrattoCheEsclude('a1', [])).toBeNull(); });
  it('contratti chiusi non escludono', () => {
    expect(contrattoCheEsclude('a1', [{ id: 'c', stato: 'scaduto', assegnazione_id: 'a0' }])).toBeNull();
  });
  it('stessa assegnazione: esclude senza motivo', () => {
    expect(contrattoCheEsclude('a1', [{ id: 'c', stato: 'bozza', assegnazione_id: 'a1' }])).toEqual({ contrattoId: 'c', motivo: null });
  });
  it('bozza o attivo su altra assegnazione: esclude con motivo', () => {
    expect(contrattoCheEsclude('a1', [{ id: 'c', stato: 'attivo', assegnazione_id: 'a0' }])?.motivo)
      .toBe("ha già un contratto attivo collegato a un'altra assegnazione: verifica se serve un rinnovo o una sostituzione");
    expect(contrattoCheEsclude('a1', [{ id: 'c', stato: 'bozza', assegnazione_id: null }])?.motivo).toContain('contratto bozza');
  });
});
