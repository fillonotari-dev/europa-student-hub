import { describe, it, expect } from 'vitest';
import {
  imponibileDaLordo,
  lordoDaImponibile,
  scomposizione,
  imponibileCentDaLordoCent,
  totaleCentDaImponibileCent,
} from '@/lib/iva';

describe('conversione IVA inclusa / imponibile', () => {
  it('350 € lordi al 10% danno imponibile 318,18 e tornano a 350,00', () => {
    expect(imponibileDaLordo(350, 10)).toBe(318.18);
    expect(lordoDaImponibile(318.18, 10)).toBe(350);
  });

  it('450 € lordi al 10% danno imponibile 409,09 e tornano a 450,00', () => {
    expect(imponibileDaLordo(450, 10)).toBe(409.09);
    expect(lordoDaImponibile(409.09, 10)).toBe(450);
  });

  it('500 € lordi al 10% danno 454,55 e un totale di 500,01: comportamento atteso', () => {
    // La conversione non è idempotente: l'arrotondamento a due decimali
    // dell'imponibile può spostare il totale di un centesimo. Va dichiarato
    // all'operatore, non "corretto".
    const s = scomposizione(500, 10);
    expect(s.imponibile).toBe(454.55);
    expect(s.totale).toBe(500.01);
    expect(s.iva).toBe(45.46);
  });

  it('l\'IVA è sempre la differenza fra totale e imponibile', () => {
    for (const lordo of [1, 33.33, 350, 500, 999.99]) {
      const s = scomposizione(lordo, 10);
      expect(Math.round(s.iva * 100)).toBe(Math.round(s.totale * 100) - Math.round(s.imponibile * 100));
    }
  });

  it('proprietà: da 1 a 1000 € al 10% il totale coincide con la colonna generata', () => {
    // Oracolo = formula reale di canoni.totale:
    //   round(imponibile * (1 + aliquota_iva / 100), 2)
    // Non "imponibile + round(iva, 2)": le due formulazioni non coincidono
    // sempre, e in fattura finisce quella della colonna generata.
    for (let e = 1; e <= 1000; e++) {
      const s = scomposizione(e, 10);
      const impCent = imponibileCentDaLordoCent(e * 100, 10);
      const attesoCent = totaleCentDaImponibileCent(impCent, 10);
      expect(Math.round(s.imponibile * 100)).toBe(impCent);
      expect(Math.round(s.totale * 100)).toBe(attesoCent);
      expect(Math.round(s.iva * 100)).toBe(attesoCent - impCent);
    }
  });
});
