"use client";

import { useAuth } from "@/contexts/auth-context";
import { InactivityWarning } from "@/components/inactivity-warning";
import { LogoutConfirmation } from "@/components/logout-confirmation";

export function AuthWrappers() {
  const { 
    isAuthenticated, 
    timeLeft, 
    extendSession, 
    requestLogout,
    showLogoutConfirmation,
    setShowLogoutConfirmation,
    logout,
    user
  } = useAuth();
  
  if (!isAuthenticated) return null;
  
  return (
    <>
      <InactivityWarning
        onExtend={extendSession}
        onRequestLogout={requestLogout}
        timeLeft={timeLeft}
      />
      <LogoutConfirmation
        isOpen={showLogoutConfirmation}
        onClose={() => setShowLogoutConfirmation(false)}
        onConfirm={logout}
        userName={user?.username}
      />
    </>
  );
}
