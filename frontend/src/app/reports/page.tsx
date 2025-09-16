import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ReportsPage } from "@/components/reports-page";

export default function Reports() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ReportsPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
