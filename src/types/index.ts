// TypeScript type definitions and interfaces
// Export all your types from this file

export interface User {
  employee_id: string;
  employee_name: string;
  email: string;
  api_key: string;
  api_secret: string;
  device_id: string;
  app_id: string;
  require_password_reset: boolean;
}

export interface ApiResponse<T = any> {
  message?: T;
  data?: T;
  error?: string;
}

// Add more shared types here
