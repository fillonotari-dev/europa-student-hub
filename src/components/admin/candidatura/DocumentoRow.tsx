import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Download, FileIcon } from 'lucide-react';

const TIPO_DOC_LABELS: Record<string, string> = {
  documento_identita: 'Documento di identità',
  certificato_iscrizione: 'Certificato di iscrizione',
  documento_garante: 'Documento garante',
  documento_aggiuntivo: 'Documento aggiuntivo',
};

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const marker = '/documenti_studenti/';
  const idx = url.indexOf(marker);
  let path = idx === -1 ? url : url.substring(idx + marker.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.substring(0, q);
  try { path = decodeURIComponent(path); } catch {}
  return path;
}

export function DocumentoRow({ doc }: { doc: any }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<'open' | 'download' | null>(null);
  const path = extractStoragePath(doc.url);
  const label = TIPO_DOC_LABELS[doc.tipo] || doc.tipo || 'Documento';

  const getSignedUrl = async (download = false) => {
    if (!path) throw new Error('Percorso file non valido');
    const { data, error } = await supabase.storage
      .from('documenti_studenti')
      .createSignedUrl(path, 60, download ? { download: doc.nome_file } : undefined);
    if (error || !data?.signedUrl) throw error ?? new Error('Impossibile generare il link');
    return data.signedUrl;
  };

  const handleOpen = async () => {
    try { setLoading('open'); const url = await getSignedUrl(false); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e: any) { toast({ title: 'Errore', description: e?.message ?? 'Impossibile aprire il file', variant: 'destructive' }); }
    finally { setLoading(null); }
  };

  const handleDownload = async () => {
    try {
      setLoading('download');
      const url = await getSignedUrl(true);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nome_file;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Impossibile scaricare il file', variant: 'destructive' });
    } finally { setLoading(null); }
  };

  return (
    <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <FileIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{doc.nome_file}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="outline" onClick={handleOpen} disabled={loading !== null || !path}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          {loading === 'open' ? '...' : 'Apri'}
        </Button>
        <Button size="sm" onClick={handleDownload} disabled={loading !== null || !path}>
          <Download className="w-3.5 h-3.5 mr-1" />
          {loading === 'download' ? '...' : 'Scarica'}
        </Button>
      </div>
    </div>
  );
}