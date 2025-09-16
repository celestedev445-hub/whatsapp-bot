import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs d'authentification
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expiré ou invalide, rediriger vers la page de connexion
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface Employee {
  id: number;
  whatsapp_id: string;
  name: string;
  phone: string;
  position?: string;
  department?: string;
  department_id?: number;
  department_name?: string;
  is_active: boolean;
  custom_start_time?: string;
  custom_end_time?: string;
  custom_late_threshold?: number;
  hours_type?: 'Personnalisées' | 'Par défaut';
  created_at: string;
  updated_at: string;
}

export interface EmployeeCustomHours {
  startTime: string;
  endTime: string;
  lateThreshold: number;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  arrival_time?: string;
  departure_time?: string;
  lunch_start?: string;
  lunch_end?: string;
  total_work_hours?: number;
  status: "present" | "absent" | "late" | "late_justified" | "permission";
  notes?: string;
  employee?: Employee;
  employee_name?: string; // Ajouté pour les jointures SQL
  position?: string; // Ajouté pour les jointures SQL
  department?: string; // Ajouté pour les jointures SQL
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  employee_id: number;
  type: "sick_leave" | "vacation" | "personal" | "medical" | "other";
  start_date: string;
  end_date: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approved_by?: number;
  approved_at?: string;
  employee?: Employee;
  employee_name?: string; // Ajouté pour les jointures SQL
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  message_id: string;
  from_number: string;
  to_number?: string;
  group_id?: string;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video';
  content: string;
  command_type?: string;
  processed?: boolean;
  created_at: string;
  employee_name?: string;
  position?: string;
  department?: string;
  department_name?: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  pendingPermissions: number;
  messagesProcessed: number;
}

