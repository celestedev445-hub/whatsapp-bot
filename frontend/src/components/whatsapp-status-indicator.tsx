"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  botNumber?: string;
}

export function WhatsAppStatusIndicator() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = async () => {
    try {
      const botStatus = await api.getBotStatus();
      setStatus(botStatus);
    } catch (error) {
      console.error('Erreur lors de la vérification du statut WhatsApp:', error);
      setStatus({
        connected: false,
        status: 'Erreur de connexion'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Vérifier le statut toutes les 30 secondes
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Vérification...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">Statut inconnu</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {status.connected ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <Badge variant="default" className="bg-green-600">
            WhatsApp connecté
          </Badge>
          {status.botNumber && (
            <span className="text-xs text-muted-foreground">
              {status.botNumber}
            </span>
          )}
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-destructive" />
          <Badge variant="destructive">
            WhatsApp déconnecté
          </Badge>
        </>
      )}
    </div>
  );
}
