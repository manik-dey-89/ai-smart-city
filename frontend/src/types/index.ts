export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface DashboardStats {
  totalAlerts: number;
  activeEmergencies: number;
  trafficIncidents: number;
  aqiStatus: 'good' | 'moderate' | 'poor' | 'unhealthy';
  weather: {
    temp: number;
    condition: string;
    humidity: number;
  };
}

export interface MarkerData {
  id: number;
  type: 'hospital' | 'police' | 'fire' | 'bin' | 'truck' | 'sensor' | 'station';
  lat: number;
  lng: number;
  name: string;
  status?: string;
  fillPercent?: number;
}

export interface Complaint {
  id: number;
  type: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: string;
  imageUrl?: string;
}
