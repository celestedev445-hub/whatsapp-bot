import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EmployeeHoursPage } from "@/components/employee-hours-page";

export default function EmployeeHours() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <EmployeeHoursPage />
      </SidebarInset>
    </SidebarProvider>
  );
}