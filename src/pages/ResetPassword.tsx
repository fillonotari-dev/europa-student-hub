import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logoStudentato from '@/assets/logo-studentato.svg';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Password troppo corta', description: 'Minimo 8 caratteri.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Le password non coincidono', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password aggiornata', description: 'Ora puoi accedere con la nuova password.' });
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoStudentato} alt="Studentato Europa" className="w-12 h-12 object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold">Reimposta password</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Scegli una nuova password</p>
        </div>
        {!ready ? (
          <p className="text-center text-[13px] text-muted-foreground">
            Link non valido o scaduto. Richiedi un nuovo link dalla pagina di login.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nuova password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" required minLength={8} />
            </div>
            <div>
              <Label>Conferma password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1.5" required minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Aggiorna password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}