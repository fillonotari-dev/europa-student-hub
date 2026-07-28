export const STATO_LABELS: Record<string, string> = {
  da_valutare: 'Da valutare',
  in_attesa_studente: 'In attesa dello studente',
  da_decidere: 'Da decidere',
  accolta: 'Accolta',
  in_attesa_posto: 'In attesa di posto',
  rifiutata: 'Rifiutata',
};

export const STATO_COLORS: Record<string, string> = {
  da_valutare: 'bg-primary/10 text-primary',
  in_attesa_studente: 'bg-accent/20 text-foreground',
  da_decidere: 'bg-warning/10 text-warning',
  accolta: 'bg-success/10 text-success',
  in_attesa_posto: 'bg-accent/20 text-foreground',
  rifiutata: 'bg-destructive/10 text-destructive',
};

/**
 * Restituisce l'etichetta leggibile di uno stato. Se lo stato non è mappato
 * (dati storici, stati rimossi dal ciclo di vita) rende comunque una stringa
 * leggibile evitando di mostrare il tecnicismo grezzo.
 */
export function formatStato(value: string | null | undefined): string {
  if (!value) return '—';
  if (STATO_LABELS[value]) return STATO_LABELS[value];
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}