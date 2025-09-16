import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EmployeesPage } from "@/components/employees-page";

export default function Employees() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <EmployeesPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
