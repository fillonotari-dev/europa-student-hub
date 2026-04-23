import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { value: 'candidature', label: 'Candidature' },
  { value: 'residenti', label: 'Residenti' },
  { value: 'camere', label: 'Camere' },
];

export default function StoricoLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((t) => location.pathname.endsWith(`/storico/${t.value}`))?.value ?? 'candidature';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Storico</h1>
            <p className="text-sm text-muted-foreground">
              Registri storici di candidature, residenti e camere
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs value={current} onValueChange={(v) => navigate(`/admin/storico/${v}`)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}