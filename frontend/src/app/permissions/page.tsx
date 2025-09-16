import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { PermissionsPage } from "@/components/permissions-page";

export default function Permissions() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PermissionsPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
