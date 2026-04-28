import { LayoutDashboard, FileText, Users, DoorOpen, LogOut, History, ChevronDown, Home } from 'lucide-react';
import logoStudentato from '@/assets/logo-studentato.svg';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const items = [
  { title: 'Home', url: '/admin', icon: LayoutDashboard },
  { title: 'Candidature', url: '/admin/candidature', icon: FileText },
  { title: 'Residenti', url: '/admin/residenti', icon: Users },
  { title: 'Camere', url: '/admin/camere', icon: DoorOpen },
  { title: 'Strutture', url: '/admin/strutture', icon: Home },
];

const storicoItems = [
  { title: 'Candidature', url: '/admin/storico/candidature' },
  { title: 'Residenti', url: '/admin/storico/residenti' },
  { title: 'Camere', url: '/admin/storico/camere' },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const location = useLocation();
  const storicoOpen = location.pathname.startsWith('/admin/storico');

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
                <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain" />
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
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Storico (sub-menu) */}
              {collapsed ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/storico"
                      className="hover:bg-muted"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    >
                      <History className="mr-2 h-4 w-4" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <Collapsible defaultOpen={storicoOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-muted">
                        <History className="mr-2 h-4 w-4" />
                        <span>Storico</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {storicoItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={sub.url}
                                className="hover:bg-muted"
                                activeClassName="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                              >
                                <span>{sub.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
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
