"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Settings, Users, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export function CustomHoursSummary() {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employee-hours"],
    queryFn: api.getAllEmployeesWithHours,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Heures personnalisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const employeesWithCustomHours = employees?.filter(emp => emp.custom_start_time) || [];
  const employeesWithDefaultHours = employees?.filter(emp => !emp.custom_start_time) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Heures personnalisées
        </CardTitle>
        <CardDescription>
          Répartition des employés selon leur configuration d'heures
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {employeesWithCustomHours.length}
              </div>
              <div className="text-sm text-muted-foreground">Personnalisées</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {employeesWithDefaultHours.length}
              </div>
              <div className="text-sm text-muted-foreground">Par défaut</div>
            </div>
          </div>

          {/* Liste des employés avec heures personnalisées */}
          {employeesWithCustomHours.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Employés avec heures personnalisées
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {employeesWithCustomHours.slice(0, 5).map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{employee.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {employee.custom_start_time} - {employee.custom_end_time}
                    </Badge>
                  </div>
                ))}
                {employeesWithCustomHours.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{employeesWithCustomHours.length - 5} autres...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Avertissement si beaucoup d'employés sans heures personnalisées */}
          {employeesWithDefaultHours.length > employeesWithCustomHours.length && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <p className="text-xs">
                {employeesWithDefaultHours.length} employés utilisent encore les heures par défaut
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
