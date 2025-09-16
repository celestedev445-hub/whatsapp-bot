"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Dashboard } from "@/components/dashboard";
import { BotStatusChecker } from "@/components/bot-status-checker";
import { AuthGuard } from "@/components/auth-guard";

export default function Home() {
  const [botReady, setBotReady] = useState(false);

  const handleBotReady = () => {
    setBotReady(true);
  };

  return (
    <AuthGuard>
      {!botReady ? (
        <BotStatusChecker onBotReady={handleBotReady} />
      ) : (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Dashboard />
          </SidebarInset>
        </SidebarProvider>
      )}
    </AuthGuard>
  );
}