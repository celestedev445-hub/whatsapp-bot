"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { api, Department, Employee } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

export function DepartmentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [newDepartment, setNewDepartment] = useState({ name: "", description: "" });
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer les départements
  const { data: departments, isLoading: departmentsLoading, error: departmentsError } = useQuery({
    queryKey: ["departments"],
    queryFn: api.getDepartments,
  });

  // Récupérer tous les employés
  const { data: allEmployees, isLoading: employeesLoading } = useQuery({
    queryKey: ["all-employees"],
    queryFn: api.getAllEmployees,
  });

  // Récupérer les employés du département sélectionné
  const { data: departmentEmployees, isLoading: departmentEmployeesLoading } = useQuery({
    queryKey: ["department-employees", selectedDepartment?.id],
    queryFn: () => api.getDepartmentEmployees(selectedDepartment!.id),
    enabled: !!selectedDepartment,
  });

  // Mutation pour créer un département
  const createDepartmentMutation = useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setIsCreateDialogOpen(false);
      setNewDepartment({ name: "", description: "" });
      toast({
        title: "Succès",
        description: "Département créé avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la création du département",
        variant: "destructive",
      });
    },
  });

  // Mutation pour mettre à jour un département
  const updateDepartmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string } }) =>
      api.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setIsEditDialogOpen(false);
      setEditingDepartment(null);
      toast({
        title: "Succès",
        description: "Département mis à jour avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la mise à jour du département",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un département
  const deleteDepartmentMutation = useMutation({
    mutationFn: api.deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      if (selectedDepartment) {
        setSelectedDepartment(null);
      }
      toast({
        title: "Succès",
        description: "Département supprimé avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de la suppression du département",
        variant: "destructive",
      });
    },
  });

  // Mutation pour assigner un employé
  const assignEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, departmentId }: { employeeId: number; departmentId: number }) =>
      api.assignEmployeeToDepartment(employeeId, departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-employees", selectedDepartment?.id] });
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setIsAssignDialogOpen(false);
      setSelectedEmployee(null);
      toast({
        title: "Succès",
        description: "Employé assigné au département avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de l'assignation de l'employé",
        variant: "destructive",
      });
    },
  });

  // Mutation pour retirer un employé
  const removeEmployeeMutation = useMutation({
    mutationFn: api.removeEmployeeFromDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-employees", selectedDepartment?.id] });
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({
        title: "Succès",
        description: "Employé retiré du département avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors du retrait de l'employé",
        variant: "destructive",
      });
    },
  });

  const filteredDepartments = departments?.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const availableEmployees = allEmployees?.filter(emp => 
    !emp.department_id || emp.department_id !== selectedDepartment?.id
  ) || [];

  const handleCreateDepartment = () => {
    if (newDepartment.name.trim()) {
      createDepartmentMutation.mutate({
        name: newDepartment.name.trim(),
        description: newDepartment.description.trim() || undefined,
      });
    }
  };

  const handleUpdateDepartment = () => {
    if (editingDepartment && editingDepartment.name.trim()) {
      updateDepartmentMutation.mutate({
        id: editingDepartment.id,
        data: {
          name: editingDepartment.name.trim(),
          description: editingDepartment.description?.trim() || undefined,
        },
      });
    }
  };

  const handleAssignEmployee = () => {
    if (selectedEmployee && selectedDepartment) {
      assignEmployeeMutation.mutate({
        employeeId: selectedEmployee,
        departmentId: selectedDepartment.id,
      });
    }
  };

  const handleRemoveEmployee = (employeeId: number) => {
    removeEmployeeMutation.mutate(employeeId);
  };

  if (departmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Chargement des départements...</span>
        </div>
      </div>
    );
  }

  if (departmentsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">Erreur lors du chargement des départements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Départements</h1>
          <p className="text-muted-foreground">
            Gérez les départements et assignez les employés
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau département
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau département</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau département à votre organisation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom du département *</Label>
                <Input
                  id="name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  placeholder="Ex: Ressources Humaines"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                  placeholder="Description du département..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annuler
              </Button>
              <LoadingButton 
                onClick={handleCreateDepartment}
                disabled={!newDepartment.name.trim()}
                isLoading={createDepartmentMutation.isPending}
                loadingText="Création..."
              >
                Créer
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        {/* Liste des départements */}
        <div className="w-1/3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Départements ({filteredDepartments.length})
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un département..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {filteredDepartments.map((department) => (
                  <div
                    key={department.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${
                      selectedDepartment?.id === department.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                    }`}
                    onClick={() => setSelectedDepartment(department)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{department.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {department.employee_count} employé{department.employee_count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDepartment(department);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDepartmentMutation.mutate(department.id);
                          }}
                          disabled={department.employee_count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Détails du département sélectionné */}
        <div className="w-2/3">
          {selectedDepartment ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {selectedDepartment.name}
                      </CardTitle>
                      <CardDescription>
                        {selectedDepartment.description || "Aucune description"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {selectedDepartment.employee_count} employé{selectedDepartment.employee_count > 1 ? "s" : ""}
                      </Badge>
                      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Assigner un employé
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assigner un employé</DialogTitle>
                            <DialogDescription>
                              Sélectionnez un employé à assigner à ce département
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="employee">Employé</Label>
                              <Select value={selectedEmployee?.toString() || ""} onValueChange={(value) => setSelectedEmployee(parseInt(value))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un employé" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableEmployees.map((employee) => (
                                    <SelectItem key={employee.id} value={employee.id.toString()}>
                                      {employee.name} {employee.department_name && `(${employee.department_name})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                              Annuler
                            </Button>
                            <LoadingButton 
                              onClick={handleAssignEmployee}
                              disabled={!selectedEmployee}
                              isLoading={assignEmployeeMutation.isPending}
                              loadingText="Assignation..."
                            >
                              Assigner
                            </LoadingButton>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {departmentEmployeesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : departmentEmployees && departmentEmployees.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Poste</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departmentEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.name}</TableCell>
                            <TableCell>{employee.phone}</TableCell>
                            <TableCell>{employee.position || "Non défini"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEmployee(employee.id)}
                                disabled={removeEmployeeMutation.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucun employé assigné à ce département
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4" />
                  <p>Sélectionnez un département pour voir ses détails</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le département</DialogTitle>
            <DialogDescription>
              Modifiez les informations du département
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nom du département *</Label>
              <Input
                id="edit-name"
                value={editingDepartment?.name || ""}
                onChange={(e) => setEditingDepartment({ ...editingDepartment!, name: e.target.value })}
                placeholder="Ex: Ressources Humaines"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editingDepartment?.description || ""}
                onChange={(e) => setEditingDepartment({ ...editingDepartment!, description: e.target.value })}
                placeholder="Description du département..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <LoadingButton 
              onClick={handleUpdateDepartment}
              disabled={!editingDepartment?.name?.trim()}
              isLoading={updateDepartmentMutation.isPending}
              loadingText="Mise à jour..."
            >
              Modifier
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
