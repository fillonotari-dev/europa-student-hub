import { describe, expect, it } from 'vitest';
import { coperturaMese, etichettaCopertura, giorniDelMese } from '@/lib/coperturaMese';

describe('giorniDelMese', () => {
  it('riconosce i mesi di 31, 30 e 28 giorni', () => {
    expect(giorniDelMese('2026-01-01')).toBe(31);
    expect(giorniDelMese('2026-09-01')).toBe(30);
    expect(giorniDelMese('2026-02-01')).toBe(28);
  });

  it('riconosce febbraio bisestile', () => {
    expect(giorniDelMese('2028-02-01')).toBe(29);
  });

  it('gestisce dicembre senza sconfinare nell\'anno dopo', () => {
    expect(giorniDelMese('2026-12-01')).toBe(31);
  });
});

describe('coperturaMese', () => {
  it('dichiara intero un mese interamente compreso nel periodo', () => {
    const c = coperturaMese('2026-10-01', '2026-09-15', '2027-06-30');
    expect(c).toEqual({ giorniMese: 31, giorniCoperti: 31, parziale: false });
  });

  it('conta i giorni del primo mese parziale', () => {
    const c = coperturaMese('2026-09-01', '2026-09-14', '2027-06-30');
    expect(c.giorniCoperti).toBe(17);
    expect(c.giorniMese).toBe(30);
    expect(c.parziale).toBe(true);
    expect(etichettaCopertura(c)).toBe('17 giorni su 30');
  });

  it('conta i giorni dell\'ultimo mese parziale', () => {
    const c = coperturaMese('2027-06-01', '2026-09-01', '2027-06-10');
    expect(c).toEqual({ giorniMese: 30, giorniCoperti: 10, parziale: true });
  });

  it('conta i giorni di un mese unico coperto solo in parte', () => {
    const c = coperturaMese('2026-09-01', '2026-09-05', '2026-09-28');
    expect(c.giorniCoperti).toBe(24);
    expect(etichettaCopertura(c)).toBe('24 giorni su 30');
  });

  it('un mese di 31 giorni coperto per intero non è parziale', () => {
    const c = coperturaMese('2026-01-01', '2026-01-01', '2026-01-31');
    expect(c.parziale).toBe(false);
    expect(etichettaCopertura(c)).toBeNull();
  });

  it('febbraio coperto fino al 28 non è parziale in un anno comune', () => {
    expect(coperturaMese('2026-02-01', '2026-01-01', '2026-02-28').parziale).toBe(false);
    expect(coperturaMese('2028-02-01', '2028-01-01', '2028-02-28').parziale).toBe(true);
  });

  it('senza estremi noti dichiara il mese intero', () => {
    expect(coperturaMese('2026-09-01', null, null).parziale).toBe(false);
  });

  it('restituisce zero giorni per un mese fuori dal periodo', () => {
    expect(coperturaMese('2026-05-01', '2026-09-01', '2027-06-30').giorniCoperti).toBe(0);
  });
});
