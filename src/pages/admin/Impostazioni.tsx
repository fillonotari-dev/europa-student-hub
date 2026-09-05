import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';
import { ListiniSection } from '@/components/admin/impostazioni/ListiniSection';
import { FattureInCloudSection } from '@/components/admin/impostazioni/FattureInCloudSection';

const PHONE_RE = /^[+\d][\d\s().\-]{4,30}$/;

const schema = z.object({
  contatto_email: z.string().trim().max(255).email({ message: 'Email di contatto non valida' }).or(z.literal('')),
  contatto_telefono: z.string().trim().max(40).regex(PHONE_RE, 'Telefono non valido').or(z.literal('')),
  contatto_whatsapp: z.string().trim().max(40).regex(PHONE_RE, 'WhatsApp non valido').or(z.literal('')),
  contatto_orari: z.string().trim().max(200).or(z.literal('')),
  notifica_email: z.string().trim().max(255).email({ message: 'Email per notifiche non valida' }).or(z.literal('')),
});

type Form = z.infer<typeof schema>;

const EMPTY: Form = {
  contatto_email: '',
  contatto_telefono: '',
  contatto_whatsapp: '',
  contatto_orari: '',
  notifica_email: '',
};

export default function Impostazioni() {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('impostazioni')
        .select('contatto_email, contatto_telefono, contatto_whatsapp, contatto_orari, notifica_email')
        .eq('id', 1)
        .maybeSingle();
      if (error) {
        toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      } else if (data) {
        setForm({
          contatto_email: data.contatto_email ?? '',
          contatto_telefono: data.contatto_telefono ?? '',
          contatto_whatsapp: data.contatto_whatsapp ?? '',
          contatto_orari: data.contatto_orari ?? '',
          notifica_email: data.notifica_email ?? '',
        });
      }
      setLoading(false);
    })();
  }, [toast]);

  const setField = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof Form, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Form;
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      toast({ title: 'Controlla i campi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('impostazioni')
      .upsert({ id: 1, ...parsed.data }, { onConflict: 'id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Impostazioni salvate' });
    }
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <div className="max-w-3xl">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="contatto_email">Email di contatto</Label>
            <Input
              id="contatto_email"
              type="email"
              value={form.contatto_email}
              onChange={(e) => setField('contatto_email', e.target.value)}
              placeholder="info@studentatoeuropa.it"
            />
            {errors.contatto_email && <p className="text-[12px] text-destructive">{errors.contatto_email}</p>}
            <p className="text-[11px] text-muted-foreground">Mostrata nelle email inviate ai candidati.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contatto_telefono">Telefono</Label>
              <Input
                id="contatto_telefono"
                value={form.contatto_telefono}
                onChange={(e) => setField('contatto_telefono', e.target.value)}
                placeholder="+39 0522 000000"
              />
              {errors.contatto_telefono && <p className="text-[12px] text-destructive">{errors.contatto_telefono}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contatto_whatsapp">WhatsApp</Label>
              <Input
                id="contatto_whatsapp"
                value={form.contatto_whatsapp}
                onChange={(e) => setField('contatto_whatsapp', e.target.value)}
                placeholder="+39 333 0000000"
              />
              {errors.contatto_whatsapp && <p className="text-[12px] text-destructive">{errors.contatto_whatsapp}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contatto_orari">Orari</Label>
            <Input
              id="contatto_orari"
              value={form.contatto_orari}
              onChange={(e) => setField('contatto_orari', e.target.value)}
              placeholder="Lun–Ven 9:00–18:00"
            />
            {errors.contatto_orari && <p className="text-[12px] text-destructive">{errors.contatto_orari}</p>}
          </div>

          <div className="space-y-1.5 pt-2 border-t">
            <Label htmlFor="notifica_email">Email per notifiche interne</Label>
            <Input
              id="notifica_email"
              type="email"
              value={form.notifica_email}
              onChange={(e) => setField('notifica_email', e.target.value)}
              placeholder="studentatoeuropa@gmail.com"
            />
            {errors.notifica_email && <p className="text-[12px] text-destructive">{errors.notifica_email}</p>}
            <Alert className="mt-2">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-[12px]">
                Se questo indirizzo marca le notifiche come spam o si disiscrive, gli invii si interrompono
                senza segnalazione: usa una casella monitorata.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ListiniSection />
      <FattureInCloudSection />
    </div>
  );
}