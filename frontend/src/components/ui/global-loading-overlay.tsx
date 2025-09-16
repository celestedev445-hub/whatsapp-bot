"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useNavigation } from "@/contexts/navigation-context";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function GlobalLoadingOverlay() {
  const { isNavigating } = useNavigation();
  const pathname = usePathname();
  const [loadingText, setLoadingText] = useState("Chargement de la page...");

  // Définir le texte de chargement selon la page
  useEffect(() => {
    if (isNavigating) {
      const pageNames: Record<string, string> = {
        "/": "Chargement du tableau de bord...",
        "/employees": "Chargement des employés...",
        "/departments": "Chargement des départements...",
        "/attendance": "Chargement des présences...",
        "/employee-hours": "Chargement des heures personnalisées...",
        "/permissions": "Chargement des permissions...",
        "/reports": "Chargement des rapports...",
        "/messages": "Chargement des messages...",
        "/ai": "Chargement de l'agent IA...",
        "/settings": "Chargement des paramètres...",
      };
      
      setLoadingText(pageNames[pathname] || "Chargement de la page...");
    }
  }, [isNavigating, pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border rounded-lg p-8 shadow-lg max-w-sm w-full mx-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground">{loadingText}</p>
        </div>
      </div>
    </div>
  );
}
