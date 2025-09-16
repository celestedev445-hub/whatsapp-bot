"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle } from "lucide-react";

interface InactivityWarningProps {
  onExtend: () => void;
  onRequestLogout: () => void;
  timeLeft: number;
}

export function InactivityWarning({ onExtend, onRequestLogout, timeLeft }: InactivityWarningProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Afficher l'alerte 2 minutes avant la déconnexion
    if (timeLeft <= 2 * 60 * 1000 && timeLeft > 0) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [timeLeft]);

  if (!isVisible) return null;

  const minutesLeft = Math.ceil(timeLeft / (60 * 1000));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Session sur le point d'expirer</span>
          </CardTitle>
          <CardDescription>
            Votre session va expirer dans {minutesLeft} minute{minutesLeft > 1 ? 's' : ''} 
            en raison de l'inactivité.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Cliquez sur "Prolonger" pour rester connecté ou "Se déconnecter" pour fermer la session.
            </AlertDescription>
          </Alert>
          
          <div className="flex space-x-2">
            <Button onClick={onExtend} className="flex-1">
              Prolonger la session
            </Button>
            <Button onClick={onRequestLogout} variant="outline" className="flex-1">
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
