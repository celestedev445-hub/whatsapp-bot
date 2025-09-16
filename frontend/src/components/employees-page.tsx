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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, Users, Phone, Mail, Clock, Eye } from "lucide-react";
import { api, Employee } from "@/lib/api";
import { EmployeeHoursDialog } from "@/components/employee-hours-dialog";
import { DeleteEmployeeDialog } from "@/components/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";
import { useRouter } from "next/navigation";

export function EmployeesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [hoursEmployee, setHoursEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: api.getAllEmployees,
  });

  const createMutation = useMutation({
    mutationFn: api.createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Succès",
        description: "Employé créé avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la création de l'employé",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) =>
      api.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEditingEmployee(null);
      toast({
        title: "Succès",
        description: "Informations de l'employé mises à jour avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la mise à jour de l'employé",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Succès",
        description: "Employé supprimé avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la suppression de l'employé",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.syncMembers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Succès",
        description: "Synchronisation des membres terminée avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      console.error('Erreur de synchronisation:', error);
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la synchronisation des membres",
        variant: "destructive",
      });
    },
  });


  const handleCreateEmployee = async (data: Partial<Employee>) => {
    try {
      // Séparer les données de département des autres données
      const { department_id, ...otherData } = data;
      
      // Créer l'employé
      const newEmployee = await createMutation.mutateAsync(otherData);
      
      // Gérer l'assignation de département si nécessaire
      if (department_id && department_id !== null) {
        await api.assignEmployeeToDepartment(newEmployee.id, department_id);
        toast({
          title: "Succès",
          description: "Employé créé et assigné au département avec succès",
          variant: "success",
        });
      }
      
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de l'employé",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEmployee = async (data: Partial<Employee>) => {
    if (editingEmployee) {
      setIsUpdating(true);
      try {
        // Séparer les données de département des autres données
        const { department_id, ...otherData } = data;
        
        // Mettre à jour les autres informations de l'employé
        if (Object.keys(otherData).length > 0) {
          await updateMutation.mutateAsync({ id: editingEmployee.id, data: otherData });
        }
        
        // Gérer l'assignation de département séparément
        if (department_id !== undefined) {
          if (department_id === null) {
            // Retirer l'employé du département
            await api.removeEmployeeFromDepartment(editingEmployee.id);
          } else {
            // Assigner l'employé au département
            await api.assignEmployeeToDepartment(editingEmployee.id, department_id);
          }
        }
        
        // Rafraîchir les données
        await queryClient.invalidateQueries({ queryKey: ["employees"] });
        await queryClient.invalidateQueries({ queryKey: ["departments"] });
        setEditingEmployee(null);
        
        toast({
          title: "Succès",
          description: "Employé mis à jour avec succès",
          variant: "success",
        });
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        // En cas d'erreur, rafraîchir quand même les données
        queryClient.invalidateQueries({ queryKey: ["employees"] });
        
        toast({
          title: "Erreur",
          description: "Erreur lors de la mise à jour de l'employé",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setDeleteEmployee(employee);
  };

  const confirmDeleteEmployee = () => {
    if (deleteEmployee) {
      deleteMutation.mutate(deleteEmployee.id);
      setDeleteEmployee(null);
    }
  };

  const handleSyncMembers = () => {
    syncMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des membres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Membres du groupe</h1>
          <p className="text-muted-foreground">
            Gestion des membres du groupe WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <LoadingButton
            variant="outline"
            onClick={handleSyncMembers}
            isLoading={syncMutation.isPending}
            loadingText="Synchronisation..."
            title="Synchroniser les membres du groupe WhatsApp avec la base de données"
          >
            <Users className="h-4 w-4 mr-2" />
            Synchroniser
          </LoadingButton>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un membre
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
              <DialogDescription>
                Créez un nouveau profil de membre du groupe
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm
              onSubmit={handleCreateEmployee}
              isLoading={createMutation.isPending}
            />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total membres</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(employees) ? employees.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membres actifs</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(employees) ? employees.filter(emp => emp.is_active).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membres inactifs</CardTitle>
            <Users className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(employees) ? employees.filter(emp => !emp.is_active).length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table des employés */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des membres</CardTitle>
          <CardDescription>
            Tous les membres du groupe WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Heures</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(employees) ? employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {employee.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <button
                          onClick={() => router.push(`/employees/${employee.id}`)}
                          className="font-medium hover:text-primary hover:underline transition-colors text-left"
                        >
                          {employee.name}
                        </button>
                        <div className="text-sm text-muted-foreground">
                          ID: {employee.whatsapp_id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{employee.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{employee.position || "Non défini"}</TableCell>
                  <TableCell>{employee.department_name || "Non défini"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {employee.custom_start_time ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {employee.custom_start_time} - {employee.custom_end_time}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Seuil: {employee.custom_late_threshold}min
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Par défaut
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/employees/${employee.id}`)}
                        title="Voir les détails de l'employé"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHoursEmployee(employee)}
                        title="Gérer les heures personnalisées"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingEmployee(employee)}
                        title="Modifier l'employé"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEmployee(employee)}
                        title="Supprimer l'employé"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog d'édition */}
      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>
              Modifiez les informations du membre
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleUpdateEmployee}
            isLoading={isUpdating}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog des heures personnalisées */}
      <EmployeeHoursDialog
        employee={hoursEmployee}
        isOpen={!!hoursEmployee}
        onClose={() => setHoursEmployee(null)}
      />

      {/* Dialog de confirmation de suppression */}
      <DeleteEmployeeDialog
        isOpen={!!deleteEmployee}
        onClose={() => setDeleteEmployee(null)}
        onConfirm={confirmDeleteEmployee}
        employeeName={deleteEmployee?.name || ""}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function EmployeeForm({
  employee,
  onSubmit,
  isLoading,
}: {
  employee?: Employee | null;
  onSubmit: (data: Partial<Employee>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: employee?.name || "",
    phone: employee?.phone || "",
    position: employee?.position || "",
    department_id: employee?.department_id || null,
    is_active: employee?.is_active ?? true,
  });

  // Récupérer la liste des départements
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: api.getDepartments,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convertir null en undefined pour la compatibilité avec l'interface Employee
    const submitData = {
      ...formData,
      department_id: formData.department_id === null ? undefined : formData.department_id
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom complet</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="position">Poste</Label>
          <Input
            id="position"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Département</Label>
          <Select
            value={formData.department_id ? formData.department_id.toString() : "none"}
            onValueChange={(value) => setFormData({ ...formData, department_id: value === "none" ? null : parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un département" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun département</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="is_active">Statut</Label>
        <Select
          value={formData.is_active.toString()}
          onValueChange={(value) => setFormData({ ...formData, is_active: value === "true" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Actif</SelectItem>
            <SelectItem value="false">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <LoadingButton type="submit" isLoading={isLoading} loadingText="Enregistrement...">
          Enregistrer
        </LoadingButton>
      </DialogFooter>
    </form>
  );
}
