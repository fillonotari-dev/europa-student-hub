import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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