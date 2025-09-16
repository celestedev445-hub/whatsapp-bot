"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useMessageEvents, useAttendanceEvents } from "@/hooks/use-socket";

function WebSocketListener() {
  const queryClient = useQueryClient();
  const { newMessage } = useMessageEvents();
  const { attendanceUpdate } = useAttendanceEvents();

  // Invalider les requêtes quand de nouveaux messages arrivent
  useEffect(() => {
    if (newMessage) {
      console.log('🔄 Invalidation des requêtes messages');
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["recent-messages"] });
      queryClient.invalidateQueries({ queryKey: ["message-stats"] });
    }
  }, [newMessage, queryClient]);

  // Invalider les requêtes quand des mises à jour de présence arrivent
  useEffect(() => {
    if (attendanceUpdate) {
      console.log('🔄 Invalidation des requêtes présence');
      queryClient.invalidateQueries({ queryKey: ["recent-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-hours"] });
    }
  }, [attendanceUpdate, queryClient]);

  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000, // 5 secondes (réduit pour une meilleure réactivité)
        refetchOnWindowFocus: false, // Éviter les refetch inutiles
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketListener />
      {children}
    </QueryClientProvider>
  );
}
