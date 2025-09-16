"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Settings, AlertCircle } from "lucide-react";
import { api, Employee, EmployeeCustomHours } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

interface EmployeeHoursDialogProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeHoursDialog({ employee, isOpen, onClose }: EmployeeHoursDialogProps) {
  const [useCustomHours, setUseCustomHours] = useState(false);
  const [customHours, setCustomHours] = useState<EmployeeCustomHours>({
    startTime: "08:00",
    endTime: "17:00",
    lateThreshold: 15,
  });
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Charger les heures personnalisées existantes
  useEffect(() => {
    if (employee && isOpen) {
      if (employee.custom_start_time) {
        setUseCustomHours(true);
        setCustomHours({
          startTime: employee.custom_start_time,
          endTime: employee.custom_end_time || "17:00",
          lateThreshold: employee.custom_late_threshold || 15,
        });
      } else {
        setUseCustomHours(false);
        setCustomHours({
          startTime: "08:00",
          endTime: "17:00",
          lateThreshold: 15,
        });
      }
    }
  }, [employee, isOpen]);

  const setHoursMutation = useMutation({
    mutationFn: (data: EmployeeCustomHours) => 
      api.setEmployeeCustomHours(employee!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-hours"] });
      onClose();
      toast({
        title: "Succès",
        description: "Heures personnalisées définies avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la définition des heures personnalisées",
        variant: "destructive",
      });
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: (data: Partial<EmployeeCustomHours>) => 
      api.updateEmployeeCustomHours(employee!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-hours"] });
      onClose();
      toast({
        title: "Succès",
        description: "Heures personnalisées mises à jour avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la mise à jour des heures personnalisées",
        variant: "destructive",
      });
    },
  });

  const removeHoursMutation = useMutation({
    mutationFn: () => api.removeEmployeeCustomHours(employee!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-hours"] });
      onClose();
      toast({
        title: "Succès",
        description: "Heures personnalisées supprimées avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la suppression des heures personnalisées",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!employee) return;

    setIsLoading(true);
    try {
      if (useCustomHours) {
        if (employee.custom_start_time) {
          // Mettre à jour les heures existantes
          await updateHoursMutation.mutateAsync(customHours);
        } else {
          // Créer de nouvelles heures personnalisées
          await setHoursMutation.mutateAsync(customHours);
        }
      } else {
        // Supprimer les heures personnalisées
        if (employee.custom_start_time) {
          await removeHoursMutation.mutateAsync();
        }
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateTime = (time: string) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const isFormValid = () => {
    if (!useCustomHours) return true;
    return (
      validateTime(customHours.startTime) &&
      validateTime(customHours.endTime) &&
      customHours.lateThreshold >= 0 &&
      customHours.lateThreshold <= 120
    );
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Heures personnalisées
          </DialogTitle>
          <DialogDescription>
            Configurez les heures de travail personnalisées pour {employee.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statut actuel */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Configuration actuelle</span>
            </div>
            <Badge variant={employee.custom_start_time ? "default" : "secondary"}>
              {employee.custom_start_time ? "Personnalisées" : "Par défaut"}
            </Badge>
          </div>

          {/* Switch pour activer/désactiver les heures personnalisées */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="use-custom-hours">Utiliser des heures personnalisées</Label>
              <p className="text-sm text-muted-foreground">
                Sinon, les heures par défaut de l'entreprise seront utilisées
              </p>
            </div>
            <Switch
              id="use-custom-hours"
              checked={useCustomHours}
              onCheckedChange={setUseCustomHours}
            />
          </div>

          {/* Formulaire des heures personnalisées */}
          {useCustomHours && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Heure de début</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={customHours.startTime}
                    onChange={(e) => setCustomHours({ ...customHours, startTime: e.target.value })}
                    className={!validateTime(customHours.startTime) ? "border-red-500" : ""}
                  />
                  {!validateTime(customHours.startTime) && (
                    <p className="text-xs text-red-500">Format invalide (HH:MM)</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Heure de fin</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={customHours.endTime}
                    onChange={(e) => setCustomHours({ ...customHours, endTime: e.target.value })}
                    className={!validateTime(customHours.endTime) ? "border-red-500" : ""}
                  />
                  {!validateTime(customHours.endTime) && (
                    <p className="text-xs text-red-500">Format invalide (HH:MM)</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="late-threshold">Seuil de retard (minutes)</Label>
                <Input
                  id="late-threshold"
                  type="number"
                  min="0"
                  max="120"
                  value={customHours.lateThreshold}
                  onChange={(e) => setCustomHours({ 
                    ...customHours, 
                    lateThreshold: parseInt(e.target.value) || 0 
                  })}
                  className={customHours.lateThreshold < 0 || customHours.lateThreshold > 120 ? "border-red-500" : ""}
                />
                {customHours.lateThreshold < 0 || customHours.lateThreshold > 120 ? (
                  <p className="text-xs text-red-500">Doit être entre 0 et 120 minutes</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    L'employé sera considéré en retard après {customHours.lateThreshold} minutes
                  </p>
                )}
              </div>

              {/* Avertissement si les heures sont incohérentes */}
              {customHours.startTime && customHours.endTime && 
               customHours.startTime >= customHours.endTime && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-xs">
                    L'heure de début doit être antérieure à l'heure de fin
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Résumé */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Résumé</h4>
            <div className="text-sm text-blue-800">
              {useCustomHours ? (
                <div>
                  <p><strong>Heures personnalisées :</strong> {customHours.startTime} - {customHours.endTime}</p>
                  <p><strong>Seuil de retard :</strong> {customHours.lateThreshold} minutes</p>
                </div>
              ) : (
                <p>L'employé utilisera les heures par défaut de l'entreprise</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <LoadingButton 
            onClick={handleSubmit} 
            disabled={!isFormValid()}
            isLoading={isLoading}
            loadingText="Enregistrement..."
          >
            Enregistrer
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
