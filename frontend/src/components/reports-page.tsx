"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart3, 
  FileText,
  TrendingUp
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

export function ReportsPage() {
  const [reportType, setReportType] = useState("daily");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();


  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      const report = await api.generateReport(reportType, {
        start_date: startDate,
        end_date: endDate,
      });
      console.log("Rapport généré:", report);
      setGeneratedReport(report.data);
      
      toast({
        title: "Succès",
        description: "Rapport généré avec succès",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur lors de la génération du rapport:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du rapport",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
          <p className="text-muted-foreground">
            Génération et consultation des rapports d'activité
          </p>
        </div>
      </div>

      {/* Génération de rapport */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Générer un rapport
          </CardTitle>
          <CardDescription>
            Créez un nouveau rapport personnalisé
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Type de rapport</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Quotidien</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <LoadingButton 
                onClick={handleGenerateReport} 
                className="w-full"
                isLoading={isGenerating}
                loadingText="Génération..."
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Générer
              </LoadingButton>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Détails du rapport sélectionné */}
      {generatedReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails du rapport - {generatedReport.metadata.type}
            </CardTitle>
            <CardDescription>
              Période: {format(new Date(generatedReport.metadata.period.start_date), "dd/MM/yyyy", { locale: fr })} - {format(new Date(generatedReport.metadata.period.end_date), "dd/MM/yyyy", { locale: fr })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Résumé</TabsTrigger>
                <TabsTrigger value="attendance">Présences</TabsTrigger>
                <TabsTrigger value="employees">Employés</TabsTrigger>
                <TabsTrigger value="departments">Départements</TabsTrigger>
              </TabsList>
              
              {/* Onglet Résumé */}
              <TabsContent value="summary" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Total des enregistrements</p>
                    <p className="text-2xl font-bold">{generatedReport.summary.total_records}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Employés uniques</p>
                    <p className="text-2xl font-bold">{generatedReport.summary.unique_employees}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Présents</p>
                    <p className="text-2xl font-bold text-green-600">{generatedReport.summary.present_count}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Retards</p>
                    <p className="text-2xl font-bold text-yellow-600">{generatedReport.summary.late_count}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Onglet Données de présence */}
              <TabsContent value="attendance" className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Données de présence</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employé</TableHead>
                          <TableHead>Département</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Heure d'arrivée</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedReport.attendance_data.map((attendance: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{attendance.employee_name}</TableCell>
                            <TableCell>{attendance.department_name || "Non défini"}</TableCell>
                            <TableCell>{format(new Date(attendance.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                            <TableCell>{attendance.arrival_time}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={attendance.status === 'present' ? 'default' : 
                                        attendance.status === 'late' ? 'secondary' : 
                                        attendance.status === 'late_justified' ? 'default' : 'destructive'}
                                className={attendance.status === 'late_justified' ? 'bg-green-600' : ''}
                              >
                                {attendance.status === 'present' ? 'Présent' :
                                 attendance.status === 'late' ? 'Retard' :
                                 attendance.status === 'late_justified' ? 'Retard justifié' :
                                 attendance.status === 'absent' ? 'Absent' : 'Permission'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Onglet Statistiques par employé */}
              <TabsContent value="employees" className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Statistiques par employé</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employé</TableHead>
                          <TableHead>Département</TableHead>
                          <TableHead>Total jours</TableHead>
                          <TableHead>Présents</TableHead>
                          <TableHead>Retards</TableHead>
                          <TableHead>Taux de présence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedReport.employee_statistics.map((employee: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{employee.name}</TableCell>
                            <TableCell>{employee.department_name || "Non défini"}</TableCell>
                            <TableCell>{employee.total_days}</TableCell>
                            <TableCell className="text-green-600">{employee.present_days}</TableCell>
                            <TableCell className="text-yellow-600">{employee.late_days}</TableCell>
                            <TableCell>
                              <Badge variant={parseFloat(employee.attendance_rate) >= 80 ? 'default' : 'destructive'}>
                                {employee.attendance_rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Onglet Statistiques par département */}
              <TabsContent value="departments" className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Statistiques par département</h3>
                  {generatedReport.department_statistics.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Département</TableHead>
                            <TableHead>Employés</TableHead>
                            <TableHead>Total jours</TableHead>
                            <TableHead>Présents</TableHead>
                            <TableHead>Retards</TableHead>
                            <TableHead>Taux de présence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generatedReport.department_statistics.map((dept: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{dept.department_name}</TableCell>
                              <TableCell>{dept.employee_count}</TableCell>
                              <TableCell>{dept.total_days}</TableCell>
                              <TableCell className="text-green-600">{dept.present_days}</TableCell>
                              <TableCell className="text-yellow-600">{dept.late_days}</TableCell>
                              <TableCell>
                                <Badge variant={parseFloat(dept.attendance_rate) >= 80 ? 'default' : 'destructive'}>
                                  {dept.attendance_rate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucune donnée de département disponible
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
