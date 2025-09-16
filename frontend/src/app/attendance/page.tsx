import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AttendancePage } from "@/components/attendance-page";

export default function Attendance() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AttendancePage />
      </SidebarInset>
    </SidebarProvider>
  );
}
