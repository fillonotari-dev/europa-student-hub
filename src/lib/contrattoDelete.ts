import { supabase } from '@/integrations/supabase/client';

/**
 * Eliminazione di un contratto in BOZZA.
 *
 * Ordine obbligatorio, come nella edge function delete-candidatura: prima il
 * file dallo storage, poi la riga. Se lo storage fallisce ci si ferma senza
 * toccare il database, altrimenti resterebbe un PDF orfano nel bucket.
 *
 * I canoni spariscono in cascata e i campi del deposito stanno sulla stessa
 * riga. La riga di anagrafiche_fatturazione NON viene cancellata: è riusabile
 * ed è legata alla persona, non al singolo contratto.
 */
export async function eliminaContrattoBozza(contratto: {
  id: string;
  stato: string;
  file_firmato_path?: string | null;
}): Promise<void> {
  if (contratto.stato !== 'bozza') {
    throw new Error(`Solo i contratti in bozza possono essere eliminati (stato attuale: ${contratto.stato}).`);
  }

  if (contratto.file_firmato_path) {
    const { error } = await supabase.storage.from('contratti').remove([contratto.file_firmato_path]);
    if (error) {
      throw new Error(`Impossibile eliminare il PDF firmato dallo storage: ${error.message}. Il contratto non è stato toccato.`);
    }
  }

  const { error } = await supabase.from('contratti').delete().eq('id', contratto.id);
  if (error) throw new Error(error.message);
}
