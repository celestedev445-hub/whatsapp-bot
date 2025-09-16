import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DepartmentsPage } from "@/components/departments-page";

export default function Departments() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DepartmentsPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
