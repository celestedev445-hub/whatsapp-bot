import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MessagesPage } from "@/components/messages-page";

export default function Messages() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <MessagesPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
