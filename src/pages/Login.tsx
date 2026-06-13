import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logoStudentato from '@/assets/logo-studentato.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Credenziali non valide', variant: 'destructive' });
    } else {
      navigate('/admin');
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email inviata', description: "Se l'email è registrata, riceverai un link per reimpostare la password." });
      setMode('login');
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoStudentato} alt="Studentato Europa" className="w-12 h-12 object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold">Studentato Europa</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Pannello di gestione</p>
        </div>
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5" required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Accesso...' : 'Accedi'}
            </Button>
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="block w-full text-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Password dimenticata?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="mt-1.5" required />
              <p className="text-[12px] text-muted-foreground mt-1.5">Ti invieremo un link per reimpostare la password.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Invio...' : 'Invia link di recupero'}
            </Button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="block w-full text-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Torna al login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
