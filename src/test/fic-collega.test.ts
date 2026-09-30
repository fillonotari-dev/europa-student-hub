import { describe, it, expect } from 'vitest';
import {
  esisteFatturaDaRiconciliare, rifiutoDefinitivoFic, rispostaClient4xx, importiDocumento, stessoId, stessoImporto,
} from '../../supabase/functions/_shared/fic-collega';

describe('fic-collega', () => {
  it('confronta gli importi in centesimi', () => {
    expect(stessoImporto(0.1 + 0.2, 0.3)).toBe(true);
    expect(stessoImporto('450.00', 450)).toBe(true);
    expect(stessoImporto(450, 450.01)).toBe(false);
  });

  it('confronta gli id numericamente', () => {
    expect(stessoId('551793098', 551793098)).toBe(true);
    expect(stessoId(1, 2)).toBe(false);
    expect(stessoId(null, 1)).toBe(false);
  });

  it('legge gli importi coerenti e rifiuta quelli incoerenti', () => {
    expect(importiDocumento({ amount_net: 409.09, amount_vat: 40.91, amount_gross: 450 }))
      .toEqual({ imponibile: 409.09, iva: 40.91, totale: 450 });
    expect(importiDocumento({ amount_net: 400, amount_vat: 40, amount_gross: 450 })).toBeNull();
    expect(importiDocumento({ amount_net: 400, amount_vat: 40 })).toBeNull();
  });

  it('guardia doppioni', () => {
    expect(esisteFatturaDaRiconciliare([], new Set())).toBe(false);
    expect(esisteFatturaDaRiconciliare([{ id: 'a', stato: 'in_invio' }], new Set())).toBe(true);
    expect(esisteFatturaDaRiconciliare([{ id: 'a', stato: 'emessa' }], new Set())).toBe(true);
    expect(esisteFatturaDaRiconciliare([{ id: 'a', stato: 'emessa' }], new Set(['a']))).toBe(false);
    expect(esisteFatturaDaRiconciliare([{ id: 'a', stato: 'errore' }], new Set())).toBe(false);
  });
});

describe('classificazione delle risposte di Fatture in Cloud', () => {
  it('400, 409 e 422 sono rifiuti definitivi (il documento non esiste)', () => {
    for (const s of [400, 409, 422]) expect(rifiutoDefinitivoFic(s)).toBe(true);
  });
  it('gli altri esiti lasciano il dubbio', () => {
    for (const s of [401, 403, 404, 429, 500, 503, null]) expect(rifiutoDefinitivoFic(s)).toBe(false);
  });
  it('rispostaClient4xx copre tutto 400-499', () => {
    for (const s of [400, 404, 409, 499]) expect(rispostaClient4xx(s)).toBe(true);
    for (const s of [399, 500, null]) expect(rispostaClient4xx(s)).toBe(false);
  });
});
