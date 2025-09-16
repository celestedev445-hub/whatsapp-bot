"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  MessageSquare, 
  Send, 
  CheckCircle, 
  CheckCircle2,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Phone,
  Video,
  Smile,
  Paperclip,
  Mic,
  ArrowLeft,
  Users,
  Settings
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { api, Message } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

export function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [messageType, setMessageType] = useState("all");
  const [processedFilter, setProcessedFilter] = useState("all");
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showDepartments, setShowDepartments] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer les vrais messages de l'API
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", searchTerm, messageType, processedFilter],
    queryFn: () => api.getMessages({ page: 1, limit: 100 }),
  });

  // Récupérer les départements
  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
  });

  // Récupérer les employés par département
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: () => api.getAllEmployees(),
    enabled: true, // Toujours charger les employés
  });


  // Gérer le cas où messages pourrait être un objet unique ou un tableau
  let messages: Message[] = [];
  if (Array.isArray(messagesData?.messages)) {
    messages = messagesData.messages;
  } else if (messagesData?.messages && typeof messagesData.messages === 'object') {
    messages = [messagesData.messages];
  }

  // Auto-scroll vers le bas des messages (messages les plus récents)
  useEffect(() => {
    // Scroll vers le bas de la zone des messages pour voir les messages les plus récents
    const messagesContainer = document.querySelector('.flex-1.overflow-y-auto.bg-gray-50');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);

  // Grouper les messages par date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    // Trier les messages par date croissante (plus anciens en premier, comme WhatsApp)
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    sortedMessages.forEach(message => {
      const date = new Date(message.created_at);
      const dateKey = isToday(date) ? 'Aujourd\'hui' : 
                     isYesterday(date) ? 'Hier' : 
                     format(date, 'dd MMMM yyyy', { locale: fr });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    // Trier les groupes par date croissante et trier les messages dans chaque groupe
    const sortedGroups: { [key: string]: Message[] } = {};
    Object.keys(groups)
      .sort((a, b) => {
        // Trier les clés de date (dates anciennes en premier, puis Hier, puis Aujourd'hui)
        if (a === 'Aujourd\'hui') return 1;
        if (b === 'Aujourd\'hui') return -1;
        if (a === 'Hier') return 1;
        if (b === 'Hier') return -1;
        
        // Pour les autres dates, trier par date croissante
        const dateA = new Date(a.split(' ').reverse().join('-'));
        const dateB = new Date(b.split(' ').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      })
      .forEach(key => {
        // Trier les messages dans chaque groupe par date croissante (anciens en premier)
        sortedGroups[key] = groups[key].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    
    return sortedGroups;
  };

  // Filtrer les messages
  const filteredMessages: Message[] = Array.isArray(messages) ? messages.filter((m: Message) => {
    // Filtre par département si un département est sélectionné
    if (selectedDepartment) {
      // Récupérer les employés du département sélectionné
      const departmentEmployees = (employeesData as any[])?.filter((emp: any) => 
        emp.department_id === parseInt(selectedDepartment) && emp.is_active
      ) || [];
      
      // Vérifier si le message provient d'un employé du département
      const isFromDepartment = departmentEmployees.some((emp: any) => 
        m.employee_name === emp.name || 
        m.from_number?.includes(emp.phone) ||
        (m as any).employee_id === emp.id
      );
      
      if (!isFromDepartment) {
        return false;
      }
    }
    
    // Filtres existants
    if (searchTerm && !m.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (messageType !== 'all' && m.message_type !== messageType) {
      return false;
    }
    if (processedFilter !== 'all') {
      const isProcessed = m.processed || false;
      if (processedFilter === 'processed' && !isProcessed) {
        return false;
      }
      if (processedFilter === 'pending' && isProcessed) {
        return false;
      }
    }
    return true;
  }) : [];

  const groupedMessages = groupMessagesByDate(filteredMessages);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsSending(true);
      
      if (selectedDepartment) {
        // Envoyer le message à tous les employés du département
        const departmentEmployees = (employeesData as any[])?.filter((emp: any) => 
          emp.department_id === parseInt(selectedDepartment) && emp.is_active
        ) || [];
        
        if (departmentEmployees.length === 0) {
          toast({
            title: "Aucun employé",
            description: "Aucun employé actif dans ce département",
            variant: "destructive",
          });
          return;
        }

        // Envoyer le message au département via l'API
        const result = await api.sendMessageToDepartment(
          newMessage.trim(), 
          parseInt(selectedDepartment)
        );
        
        toast({
          title: "Message envoyé",
          description: result.message || `Message envoyé à ${departmentEmployees.length} employé(s) du département`,
          variant: "success",
        });
      } else {
        // Envoyer le message au groupe principal
      await api.sendMessage(newMessage.trim());
        
        toast({
          title: "Message envoyé",
          description: "Votre message a été envoyé au groupe principal",
          variant: "success",
        });
      }
      
      setNewMessage("");
      await queryClient.invalidateQueries({ queryKey: ["messages"] });
      
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Simuler l'indicateur de frappe
  useEffect(() => {
    if (newMessage.trim()) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [newMessage]);

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    return format(messageDate, 'HH:mm', { locale: fr });
  };

  // Fonction pour récupérer le nom de l'employé à partir du numéro de téléphone
  const getEmployeeNameFromPhone = (fromNumber: string) => {
    if (!fromNumber || !employeesData) return null;
    
    // Nettoyer le numéro de téléphone (enlever le préfixe + et @c.us)
    const cleanPhone = fromNumber.replace(/^\+/, '').replace(/@c\.us$/, '');
    
    // Chercher l'employé correspondant
    const employee = (employeesData as any[])?.find((emp: any) => 
      emp.phone === cleanPhone || 
      emp.phone === fromNumber ||
      fromNumber.includes(emp.phone)
    );
    
    return employee?.name || null;
  };

  const getMessageStatus = (message: Message) => {
    const isProcessed = message.processed || false;
    return isProcessed ? (
      <div className="flex items-center space-x-1">
        <CheckCircle2 className="h-3 w-3 text-blue-500" />
        <CheckCircle2 className="h-3 w-3 text-blue-500 -ml-1" />
      </div>
    ) : (
      <div className="flex items-center space-x-1">
        <CheckCircle className="h-3 w-3 text-gray-400" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement des messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar des conversations */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* En-tête de la sidebar */}
        <div className="p-4 bg-green-600 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Promillys Bot</h1>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <Users className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <Settings className="h-5 w-5" />
              </Button>
          </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="p-3 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher ou commencer une nouvelle conversation"
              className="pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Liste des conversations */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {/* Groupe Principal */}
            <div 
              className={`rounded-lg p-3 mb-2 cursor-pointer transition-colors ${
                !selectedDepartment ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => setSelectedDepartment(null)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Groupe Principal</h3>
                  <p className="text-sm text-gray-600">
                    {!selectedDepartment 
                      ? `${filteredMessages.length} message${filteredMessages.length > 1 ? 's' : ''}`
                      : 'Tous les messages'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {!selectedDepartment && filteredMessages.length > 0 ? 
                      formatMessageTime(filteredMessages[filteredMessages.length - 1].created_at) : 
                      '--:--'
                    }
                  </p>
                  <div className="flex justify-end mt-1">
                    {!selectedDepartment && filteredMessages.length > 0 && getMessageStatus(filteredMessages[filteredMessages.length - 1])}
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton pour afficher/masquer les départements */}
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDepartments(!showDepartments)}
                className="w-full justify-start text-gray-600 hover:text-gray-900"
              >
                <Users className="h-4 w-4 mr-2" />
                Départements ({departmentsData?.length || 0})
                {showDepartments ? ' ▲' : ' ▼'}
              </Button>
            </div>

            {/* Liste des départements */}
            {showDepartments && (
              <div className="space-y-1">
                {(departmentsData as any[])?.map((department: any) => {
                  const departmentEmployees = (employeesData as any[])?.filter((emp: any) => 
                    emp.department_id === department.id && emp.is_active
                  ) || [];
                  
                  // Compter les messages de ce département
                  const departmentMessages = Array.isArray(messages) ? messages.filter((m: Message) => {
                    return departmentEmployees.some((emp: any) => 
                      m.employee_name === emp.name || 
                      m.from_number?.includes(emp.phone) ||
                      (m as any).employee_id === emp.id
                    );
                  }) : [];
                  
                  return (
                    <div
                      key={department.id}
                      className={`rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedDepartment === department.id.toString() 
                          ? 'bg-blue-50 border-2 border-blue-200' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedDepartment(department.id.toString())}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{department.name}</h4>
                          <p className="text-sm text-gray-600">
                            {departmentEmployees.length} employé{departmentEmployees.length > 1 ? 's' : ''} • {departmentMessages.length} message{departmentMessages.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}
      </div>
          </div>

        {/* Filtres */}
        <div className="p-3 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full justify-start"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtres
          </Button>
          
          {showFilters && (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs text-gray-600">Type de message</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger className="h-8">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="text">Texte</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
              <div>
                <Label className="text-xs text-gray-600">Statut</Label>
              <Select value={processedFilter} onValueChange={setProcessedFilter}>
                  <SelectTrigger className="h-8">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="processed">Traités</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Zone de chat principale */}
      <div className="flex-1 flex flex-col">
        {/* En-tête du chat */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedDepartment ? 'bg-blue-500' : 'bg-green-500'
              }`}>
                {selectedDepartment ? (
                  <Users className="h-5 w-5 text-white" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  {selectedDepartment 
                    ? (departmentsData as any[])?.find((d: any) => d.id.toString() === selectedDepartment)?.name || 'Département'
                    : 'Groupe Principal'
                  }
                </h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedDepartment ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                  <p className="text-sm text-gray-600">
                    {selectedDepartment 
                      ? `${(employeesData as any[])?.filter((emp: any) => emp.department_id === parseInt(selectedDepartment) && emp.is_active).length || 0} employé(s) • ${filteredMessages.length} message${filteredMessages.length > 1 ? 's' : ''}`
                      : 'En ligne • Promillys Bot'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedDepartment && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedDepartment(null)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Retour au groupe
                </Button>
              )}
              <Button variant="ghost" size="sm">
                <Phone className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Zone des messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23f0f0f0" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'}}>
          {/* Liste des employés du département sélectionné */}
          {selectedDepartment && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Employés du département ({employeesData?.filter(emp => emp.department_id === parseInt(selectedDepartment) && emp.is_active).length || 0})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {employeesData?.filter(emp => emp.department_id === parseInt(selectedDepartment) && emp.is_active).map((employee: any) => (
                  <div key={employee.id} className="flex items-center space-x-2 bg-white px-2 py-1 rounded-full border border-blue-200">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        {employee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-700">{employee.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.entries(groupedMessages).map(([date, messages]) => (
            <div key={date}>
              {/* En-tête de date */}
              <div className="flex justify-center my-4">
                <div className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
                  <span className="text-xs text-gray-600 font-medium">{date}</span>
                </div>
              </div>
              
              {/* Messages du jour */}
              <div className="space-y-1">
                {messages.map((message: Message, index: number) => {
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const isConsecutive = prevMessage && 
                    prevMessage.employee_name === message.employee_name &&
                    new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000; // 5 minutes
                  
                  return (
                    <div key={message.id} className={`flex items-start space-x-2 ${isConsecutive ? 'mt-0' : 'mt-3'}`}>
                      {!isConsecutive && (
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-green-500 text-white">
                            {(message.employee_name || getEmployeeNameFromPhone(message.from_number)) ? 
                              (message.employee_name || getEmployeeNameFromPhone(message.from_number))!.split(' ').map((n: string) => n[0]).join('').toUpperCase() :
                              message.from_number?.slice(-4) || 'U'
                            }
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {isConsecutive && <div className="w-8" />}
                      <div className="flex-1 max-w-xs">
                        {!isConsecutive && (
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {message.employee_name || getEmployeeNameFromPhone(message.from_number) || `Utilisateur ${message.from_number?.slice(-4)}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`bg-white rounded-lg p-3 shadow-sm ${isConsecutive ? 'ml-10' : ''}`}>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center space-x-1">
                              {message.message_type !== 'text' && (
                                <Badge variant="outline" className="text-xs">
                                  {message.message_type}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-gray-500">
                                {formatMessageTime(message.created_at)}
                              </span>
                              {getMessageStatus(message)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredMessages.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {selectedDepartment 
                    ? `Aucun message du département ${(departmentsData as any[])?.find((d: any) => d.id.toString() === selectedDepartment)?.name}`
                    : 'Aucun message trouvé'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDepartment 
                    ? 'Les messages des employés de ce département apparaîtront ici'
                    : searchTerm 
                      ? 'Essayez de modifier vos critères de recherche' 
                      : 'Les messages apparaîtront ici'
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* Indicateur de frappe */}
          {isTyping && (
            <div className="flex items-start space-x-2 mt-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-gray-600" />
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center space-x-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">Promillys Bot tape...</span>
                </div>
              </div>
            </div>
          )}
          
        </div>

        {/* Zone de saisie */}
        <div className="bg-white border-t border-gray-200 p-4">
          {/* Indicateur du destinataire */}
          {selectedDepartment && (
            <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Envoi au département: <strong>{(departmentsData as any[])?.find((d: any) => d.id.toString() === selectedDepartment)?.name}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDepartment(null)}
                  className="text-blue-600 hover:text-blue-800 p-1 h-auto"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex items-end space-x-2">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
              <Smile className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
              <Paperclip className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <div className="bg-gray-100 rounded-full px-4 py-2 flex items-center min-h-[40px] max-h-32">
                <Input
                  placeholder={selectedDepartment ? "Message au département..." : "Tapez un message"}
                  className="border-0 bg-transparent focus:ring-0 focus:outline-none resize-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />
              </div>
            </div>
            {newMessage.trim() ? (
              <LoadingButton 
                size="sm" 
                className="rounded-full bg-green-500 hover:bg-green-600 text-white w-10 h-10 p-0"
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                isLoading={isSending}
                loadingText=""
              >
                <Send className="h-4 w-4" />
              </LoadingButton>
            ) : (
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 w-10 h-10 p-0">
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
