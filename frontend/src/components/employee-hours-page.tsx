"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Clock, Search, Settings, Users, AlertCircle, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, Employee, EmployeeCustomHours } from "@/lib/api";
import { EmployeeHoursDialog } from "@/components/employee-hours-dialog";
import { DeleteCustomHoursDialog } from "@/components/confirmation-dialog";

export function EmployeeHoursPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [hoursEmployee, setHoursEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employee-hours"],
    queryFn: api.getAllEmployeesWithHours,
  });

  const removeHoursMutation = useMutation({
    mutationFn: (id: number) => api.removeEmployeeCustomHours(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-hours"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDeleteEmployee(null);
    },
  });

  const handleRemoveHours = (employee: Employee) => {
    setDeleteEmployee(employee);
  };

  const confirmRemoveHours = () => {
    if (deleteEmployee) {
      removeHoursMutation.mutate(deleteEmployee.id);
    }
  };

  const filteredEmployees = employees?.filter((employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.phone.includes(searchTerm)
  ) || [];

  const employeesWithCustomHours = filteredEmployees.filter(emp => emp.custom_start_time);
  const employeesWithDefaultHours = filteredEmployees.filter(emp => !emp.custom_start_time);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des employés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Heures personnalisées</h1>
          <p className="text-muted-foreground">
            Gestion des heures de travail personnalisées par employé
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectedEmployee(null)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle configuration
          </Button>
        </div>
      </div>

      {/* Sélecteur d'employé et actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-80">
            <Select
              value={selectedEmployee?.id.toString() || ""}
              onValueChange={(value) => {
                const employee = employees?.find(emp => emp.id.toString() === value);
                setSelectedEmployee(employee || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un employé pour configurer ses heures..." />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{employee.name}</span>
                      <span className="text-muted-foreground">({employee.phone})</span>
                      {employee.custom_start_time ? (
                        <Badge variant="default" className="text-xs">
                          <Settings className="h-3 w-3 mr-1" />
                          Personnalisées
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Par défaut
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEmployee && (
            <Button
              onClick={() => setHoursEmployee(selectedEmployee)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configurer les heures
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer la liste..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total employés</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredEmployees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures personnalisées</CardTitle>
            <Settings className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesWithCustomHours.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures par défaut</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesWithDefaultHours.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Employés avec heures personnalisées */}
      {employeesWithCustomHours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Heures personnalisées ({employeesWithCustomHours.length})
            </CardTitle>
            <CardDescription>
              Employés avec des heures de travail personnalisées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Seuil de retard</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesWithCustomHours.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {employee.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {employee.position || "Non défini"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {employee.custom_start_time} - {employee.custom_end_time}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {employee.custom_late_threshold} minutes
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHoursEmployee(employee)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveHours(employee)}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Employés avec heures par défaut */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Heures par défaut ({employeesWithDefaultHours.length})
          </CardTitle>
          <CardDescription>
            Employés utilisant les heures par défaut de l'entreprise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesWithDefaultHours.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {employee.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {employee.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.position || "Non défini"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHoursEmployee(employee)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configurer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog des heures personnalisées */}
      <EmployeeHoursDialog
        employee={hoursEmployee}
        isOpen={!!hoursEmployee}
        onClose={() => setHoursEmployee(null)}
      />

      {/* Dialog de confirmation de suppression des heures */}
      <DeleteCustomHoursDialog
        isOpen={!!deleteEmployee}
        onClose={() => setDeleteEmployee(null)}
        onConfirm={confirmRemoveHours}
        employeeName={deleteEmployee?.name || ""}
        isLoading={removeHoursMutation.isPending}
      />
    </div>
  );
}
