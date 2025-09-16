"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Users,
  Clock,
  FileText,
  Settings,
  BarChart3,
  MessageSquare,
  Home,
  Building2,
  Bot,
  Timer,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/contexts/navigation-context";
import { useAuth } from "@/contexts/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Membres",
    url: "/employees",
    icon: Users,
  },
  {
    title: "Départements",
    url: "/departments",
    icon: Building2,
  },
  {
    title: "Présences",
    url: "/attendance",
    icon: Clock,
  },
  {
    title: "Heures personnalisées",
    url: "/employee-hours",
    icon: Timer,
  },
  {
    title: "Permissions",
    url: "/permissions",
    icon: FileText,
  },
  {
    title: "Rapports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Agent IA",
    url: "/ai",
    icon: Bot,
  },
  {
    title: "Paramètres",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { navigateTo, isNavigating } = useNavigation();
  const { user, requestLogout, timeLeft } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="font-semibold">Promillys Bot</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <button
                      onClick={() => navigateTo(item.url)}
                      disabled={isNavigating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isNavigating && pathname !== item.url ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <item.icon className="h-4 w-4" />
                      )}
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-4 py-2 space-y-2">
          <div className="text-sm text-muted-foreground">
            Connecté en tant que <span className="font-medium">{user?.username}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>WhatsApp connecté</span>
            </div>
            {timeLeft > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Session expire dans {Math.ceil(timeLeft / (60 * 1000))} min (inactivité)
              </div>
            )}
          </div>
          <button
            onClick={requestLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Se déconnecter</span>
          </button>
          <div className="text-xs text-muted-foreground">
            Promillys Bot v1.0.0
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
