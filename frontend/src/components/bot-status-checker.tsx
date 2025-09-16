"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Smartphone, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface BotStatus {
  connected: boolean;
  status: string;
  qrCode: string | null;
  botNumber?: string;
  error?: string;
}

export function BotStatusChecker({ onBotReady }: { onBotReady: () => void }) {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const checkBotStatus = async () => {
    try {
      const status = await api.getBotStatus();
      setBotStatus(status);
      
      if (status.connected) {
        onBotReady();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut du bot:', error);
      setBotStatus({
        connected: false,
        status: 'Erreur de connexion',
        qrCode: null,
        error: 'Impossible de vérifier le statut du bot'
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    checkBotStatus();
  };

  const handleInitBot = async () => {
    try {
      setIsInitializing(true);
      await api.initBot();
      // Attendre un peu puis vérifier le statut
      setTimeout(() => {
        checkBotStatus();
      }, 2000);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du bot:', error);
    } finally {
      setIsInitializing(false);
    }
  };


  useEffect(() => {
    checkBotStatus();
    
    // Auto-initialiser le bot si il n'est pas initialisé
    const autoInitBot = async () => {
      try {
        const status = await api.getBotStatus();
        if (!status.connected && status.status === 'Bot non initialisé') {
          console.log('🤖 Auto-initialisation du bot WhatsApp...');
          await api.initBot();
          // Attendre un peu puis vérifier le statut
          setTimeout(() => {
            checkBotStatus();
          }, 2000);
        }
      } catch (error) {
        console.error('Erreur lors de l\'auto-initialisation:', error);
      }
    };

    // Vérifier le statut toutes les 10 secondes si le bot n'est pas connecté
    const interval = setInterval(() => {
      if (!botStatus?.connected) {
        checkBotStatus();
        // Essayer l'auto-initialisation si nécessaire
        autoInitBot();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [botStatus?.connected]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-6">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Vérification du statut du bot...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!botStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span>Erreur</span>
            </CardTitle>
            <CardDescription>
              Impossible de vérifier le statut du bot WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="w-full">
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Vérification...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (botStatus.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Promillys Bot Connecté</span>
            </CardTitle>
            <CardDescription>
              WhatsApp est déjà connecté et prêt à fonctionner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Statut:</span>
              <Badge variant="default" className="bg-primary">
                {botStatus.status}
              </Badge>
            </div>
            {botStatus.botNumber && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Numéro WhatsApp:</span>
                <span className="text-sm font-mono">{botStatus.botNumber}</span>
              </div>
            )}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">
                  Connexion WhatsApp active
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Aucun scan de QR code nécessaire - le bot fonctionne déjà
              </p>
            </div>
            <Button onClick={onBotReady} className="w-full">
              Accéder à l'application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <span>Connexion WhatsApp Requise</span>
          </CardTitle>
          <CardDescription>
            WhatsApp n'est pas connecté. Scannez le QR code pour établir la connexion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Statut:</span>
            <Badge variant="secondary">
              {botStatus.status}
            </Badge>
          </div>
          
          {botStatus.qrCode && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border-2 border-dashed border-border">
                <img 
                  src={botStatus.qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-48 h-48"
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Ouvrez WhatsApp sur votre téléphone<br />
                Allez dans <strong>Paramètres → Appareils liés → Lier un appareil</strong><br />
                Scannez ce QR code pour connecter Promillys Bot
              </p>
            </div>
          )}
          
          {!botStatus.qrCode && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Génération du QR code en cours...
              </p>
            </div>
          )}
          
          {!botStatus.qrCode && botStatus.status === 'Bot non initialisé' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Promillys Bot n'est pas encore initialisé
              </p>
              <Button 
                onClick={handleInitBot} 
                disabled={isInitializing}
                className="w-full"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Initialisation...
                  </>
                ) : (
                  'Initialiser Promillys Bot'
                )}
              </Button>
            </div>
          )}
          
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing} 
            variant="outline" 
            className="w-full"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Vérification...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
