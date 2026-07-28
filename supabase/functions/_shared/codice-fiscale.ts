// Codice Fiscale italiano: validazione con carattere di controllo e omocodia.
// Sorgente unica condivisa fra edge function e frontend (import via @shared/codice-fiscale).
// Riferimento algoritmo: DM 23 dicembre 1976, tabelle di trasformazione dispari/pari.

// Nelle sette posizioni "numeriche" (0-indexed 6,7,9,10,12,13,14) le cifre possono
// essere state sostituite da lettere per risolvere collisioni (omocodia).
const OMOCODIA_MAP: Record<string, string> = {
  L: "0", M: "1", N: "2", P: "3", Q: "4",
  R: "5", S: "6", T: "7", U: "8", V: "9",
};
const NUMERIC_POSITIONS = [6, 7, 9, 10, 12, 13, 14] as const;

// Tabella caratteri in posizione DISPARI (1-indexed 1,3,...,15 → 0-indexed 0,2,...,14)
const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
// Tabella caratteri in posizione PARI: cifre → sé stesse, lettere → indice alfabetico.
function evenValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  return c.charCodeAt(0) - 65; // A=0, ..., Z=25
}

export type CfValidationResult = { ok: boolean; normalized: string };

export function validateCodiceFiscale(input: unknown): CfValidationResult {
  if (typeof input !== "string") return { ok: false, normalized: "" };
  const cf = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{16}$/.test(cf)) return { ok: false, normalized: cf };

  // Normalizza omocodia: nelle posizioni numeriche, sostituisci le lettere
  // di omocodia con la cifra corrispondente prima di calcolare il check.
  const chars = cf.split("");
  for (const pos of NUMERIC_POSITIONS) {
    const c = chars[pos];
    if (c >= "A" && c <= "Z") {
      const digit = OMOCODIA_MAP[c];
      if (digit === undefined) return { ok: false, normalized: cf };
      chars[pos] = digit;
    }
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = chars[i];
    if (i % 2 === 0) {
      // Posizione dispari 1-indexed
      const v = ODD[c];
      if (v === undefined) return { ok: false, normalized: cf };
      sum += v;
    } else {
      sum += evenValue(c);
    }
  }
  const expected = String.fromCharCode(65 + (sum % 26));
  return { ok: expected === cf.charAt(15), normalized: cf };
}