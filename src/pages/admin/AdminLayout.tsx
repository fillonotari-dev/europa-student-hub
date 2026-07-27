import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StrutturaFilterProvider, useStrutturaFilter } from '@/hooks/useStrutturaFilter';
import { PageTitleProvider, useResolvedPageTitle, usePageBackTo } from '@/hooks/usePageTitle';
import { StrutturaSelect } from '@/components/admin/StrutturaSelect';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AdminTopBar() {
  const title = useResolvedPageTitle();
  const backTo = usePageBackTo();
  const { strutturaId, setStrutturaId, strutture } = useStrutturaFilter();
  return (
    <header className="h-14 flex items-center gap-3 border-b bg-card/80 backdrop-blur-sm px-4">
      {backTo && (
        <Button asChild size="icon" variant="ghost" className="h-8 w-8 -ml-1">
          <Link to={backTo} aria-label="Torna alla lista"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
      )}
      <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>
      <div className="ml-auto">
        <StrutturaSelect value={strutturaId} onChange={setStrutturaId} strutture={strutture} />
      </div>
    </header>
  );
}

export default function AdminLayout() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const verify = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        navigate('/login');
        return;
      }
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setIsAdmin(false);
        setLoading(false);
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer Supabase calls to avoid deadlocks inside the callback
      setTimeout(() => { verify(session); }, 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { verify(session); });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Caricamento...</p></div>;
  }

  return (
    <SidebarProvider>
      <StrutturaFilterProvider>
        <PageTitleProvider>
          <div className="min-h-screen flex w-full">
            <AdminSidebar />
            <div className="flex-1 flex flex-col">
              <AdminTopBar />
              <main className="flex-1 p-6 bg-background">
                <Outlet />
              </main>
            </div>
          </div>
        </PageTitleProvider>
      </StrutturaFilterProvider>
    </SidebarProvider>
  );
}
