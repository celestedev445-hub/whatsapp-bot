"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Clock, 
  FileText, 
  MessageSquare, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";
import { CustomHoursSummary } from "@/components/custom-hours-summary";
import { WhatsAppStatusIndicator } from "@/components/whatsapp-status-indicator";

export function Dashboard() {
  // État de la connexion WebSocket
  const { isConnected } = useSocket();

  // Récupérer les données des membres
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: api.getEmployees,
  });

  // Récupérer les présences récentes
  const { data: recentAttendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["recent-attendance"],
    queryFn: api.getRecentAttendance,
  });

  // Récupérer les permissions en attente
  const { data: pendingPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["pending-permissions"],
    queryFn: api.getPendingPermissions,
  });

  // Calculer les statistiques
  const totalMembers = Array.isArray(employees) ? employees.length : 0;
  const activeMembers = Array.isArray(employees) ? employees.filter(emp => emp.is_active).length : 0;
  const todayAttendance = Array.isArray(recentAttendance) ? recentAttendance.length : 0;
  const pendingCount = Array.isArray(pendingPermissions) ? pendingPermissions.length : 0;
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de votre bot WhatsApp Entreprise
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppStatusIndicator />
          <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Temps réel
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Hors ligne
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membres</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employeesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                activeMembers
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total des membres actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Présents aujourd'hui</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                todayAttendance
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sur {totalMembers} membres
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions en attente</CardTitle>
            <AlertCircle className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {permissionsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                pendingCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Demandes à traiter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages traités</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Aujourd'hui
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Présences récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Présences récentes
            </CardTitle>
            <CardDescription>
              Dernières arrivées et départs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : Array.isArray(recentAttendance) && recentAttendance.length > 0 ? (
              <div className="space-y-2">
                {recentAttendance.slice(0, 5).map((attendance, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{attendance.employee_name || attendance.employee?.name || 'Membre inconnu'}</span>
                    <Badge variant={attendance.arrival_time ? 'default' : 'secondary'}>
                      {attendance.arrival_time ? 'Arrivée' : 'Départ'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune présence récente
              </p>
            )}
          </CardContent>
        </Card>

        {/* Permissions en attente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Permissions en attente
            </CardTitle>
            <CardDescription>
              Demandes nécessitant votre attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {permissionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : Array.isArray(pendingPermissions) && pendingPermissions.length > 0 ? (
              <div className="space-y-2">
                {pendingPermissions.slice(0, 5).map((permission, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{permission.employee_name || permission.employee?.name || 'Membre inconnu'}</span>
                    <Badge variant="outline">
                      {permission.reason || permission.type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune permission en attente
              </p>
            )}
          </CardContent>
        </Card>

        {/* Heures personnalisées */}
        <CustomHoursSummary />
      </div>
    </div>
  );
}