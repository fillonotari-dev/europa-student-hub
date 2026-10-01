import { describe, it, expect } from 'vitest';
import { etichettaSdi, STATO_FATTURA, SDI_DA_RIEMETTERE } from '@/lib/statiFatturazione';

describe('etichettaSdi', () => {
  it('not_sent → Da emettere', () => {
    expect(etichettaSdi('not_sent', 'ABC1234').etichetta).toBe('Da emettere');
  });
  it.each(['attempt', 'sent', 'pending', 'processing'])('%s → in attesa di esito (successo)', (s) => {
    const v = etichettaSdi(s, 'ABC1234');
    expect(v.etichetta).toBe('Emessa, in attesa di esito');
    expect(v.classi).toContain('success');
    expect(v.nota).toBeUndefined();
  });
  it('accepted → consegnata', () => {
    expect(etichettaSdi('accepted', 'ABC1234').etichetta).toBe('Emessa e consegnata');
  });
  it('not_delivered con 0000000 → cassetto fiscale, con spiegazione', () => {
    const v = etichettaSdi('not_delivered', '0000000');
    expect(v.etichetta).toBe('Emessa · nel cassetto fiscale dello studente');
    expect(v.classi).toContain('success');
    expect(v.spiegazione).toBeTruthy();
  });
  it('not_delivered con codice reale o PEC → Recapito non riuscito (attenzione, non destructive)', () => {
    for (const c of ['ABC1234', null]) {
      const v = etichettaSdi('not_delivered', c);
      expect(v.etichetta).toBe('Recapito non riuscito');
      expect(v.classi).toContain('warning');
      expect(v.classi).not.toContain('destructive');
    }
  });
  it('XXXXXXX aggiunge la copia da inviare', () => {
    expect(etichettaSdi('accepted', 'XXXXXXX').nota).toBe('copia da inviare allo studente');
    expect(etichettaSdi('sent', 'xxxxxxx').nota).toBe('copia da inviare allo studente');
    expect(etichettaSdi('not_delivered', 'XXXXXXX').nota).toBe('copia da inviare allo studente');
  });
  it.each(['discarded', 'error'])('%s → Scartata (destructive)', (s) => {
    const v = etichettaSdi(s, 'ABC1234');
    expect(v.etichetta).toBe('Scartata dallo SDI: va riemessa');
    expect(v.classi).toContain('destructive');
  });
  it('null → trattino; valore ignoto → grezzo', () => {
    expect(etichettaSdi(null).etichetta).toBe('—');
    expect(etichettaSdi('valore_ignoto').etichetta).toBe('valore_ignoto');
  });
  it.each([
    ['rejected', 'Rifiutata dal destinatario: va riemessa', 'destructive'],
    ['manual_rejected', 'Rifiutata (esito manuale): va riemessa', 'destructive'],
    ['no_response', 'Emessa, nessuna risposta dal destinatario', 'success'],
    ['manual_accepted', 'Emessa e consegnata (esito manuale)', 'success'],
    ['missing', 'Stato non disponibile', 'bg-muted text-foreground'],
  ])('%s → %s', (s, etichetta, classe) => {
    const v = etichettaSdi(s, 'ABC1234');
    expect(v.etichetta).toBe(etichetta);
    expect(v.classi).toContain(classe);
  });
  it('SDI_DA_RIEMETTERE: scartate e rifiutate, non le altre', () => {
    for (const s of ['discarded', 'error', 'rejected', 'manual_rejected']) expect(SDI_DA_RIEMETTERE.has(s)).toBe(true);
    for (const s of ['no_response', 'manual_accepted', 'missing', 'accepted', 'not_sent']) expect(SDI_DA_RIEMETTERE.has(s)).toBe(false);
  });
  it('STATO_FATTURA ha Annullata', () => {
    expect(STATO_FATTURA.annullata.etichetta).toBe('Annullata');
  });
});
