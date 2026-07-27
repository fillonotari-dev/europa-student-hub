// Insieme fisso e definitivo dei tipi documento accettati dai form di candidatura.
// Condiviso fra submit-candidatura, complete-candidatura e upload-candidatura-doc:
// non ripetere l'elenco in altri file.

export const DOCUMENTO_TIPI = [
  "documento_identita",
  "certificato_iscrizione",
  "documento_garante",
  "documento_aggiuntivo",
] as const;

export type DocumentoTipo = typeof DOCUMENTO_TIPI[number];

export const DOCUMENTO_TIPI_SET: ReadonlySet<string> = new Set(DOCUMENTO_TIPI);

export function isDocumentoTipo(v: unknown): v is DocumentoTipo {
  return typeof v === "string" && DOCUMENTO_TIPI_SET.has(v);
}

// Percorso atteso in Storage: pending/{uuid}/{tipo}/{filename}
// Estrae il segmento tipo dal path; ritorna null se il path non è nel formato atteso.
export function extractTipoFromPath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "pending") return null;
  return parts[2] ?? null;
}