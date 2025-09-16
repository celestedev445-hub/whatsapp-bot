import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SettingsPage } from "@/components/settings-page";

export default function Settings() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SettingsPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
