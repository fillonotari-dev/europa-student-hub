// Modulo condiviso: recapiti pubblici e email di notifica interna.
// Fallback per campo (mai per riga): un valore mancante non azzera gli altri.
// Se la lettura fallisce, uso tutti i default e loggo l'errore — un problema
// di configurazione non deve mai impedire l'invio di un'email.

export const CONTATTI_DEFAULT = {
  contatto_email: '',
  contatto_telefono: '',
  contatto_whatsapp: '',
  contatto_orari: '',
  notifica_email: 'studentatoeuropa@gmail.com',
} as const

export type Contatti = {
  contatto_email: string
  contatto_telefono: string
  contatto_whatsapp: string
  contatto_orari: string
  notifica_email: string
}

function normStr(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.trim()
}

export async function getContatti(supabase: any): Promise<Contatti> {
  try {
    const { data, error } = await supabase
      .from('impostazioni')
      .select('contatto_email, contatto_telefono, contatto_whatsapp, contatto_orari, notifica_email')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      console.error('getContatti: read error', error)
      return { ...CONTATTI_DEFAULT }
    }
    const row = data ?? {}
    return {
      // Recapiti verso il candidato: mai inventare valori. Se in Impostazioni
      // il campo è vuoto, il template lo nasconde (ContattiBlock).
      contatto_email: normStr((row as any).contatto_email),
      contatto_telefono: normStr((row as any).contatto_telefono),
      contatto_whatsapp: normStr((row as any).contatto_whatsapp),
      contatto_orari: normStr((row as any).contatto_orari),
      // Notifiche interne: fallback per non perderle se il campo è vuoto.
      notifica_email: normStr((row as any).notifica_email) || CONTATTI_DEFAULT.notifica_email,
    }
  } catch (e) {
    console.error('getContatti: exception', e)
    return { ...CONTATTI_DEFAULT }
  }
}

// Ripulisce il numero WhatsApp e restituisce un URL wa.me valido, o null.
export function whatsappUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/[^\d]/g, '')
  if (digits.length < 6) return null
  return `https://wa.me/${digits}`
}