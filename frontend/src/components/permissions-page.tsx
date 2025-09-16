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
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  Calendar,
  User,
  Filter
} from "lucide-react";
import { api, Permission } from "@/lib/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

export function PermissionsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ["permissions", selectedStatus],
    queryFn: () => api.getPermissions({
      status: selectedStatus === "all" ? undefined : selectedStatus,
    }),
  });

  const approveMutation = useMutation({
    mutationFn: api.approvePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      setSelectedPermission(null);
      toast({
        title: "Succès",
        description: "Permission approuvée avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de l'approbation de la permission",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.rejectPermission(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      setSelectedPermission(null);
      setRejectReason("");
      toast({
        title: "Succès",
        description: "Permission rejetée avec succès",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors du rejet de la permission",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-secondary">En attente</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-primary">Approuvée</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejetée</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-secondary" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const types = {
      sick_leave: "Arrêt maladie",
      vacation: "Congé",
      personal: "Personnel",
      medical: "Médical",
      other: "Autre",
    };
    return types[type as keyof typeof types] || type;
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: number) => {
    rejectMutation.mutate({ id, reason: rejectReason });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des permissions...</p>
        </div>
      </div>
    );
  }

  const pendingCount = Array.isArray(permissions) ? permissions.filter(p => p.status === "pending").length : 0;
  const approvedCount = Array.isArray(permissions) ? permissions.filter(p => p.status === "approved").length : 0;
  const rejectedCount = Array.isArray(permissions) ? permissions.filter(p => p.status === "rejected").length : 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Permissions</h1>
          <p className="text-muted-foreground">
            Gestion des demandes de permissions des employés
          </p>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvées</SelectItem>
                  <SelectItem value="rejected">Rejetées</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Demandes à traiter
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approuvées</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">
              Permissions accordées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejetées</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground">
              Permissions refusées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table des permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des permissions</CardTitle>
          <CardDescription>
            Toutes les demandes de permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-destructive">Erreur lors du chargement des permissions: {error.message}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Chargement des permissions...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de demande</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(permissions) && permissions.length > 0 ? (
                  permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {permission.employee?.name?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{permission.employee?.name || "Employé"}</div>
                        <div className="text-sm text-muted-foreground">
                          {permission.employee?.position || "Poste non défini"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getTypeLabel(permission.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        <div>{format(new Date(permission.start_date), "dd/MM/yyyy", { locale: fr })}</div>
                        <div className="text-muted-foreground">
                          au {format(new Date(permission.end_date), "dd/MM/yyyy", { locale: fr })}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {permission.reason || "Aucune raison fournie"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(permission.status)}
                      {getStatusBadge(permission.status)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(permission.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {permission.status === "pending" && (
                      <div className="flex items-center space-x-2">
                        <LoadingButton
                          size="sm"
                          onClick={() => handleApprove(permission.id)}
                          isLoading={approveMutation.isPending}
                          loadingText="Approbation..."
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approuver
                        </LoadingButton>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSelectedPermission(permission)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeter
                        </Button>
                      </div>
                    )}
                    {permission.status !== "pending" && (
                      <span className="text-sm text-muted-foreground">
                        {permission.approved_at && format(new Date(permission.approved_at), "dd/MM/yyyy", { locale: fr })}
                      </span>
                    )}
                  </TableCell>
                  </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune permission trouvée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de rejet */}
      <Dialog open={!!selectedPermission} onOpenChange={() => setSelectedPermission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la permission</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir rejeter cette demande de permission ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPermission && (
              <div className="space-y-2">
                <Label>Employé</Label>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedPermission.employee?.name}</span>
                </div>
                <Label>Type</Label>
                <div>{getTypeLabel(selectedPermission.type)}</div>
                <Label>Période</Label>
                <div>
                  {format(new Date(selectedPermission.start_date), "dd/MM/yyyy", { locale: fr })} - 
                  {format(new Date(selectedPermission.end_date), "dd/MM/yyyy", { locale: fr })}
                </div>
                <Label htmlFor="reason">Raison du rejet (optionnel)</Label>
                <Textarea
                  id="reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette permission est rejetée..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedPermission(null)}
            >
              Annuler
            </Button>
            <LoadingButton
              variant="destructive"
              onClick={() => selectedPermission && handleReject(selectedPermission.id)}
              isLoading={rejectMutation.isPending}
              loadingText="Rejet en cours..."
            >
              Rejeter
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
