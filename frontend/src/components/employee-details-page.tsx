"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  Calendar,
  Building2,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Settings
} from "lucide-react";
import { api, Employee, Attendance, Permission } from "@/lib/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmployeeHoursDialog } from "@/components/employee-hours-dialog";

interface EmployeeDetailsPageProps {
  employeeId: number;
}

export function EmployeeDetailsPage({ employeeId }: EmployeeDetailsPageProps) {
  const [hoursEmployee, setHoursEmployee] = useState<Employee | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Récupérer les détails de l'employé
  const { data: employee, isLoading: employeeLoading, error: employeeError } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => api.getEmployee(employeeId),
  });

  // Récupérer l'historique des présences
  const { data: attendanceHistory, isLoading: attendanceLoading } = useQuery({
    queryKey: ["employee-attendance", employeeId],
    queryFn: () => api.getAttendance({ employee_id: employeeId, start_date: "2024-01-01" }),
  });

  // Récupérer les permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["employee-permissions", employeeId],
    queryFn: () => api.getPermissions({ employee_id: employeeId }),
  });

  // Récupérer les statistiques de présence
  const { data: attendanceStats, isLoading: statsLoading } = useQuery({
    queryKey: ["employee-stats", employeeId],
    queryFn: () => api.getAttendanceStats({ start_date: "2024-01-01" }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="default" className="bg-green-500">Présent</Badge>;
      case "late":
        return <Badge variant="default" className="bg-yellow-500">En retard</Badge>;
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "permission":
        return <Badge variant="outline">Permission</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "late":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "absent":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPermissionStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600">En attente</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approuvée</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejetée</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const getPermissionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sick_leave: "Congé maladie",
      vacation: "Vacances",
      personal: "Personnel",
      medical: "Médical",
      other: "Autre"
    };
    return types[type] || type;
  };

  if (employeeLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" text="Chargement des détails de l'employé..." />
      </div>
    );
  }

  if (employeeError || !employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Employé non trouvé</h2>
          <p className="text-muted-foreground mb-4">
            L'employé demandé n'existe pas ou a été supprimé.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header avec bouton retour */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Détails de l'employé</h1>
          <p className="text-muted-foreground">
            Informations complètes sur {employee.name}
          </p>
        </div>
      </div>

      {/* Informations principales */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Informations personnelles</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {employee.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{employee.name}</h3>
                <p className="text-sm text-muted-foreground">{employee.position || "Poste non défini"}</p>
                <Badge variant={employee.is_active ? "default" : "secondary"}>
                  {employee.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contact</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{employee.phone}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{employee.department_name || "Aucun département"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures de travail</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {employee.custom_start_time ? (
                <div>
                  <p className="text-sm font-medium">Personnalisées</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.custom_start_time} - {employee.custom_end_time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Seuil: {employee.custom_late_threshold}min
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Par défaut</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHoursEmployee(employee)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Gérer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets pour les détails */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Présences</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="statistics">Statistiques</TabsTrigger>
        </TabsList>

        {/* Onglet Présences */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Historique des présences</CardTitle>
              <CardDescription>
                Dernières présences de {employee.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner text="Chargement des présences..." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Arrivée</TableHead>
                        <TableHead>Départ</TableHead>
                        <TableHead>Heures travaillées</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceHistory && attendanceHistory.length > 0 ? (
                        attendanceHistory.slice(0, 20).map((record: Attendance) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {format(new Date(record.date), "dd MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(record.status)}
                                <span>{record.arrival_time || "Non marqué"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{record.departure_time || "Non marqué"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {record.total_work_hours ? `${record.total_work_hours}h` : "N/A"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {record.notes || "Aucune note"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune présence enregistrée
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Permissions */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permissions et congés</CardTitle>
              <CardDescription>
                Demandes de permissions de {employee.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner text="Chargement des permissions..." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Raison</TableHead>
                        <TableHead>Date de demande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions && permissions.length > 0 ? (
                        permissions.map((permission: Permission) => (
                          <TableRow key={permission.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {getPermissionTypeLabel(permission.type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>
                                  {format(new Date(permission.start_date), "dd MMM yyyy", { locale: fr })}
                                </div>
                                <div className="text-muted-foreground">
                                  au {format(new Date(permission.end_date), "dd MMM yyyy", { locale: fr })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getPermissionStatusBadge(permission.status)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {permission.reason || "Aucune raison spécifiée"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(permission.created_at), "dd MMM yyyy", { locale: fr })}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Aucune permission enregistrée
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Statistiques */}
        <TabsContent value="statistics">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jours présents</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {attendanceStats?.present_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sur {attendanceStats?.total_employees || 0} jours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retards</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {attendanceStats?.late_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Retards enregistrés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Absences</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {attendanceStats?.absent_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jours d'absence
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Permissions</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {attendanceStats?.permission_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jours de permission
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog des heures personnalisées */}
      <EmployeeHoursDialog
        employee={hoursEmployee}
        isOpen={!!hoursEmployee}
        onClose={() => setHoursEmployee(null)}
      />
    </div>
  );
}
