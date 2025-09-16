import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EmployeeDetailsPage } from "@/components/employee-details-page";

interface EmployeePageProps {
  params: {
    id: string;
  };
}

export default function EmployeePage({ params }: EmployeePageProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <EmployeeDetailsPage employeeId={parseInt(params.id)} />
      </SidebarInset>
    </SidebarProvider>
  );
}
