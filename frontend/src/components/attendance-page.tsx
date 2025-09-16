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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar as CalendarIcon,
  Filter,
  Download
} from "lucide-react";
import { api, Attendance } from "@/lib/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: attendance, isLoading, error } = useQuery({
    queryKey: ["attendance", selectedDate, selectedEmployee, dateRange, statusFilter],
    queryFn: () => {
      // Si une plage de dates est sélectionnée, utiliser start_date et end_date
      if (dateRange?.from && dateRange?.to) {
        return api.getAttendance({
          employee_id: selectedEmployee === "all" ? undefined : parseInt(selectedEmployee),
          start_date: format(dateRange.from, "yyyy-MM-dd"),
          end_date: format(dateRange.to, "yyyy-MM-dd"),
          status: statusFilter === "all" ? undefined : statusFilter,
        });
      }
      // Sinon, utiliser la date sélectionnée comme start_date et end_date
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      return api.getAttendance({
        employee_id: selectedEmployee === "all" ? undefined : parseInt(selectedEmployee),
        start_date: selectedDateStr,
        end_date: selectedDateStr,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: api.getEmployees,
  });

  // Fonction d'export CSV
  const exportToCSV = async () => {
    if (!attendance || attendance.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    setIsExporting(true);
    
    try {

    const csvHeaders = [
      'Nom de l\'employé',
      'Poste',
      'Département',
      'Date',
      'Heure d\'arrivée',
      'Heure de départ',
      'Pause déjeuner (début)',
      'Pause déjeuner (fin)',
      'Heures travaillées',
      'Statut',
      'Notes'
    ];

    const csvData = attendance.map(record => [
      record.employee_name || record.employee?.name || 'N/A',
      record.position || record.employee?.position || 'N/A',
      record.department || record.employee?.department || 'N/A',
      record.date,
      record.arrival_time || 'N/A',
      record.departure_time || 'N/A',
      record.lunch_start || 'N/A',
      record.lunch_end || 'N/A',
      record.total_work_hours ? `${record.total_work_hours}h` : 'N/A',
      record.status,
      record.notes || 'N/A'
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Ajouter BOM pour l'UTF-8
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Nom de fichier basé sur la période sélectionnée
    const fileName = dateRange && dateRange.from && dateRange.to
      ? `presences_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.csv`
      : `presences_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export du fichier CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (attendance: Attendance) => {
    if (attendance.status === "present") {
      return <Badge variant="default" className="bg-primary">Présent</Badge>;
    }
    if (attendance.status === "late") {
      return <Badge variant="default" className="bg-secondary">En retard</Badge>;
    }
    if (attendance.status === "late_justified") {
      return <Badge variant="default" className="bg-green-600">Retard justifié</Badge>;
    }
    if (attendance.status === "absent") {
      return <Badge variant="destructive">Absent</Badge>;
    }
    if (attendance.status === "permission") {
      return <Badge variant="outline">Permission</Badge>;
    }
    return <Badge variant="secondary">Inconnu</Badge>;
  };

  const getStatusIcon = (attendance: Attendance) => {
    if (attendance.status === "present") {
      return <CheckCircle className="h-4 w-4 text-primary" />;
    }
    if (attendance.status === "late") {
      return <AlertCircle className="h-4 w-4 text-secondary" />;
    }
    if (attendance.status === "late_justified") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (attendance.status === "absent") {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des présences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Présences</h1>
          <p className="text-muted-foreground">
            Suivi des présences et absences des employés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={exportToCSV} 
            disabled={!attendance || attendance.length === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Export en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </>
            )}
          </Button>
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
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="space-y-2">
               <Label>Date</Label>
               <div className="flex items-center space-x-2">
                 <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                 <Input
                   type="date"
                   value={format(selectedDate, "yyyy-MM-dd")}
                   onChange={(e) => setSelectedDate(new Date(e.target.value))}
                 />
               </div>
             </div>
             <div className="space-y-2">
               <Label>Employé</Label>
               <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                 <SelectTrigger>
                   <SelectValue placeholder="Tous les employés" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Tous les employés</SelectItem>
                   {employees?.map((employee) => (
                     <SelectItem key={employee.id} value={employee.id.toString()}>
                       {employee.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>Statut</Label>
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                 <SelectTrigger>
                   <SelectValue placeholder="Tous les statuts" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Tous les statuts</SelectItem>
                   <SelectItem value="present">Présent</SelectItem>
                   <SelectItem value="late">En retard</SelectItem>
                   <SelectItem value="late_justified">Retard justifié</SelectItem>
                   <SelectItem value="absent">Absent</SelectItem>
                   <SelectItem value="permission">Permission</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>Période</Label>
               <div className="flex items-center space-x-2">
                 <Calendar
                   mode="range"
                   selected={dateRange}
                   onSelect={setDateRange}
                   numberOfMonths={1}
                   locale={fr}
                 />
               </div>
             </div>
           </div>
         </CardContent>
       </Card>

      {/* Table des présences */}
      <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle>
                 {statusFilter !== "all" ? 
                   `Présences - ${statusFilter === "present" ? "Présents" : 
                    statusFilter === "late" ? "En retard" : 
                    statusFilter === "late_justified" ? "Retards justifiés" :
                    statusFilter === "absent" ? "Absents" : 
                    statusFilter === "permission" ? "Permissions" : statusFilter}` : 
                   dateRange?.from && dateRange?.to ? 
                     `Présences du ${format(dateRange.from, "dd MMMM yyyy", { locale: fr })} au ${format(dateRange.to, "dd MMMM yyyy", { locale: fr })}` :
                     `Présences du ${format(selectedDate, "dd MMMM yyyy", { locale: fr })}`
                 }
               </CardTitle>
               <CardDescription>
                 {statusFilter !== "all" ? 
                   `Filtrage par statut: ${statusFilter}` : 
                   dateRange?.from && dateRange?.to ? 
                     "Détail des présences pour la période sélectionnée" :
                     "Détail des présences pour la date sélectionnée"
                 }
               </CardDescription>
             </div>
             <div className="text-sm text-muted-foreground">
               {attendance && attendance.length > 0 ? `${attendance.length} enregistrement(s)` : 'Aucun enregistrement'}
             </div>
           </div>
         </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-destructive">Erreur lors du chargement des présences: {error.message}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Chargement des présences...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Employé</TableHead>
                    <TableHead className="min-w-[120px]">Arrivée</TableHead>
                    <TableHead className="min-w-[120px]">Départ</TableHead>
                    <TableHead className="min-w-[150px]">Pause déjeuner</TableHead>
                    <TableHead className="min-w-[120px]">Heures travaillées</TableHead>
                    <TableHead className="min-w-[100px]">Statut</TableHead>
                    <TableHead className="min-w-[150px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {Array.isArray(attendance) && attendance.length > 0 ? (
                  attendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {(record.employee_name || record.employee?.name)?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{record.employee_name || record.employee?.name || "Employé"}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.position || record.employee?.position || "Poste non défini"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(record)}
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
                    <div className="text-sm">
                      {record.lunch_start && record.lunch_end ? (
                        <div>
                          <div>{record.lunch_start} - {record.lunch_end}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Non marqué</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {record.total_work_hours ? `${record.total_work_hours}h` : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(record)}
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune présence enregistrée pour cette date
                    </TableCell>
                  </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
