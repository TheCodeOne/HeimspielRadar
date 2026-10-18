export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
  timestamp?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string; // ISO string
  lastSyncedAt: string | null; // ISO string or null if never synced
}