export const api = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get("/api/admin/dashboard-stats");
    return response.data;
  },

  getRecentAttendance: async (): Promise<Attendance[]> => {
    const response = await apiClient.get("/api/attendance/recent");
    return response.data;
  },

  getPendingPermissions: async (): Promise<Permission[]> => {
    const response = await apiClient.get("/api/permissions/pending");
    return response.data;
  },

  // Employees
  getEmployees: async (): Promise<Employee[]> => {
    const response = await apiClient.get("/api/employees");
    return response.data;
  },

  getEmployee: async (id: number): Promise<Employee> => {
    const response = await apiClient.get(`/api/employees/${id}`);
    return response.data;
  },

  createEmployee: async (data: Partial<Employee>): Promise<Employee> => {
    const response = await apiClient.post("/api/employees", data);
    return response.data;
  },

  updateEmployee: async (id: number, data: Partial<Employee>): Promise<Employee> => {
    const response = await apiClient.put(`/api/employees/${id}`, data);
    return response.data;
  },

  deleteEmployee: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/employees/${id}`);
  },

  // Attendance
  getAttendance: async (params?: {
    employee_id?: number;
    date?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<Attendance[]> => {
    const response = await apiClient.get("/api/attendance", { params });
    return response.data;
  },

  getAttendanceStats: async (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> => {
    const response = await apiClient.get("/api/attendance/stats", { params });
    return response.data;
  },

  // Permissions
  getPermissions: async (params?: {
    employee_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Permission[]> => {
    const response = await apiClient.get("/api/permissions", { params });
    return response.data;
  },

  approvePermission: async (id: number): Promise<Permission> => {
    const response = await apiClient.put(`/api/permissions/${id}/approve`);
    return response.data;
  },

  rejectPermission: async (id: number, reason?: string): Promise<Permission> => {
    const response = await apiClient.put(`/api/permissions/${id}/reject`, { reason });
    return response.data;
  },

  // Messages
  getMessages: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ messages: Message[]; pagination: any }> => {
    const response = await apiClient.get("/api/messages", { params });
    return response.data;
  },

  getRecentMessages: async (limit?: number): Promise<Message[]> => {
    const response = await apiClient.get("/api/messages/recent", { params: { limit } });
    return response.data;
  },

  sendMessage: async (content: string, message_type: string = 'text'): Promise<any> => {
    const response = await apiClient.post("/api/messages/send", { content, message_type });
    return response.data;
  },

  sendMessageToDepartment: async (content: string, department_id: number, message_type: string = 'text'): Promise<any> => {
    const response = await apiClient.post("/api/messages/send-to-department", { 
      content, 
      department_id, 
      message_type 
    });
    return response.data;
  },

  getMessageStats: async (): Promise<any> => {
    const response = await apiClient.get("/api/messages/stats");
    return response.data;
  },

  // Reports
  generateReport: async (type: string, params?: any): Promise<any> => {
    const response = await apiClient.post("/api/reports/generate", { type, ...params });
    return response.data;
  },

  getReports: async (): Promise<any[]> => {
    const response = await apiClient.get("/api/reports");
    return response.data;
  },

  // Health check
  getHealth: async (): Promise<any> => {
    const response = await apiClient.get("/health");
    return response.data;
  },

  // Admin functions
  getBotStatus: async (): Promise<any> => {
    const response = await apiClient.get("/api/admin/bot-status");
    return response.data;
  },
  initBot: async (): Promise<any> => {
    const response = await apiClient.post("/api/admin/init-bot");
    return response.data;
  },
  syncMembers: async (): Promise<any> => {
    const response = await apiClient.post("/api/admin/sync-members");
    return response.data;
  },

  // Department functions
  getDepartments: async (): Promise<Department[]> => {
    const response = await apiClient.get("/api/departments");
    return response.data;
  },

  getDepartment: async (id: number): Promise<Department> => {
    const response = await apiClient.get(`/api/departments/${id}`);
    return response.data;
  },

  getDepartmentEmployees: async (id: number): Promise<Employee[]> => {
    const response = await apiClient.get(`/api/departments/${id}/employees`);
    return response.data;
  },

  createDepartment: async (data: { name: string; description?: string }): Promise<any> => {
    const response = await apiClient.post("/api/departments", data);
    return response.data;
  },

  updateDepartment: async (id: number, data: { name: string; description?: string }): Promise<any> => {
    const response = await apiClient.put(`/api/departments/${id}`, data);
    return response.data;
  },

  deleteDepartment: async (id: number): Promise<any> => {
    const response = await apiClient.delete(`/api/departments/${id}`);
    return response.data;
  },

  assignEmployeeToDepartment: async (employeeId: number, departmentId: number): Promise<any> => {
    const response = await apiClient.put(`/api/employees/${employeeId}/department`, { departmentId });
    return response.data;
  },

  removeEmployeeFromDepartment: async (employeeId: number): Promise<any> => {
    const response = await apiClient.delete(`/api/employees/${employeeId}/department`);
    return response.data;
  },

  getAllEmployees: async (): Promise<Employee[]> => {
    const response = await apiClient.get("/api/employees/all");
    return response.data;
  },

  // Employee Custom Hours
  getEmployeeCustomHours: async (id: number): Promise<EmployeeCustomHours | null> => {
    const response = await apiClient.get(`/api/employee-hours/${id}`);
    return response.data.data;
  },

  setEmployeeCustomHours: async (id: number, data: EmployeeCustomHours): Promise<EmployeeCustomHours> => {
    const response = await apiClient.post(`/api/employee-hours/${id}`, data);
    return response.data.data;
  },

  updateEmployeeCustomHours: async (id: number, data: Partial<EmployeeCustomHours>): Promise<EmployeeCustomHours> => {
    const response = await apiClient.put(`/api/employee-hours/${id}`, data);
    return response.data.data;
  },

  removeEmployeeCustomHours: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/employee-hours/${id}`);
  },

  getAllEmployeesWithHours: async (): Promise<Employee[]> => {
    const response = await apiClient.get("/api/employee-hours");
    return response.data.data;
  },
};
