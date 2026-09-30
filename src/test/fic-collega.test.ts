import { describe, it, expect } from 'vitest';
import {
  esisteFatturaDaRiconciliare, importiDocumento, stessoId, stessoImporto,
} from '@shared/fic-collega.ts';

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
