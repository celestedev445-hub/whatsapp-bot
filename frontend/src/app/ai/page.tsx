"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AIDashboard from '@/components/ai-dashboard';

export default function AIPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AIDashboard />
      </SidebarInset>
    </SidebarProvider>
  );
}
