"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface NavigationContextType {
  isNavigating: boolean;
  navigateTo: (url: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Réinitialiser l'état de chargement quand la route change
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const navigateTo = (url: string) => {
    // Ne pas afficher le chargement si on est déjà sur la même page
    if (pathname === url) return;
    
    setIsNavigating(true);
    router.push(url);
  };

  return (
    <NavigationContext.Provider value={{ isNavigating, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
