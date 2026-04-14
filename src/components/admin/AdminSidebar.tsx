import { Building2, LayoutDashboard, FileText, Users, DoorOpen, Download, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Candidature', url: '/admin/candidature', icon: FileText },
  { title: 'Studenti', url: '/admin/studenti', icon: Users },
  { title: 'Camere', url: '/admin/camere', icon: DoorOpen },
  { title: 'Esportazione', url: '/admin/esportazione', icon: Download },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-card/95 backdrop-blur-md">
      <SidebarContent>
        <SidebarGroup>
          <div className="px-3 py-4 mb-2">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold">Studentato Europa</p>
                  <p className="text-[11px] text-muted-foreground">Gestionale</p>
                </div>
              </div>
            )}
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
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
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
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Esci</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
