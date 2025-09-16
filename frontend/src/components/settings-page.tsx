"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Clock, 
  Bell, 
  Shield,
  Save,
  RefreshCw
} from "lucide-react";

// Mock data pour les paramètres
const mockSettings = [
  {
    id: 1,
    setting_key: "work_start_time",
    setting_value: "08:00",
    description: "Heure de début de travail",
  },
  {
    id: 2,
    setting_key: "work_end_time",
    setting_value: "17:00",
    description: "Heure de fin de travail",
  },
  {
    id: 3,
    setting_key: "lunch_start_time",
    setting_value: "12:00",
    description: "Heure de début de pause déjeuner",
  },
  {
    id: 4,
    setting_key: "lunch_end_time",
    setting_value: "13:00",
    description: "Heure de fin de pause déjeuner",
  },
  {
    id: 5,
    setting_key: "late_threshold_minutes",
    setting_value: "15",
    description: "Seuil de retard en minutes",
  },
  {
    id: 6,
    setting_key: "auto_approve_permissions",
    setting_value: "false",
    description: "Approbation automatique des permissions",
  },
  {
    id: 7,
    setting_key: "daily_report_time",
    setting_value: "18:00",
    description: "Heure d'envoi du rapport quotidien",
  },
];

export function SettingsPage() {
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Mock query - remplacez par une vraie requête API
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockSettings;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      // Simulation d'une mise à jour
      await new Promise(resolve => setTimeout(resolve, 1000));
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEditedSettings({});
    },
  });

  const handleSettingChange = (key: string, value: string) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(editedSettings);
  };

  const getSettingValue = (key: string) => {
    return editedSettings[key] !== undefined ? editedSettings[key] : 
           settings?.find(s => s.setting_key === key)?.setting_value || "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  const hasChanges = Object.keys(editedSettings).length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground">
            Configuration du bot WhatsApp et des paramètres système
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder
              </>
            )}
          </Button>
        )}
      </div>

      {/* Paramètres d'horaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horaires de travail
          </CardTitle>
          <CardDescription>
            Configuration des heures de travail et des pauses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="work_start_time">Heure de début de travail</Label>
              <Input
                id="work_start_time"
                type="time"
                value={getSettingValue("work_start_time")}
                onChange={(e) => handleSettingChange("work_start_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_end_time">Heure de fin de travail</Label>
              <Input
                id="work_end_time"
                type="time"
                value={getSettingValue("work_end_time")}
                onChange={(e) => handleSettingChange("work_end_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunch_start_time">Début de pause déjeuner</Label>
              <Input
                id="lunch_start_time"
                type="time"
                value={getSettingValue("lunch_start_time")}
                onChange={(e) => handleSettingChange("lunch_start_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunch_end_time">Fin de pause déjeuner</Label>
              <Input
                id="lunch_end_time"
                type="time"
                value={getSettingValue("lunch_end_time")}
                onChange={(e) => handleSettingChange("lunch_end_time", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paramètres de notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configuration des notifications automatiques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_report_time">Heure du rapport quotidien</Label>
              <Input
                id="daily_report_time"
                type="time"
                value={getSettingValue("daily_report_time")}
                onChange={(e) => handleSettingChange("daily_report_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="late_threshold_minutes">Seuil de retard (minutes)</Label>
              <Input
                id="late_threshold_minutes"
                type="number"
                value={getSettingValue("late_threshold_minutes")}
                onChange={(e) => handleSettingChange("late_threshold_minutes", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paramètres de sécurité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sécurité et permissions
          </CardTitle>
          <CardDescription>
            Configuration des paramètres de sécurité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto_approve_permissions">Approbation automatique des permissions</Label>
            <Select
              value={getSettingValue("auto_approve_permissions")}
              onValueChange={(value) => handleSettingChange("auto_approve_permissions", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Désactivée</SelectItem>
                <SelectItem value="true">Activée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statut du système */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Statut du système
          </CardTitle>
          <CardDescription>
            Informations sur l'état du bot et des services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-3">
              <Badge variant="default" className="bg-primary">
                En ligne
              </Badge>
              <span className="text-sm">Bot WhatsApp</span>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="default" className="bg-primary">
                Connecté
              </Badge>
              <span className="text-sm">Base de données</span>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="default" className="bg-primary">
                Actif
              </Badge>
              <span className="text-sm">Tâches automatiques</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
