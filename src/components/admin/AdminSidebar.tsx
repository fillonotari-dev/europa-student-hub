import { LayoutDashboard, FileText, Users, DoorOpen, LogOut, Home, Settings, FileSignature } from 'lucide-react';
import logoStudentato from '@/assets/logo-studentato.svg';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Home', url: '/admin', icon: LayoutDashboard },
  { title: 'Candidature', url: '/admin/candidature', icon: FileText },
  { title: 'Residenti', url: '/admin/residenti', icon: Users },
  { title: 'Contratti', url: '/admin/contratti', icon: FileSignature },
  { title: 'Camere', url: '/admin/camere', icon: DoorOpen },
  { title: 'Strutture', url: '/admin/strutture', icon: Home },
  { title: 'Impostazioni', url: '/admin/impostazioni', icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-card/95 backdrop-blur-md">
      <SidebarContent>
        <SidebarGroup>
          <div className={`py-4 mb-2 flex items-center gap-2 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            {!collapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain shrink-0" />
                <p className="text-sm font-bold truncate">Studentato Europa</p>
              </div>
            )}
            <SidebarTrigger />
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin'}
                      className="hover:bg-muted"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    >
                      <item.icon className={`h-4 w-4 ${collapsed ? '' : 'mr-2'}`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <LogOut className={`h-4 w-4 ${collapsed ? '' : 'mr-2'}`} />
              {!collapsed && <span>Esci</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
