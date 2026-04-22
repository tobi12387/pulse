// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
}

// Garmin
export interface GarminStatusResponse {
  connected: boolean;
  lastSync: string | null;   // ISO datetime
  syncStatus: 'ok' | 'stale' | 'error' | 'never';
  errorMessage: string | null;
}

// Generic
export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
