// TypeScript type definitions and interfaces
// Export all your types from this file

import { Ionicons } from '@expo/vector-icons';

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

// Employee related types
export interface Employee {
  name: string;
  employee_name: string;
  user_id: string;
  status: string;
}

export interface EmployeeCheckin {
  name: string;
  employee: string;
  time: string;
  log_type: 'IN' | 'OUT';
  creation: string;
  device_id?: string;
  is_missing_punch_entry?: number; // 1 if manually submitted as missing punch, 0 otherwise
}

// Quick Action types
export interface QuickAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

// Greeting types
export interface GreetingIcon {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Update/Notification types
export interface Update {
  name: string;
  subject: string;
  content: string;
  creation: string;
  user: string;
}

// Add more shared types here
