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
