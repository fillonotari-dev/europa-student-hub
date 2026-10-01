import { describe, it, expect } from 'vitest';
import { mesePredefinito, mesePrecedente, meseSuccessivo } from '../lib/meseFatturazione';
import { STATO_CANONE, STATO_FATTURA, voceStato } from '../lib/statiFatturazione';

describe('mesePredefinito', () => {
  it('senza arretrati propone il mese precedente', () => {
    expect(mesePredefinito('2026-10-01', null)).toBe('2026-09');
  });
  it('un arretrato più vecchio vince', () => {
    expect(mesePredefinito('2026-10-01', '2026-07-01')).toBe('2026-07');
  });
  it('gennaio propone dicembre dell\'anno prima', () => {
    expect(mesePredefinito('2027-01-15', null)).toBe('2026-12');
  });
  it('non propone mai il mese corrente né un futuro', () => {
    expect(mesePredefinito('2026-10-01', '2026-10-01')).toBe('2026-09');
    expect(mesePredefinito('2026-10-01', '2026-12-01')).toBe('2026-09');
  });
  it('mese precedente e successivo attraversano l\'anno', () => {
    expect(mesePrecedente('2026-01')).toBe('2025-12');
    expect(meseSuccessivo('2026-12')).toBe('2027-01');
  });
});

describe('mappe di stato', () => {
  it('coprono tutto il dominio', () => {
    expect(Object.keys(STATO_FATTURA).sort()).toEqual(['annullata', 'emessa', 'errore', 'in_invio']);
    expect(Object.keys(STATO_CANONE).sort()).toEqual(['annullato', 'da_fatturare', 'fatturato', 'incassato']);
  });
  it('emessa è neutra e si legge come creata', () => {
    expect(STATO_FATTURA.emessa.etichetta).toBe('Creata su Fatture in Cloud');
    expect(STATO_FATTURA.emessa.classi).not.toMatch(/success/);
  });
  it('ripiego sul valore grezzo', () => {
    expect(voceStato(STATO_FATTURA, 'sconosciuto').etichetta).toBe('sconosciuto');
  });
});
