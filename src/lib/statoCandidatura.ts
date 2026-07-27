export const STATO_LABELS: Record<string, string> = {
  ricevuta: 'Ricevuta',
  in_completamento: 'In completamento',
  completata: 'Completata',
  approvata: 'Approvata',
  rifiutata: 'Rifiutata',
  ritirata: 'Rinuncia del candidato',
  sostituita: 'Sostituita',
};

export const STATO_COLORS: Record<string, string> = {
  ricevuta: 'bg-primary/10 text-primary',
  in_completamento: 'bg-accent/20 text-foreground',
  completata: 'bg-success/10 text-success',
  approvata: 'bg-success/10 text-success',
  rifiutata: 'bg-destructive/10 text-destructive',
  ritirata: 'bg-muted text-muted-foreground',
  sostituita: 'bg-muted text-muted-foreground',
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