// Sposta un documento caricato dallo studente dalla cartella temporanea
// `pending/{temp_id}/{tipo}/{filename}` alla posizione definitiva legata
// alla candidatura: `candidature/{candidatura_id}/{tipo}/{filename}`.
//
// Il filename viene sempre preso dall'ultimo segmento del path di origine
// (già sanificato dalla edge function di upload). Nessun fallback su altri
// campi.
//
// In caso di errore NON solleva: logga e restituisce il path originale, così
// il chiamante può registrarlo comunque nella tabella `documenti`.

const BUCKET = "documenti_studenti";

export interface MoveResult {
  path: string;
  moved: boolean;
  error?: string;
}

export async function moveDocumentToFinal(
  supabase: any,
  args: { tempPath: string; candidaturaId: string; tipo: string },
): Promise<MoveResult> {
  const { tempPath, candidaturaId, tipo } = args;
  const filename = tempPath.split("/").pop() ?? "";
  if (!filename) {
    console.error("moveDocumentToFinal: filename vuoto", { tempPath });
    return { path: tempPath, moved: false, error: "filename_vuoto" };
  }
  const finalPath = `candidature/${candidaturaId}/${tipo}/${filename}`;
  if (tempPath === finalPath) {
    return { path: finalPath, moved: true };
  }
  try {
    const { error } = await supabase.storage.from(BUCKET).move(tempPath, finalPath);
    if (error) {
      console.error("moveDocumentToFinal: storage.move fallita", {
        tempPath, finalPath, error: error.message ?? String(error),
      });
      return { path: tempPath, moved: false, error: error.message ?? String(error) };
    }
    return { path: finalPath, moved: true };
  } catch (e) {
    console.error("moveDocumentToFinal: eccezione", {
      tempPath, finalPath, error: e instanceof Error ? e.message : String(e),
    });
    return { path: tempPath, moved: false, error: e instanceof Error ? e.message : String(e) };
  }
}