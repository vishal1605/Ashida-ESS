import { useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';

interface FrappeListOptions {
  fields?: string[];
  filters?: Record<string, any>;
  orderBy?: string;
  limitStart?: number;
  limitPageLength?: number;
}

interface FrappeResponse<T = any> {
  message?: T;
  data?: T;
}

export const useFrappeService = () => {
  const { siteUrl } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const apiKey = await SecureStore.getItemAsync('api_key');
      const apiSecret = await SecureStore.getItemAsync('api_secret');

      if (!apiKey || !apiSecret) {
        throw new Error('Authentication credentials not found');
      }

      return {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };
    } catch (err) {
      console.error('Error getting auth headers:', err);
      throw err;
    }
  }, []);

  const handleResponse = async <T,>(response: Response): Promise<T> => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        console.error('API Error Response:', errorJson);
        errorMessage = errorJson.message || errorJson.exc || errorJson.error || errorMessage;

        // If there's an exception trace, log it
        if (errorJson._server_messages) {
          console.error('Server Messages:', errorJson._server_messages);
        }
      } catch {
        console.error('Raw Error Text:', errorText);
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const data: FrappeResponse<T> = await response.json();
    return (data.message || data.data || data) as T;
  };

  const getList = useCallback(
    async <T = any>(doctype: string, options?: FrappeListOptions): Promise<T[]> => {
      setLoading(true);
      setError(null);

      try {
        // ========================================================================
        // MOCK DATA FOR TEST ADMIN USER
        // ========================================================================
        const apiKey = await SecureStore.getItemAsync('api_key');
        if (apiKey === 'dummy_api_key_test_admin') {
          console.log('🔧 Test admin detected - returning mock data for:', doctype);

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 300));

          // Mock Employee data
          if (doctype === 'Employee') {
            const currentYear = new Date().getFullYear();
            const mockEmployeeData = [{
              name: 'EMP-TEST-ADMIN',
              employee_name: 'Test Administrator',
              user_id: 'test.admin@ashida.com',
              status: 'Active',
              holiday_list: `India Holidays ${currentYear}`,
              attendance_device_id: 'TEST-DEVICE-001'
            }];
            console.log('📦 Returning mock Employee data:', mockEmployeeData);
            setLoading(false);
            return mockEmployeeData as T[];
          }

          // Mock Holiday List data
          if (doctype === 'Holiday List') {
            const currentYear = new Date().getFullYear();
            const mockHolidayLists = [{
              name: `India Holidays ${currentYear}`,
              holiday_list_name: `India Holidays ${currentYear}`,
              from_date: `${currentYear}-01-01`,
              to_date: `${currentYear}-12-31`
            }];
            console.log('📦 Returning mock Holiday List data:', mockHolidayLists);
            setLoading(false);
            return mockHolidayLists as T[];
          }

          // Mock Employee Checkin data - return locally stored checkins
          if (doctype === 'Employee Checkin') {
            const storageKey = `test_admin_checkins`;
            const existingCheckins = await SecureStore.getItemAsync(storageKey);
            const mockCheckinData = existingCheckins ? JSON.parse(existingCheckins) : [];
            console.log('📦 Returning locally stored Employee Checkin data:', mockCheckinData);
            setLoading(false);
            return mockCheckinData as T[];
          }

          // Mock Work From Home Application data - merge with locally stored submissions
          if (doctype === 'Work From Home Application') {
            const today = new Date();
            const defaultMockWFHApplications = [
              {
                name: 'WFH-TEST-001',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 7).toISOString().split('T')[0],
                purpose_of_wfh: 'Personal work - Home renovation',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'WFH-TEST-002',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth(), 22).toISOString().split('T')[0],
                purpose_of_wfh: 'Medical appointment for family member',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-003',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0],
                purpose_of_wfh: 'Internet connectivity issues at home - need to set up backup',
                approval_status: 'Rejected',
                creation: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                reason_for_rejection: 'Please coordinate with IT department to resolve connectivity issues first',
              },
              {
                name: 'WFH-TEST-004',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 25).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 27).toISOString().split('T')[0],
                purpose_of_wfh: 'Project deadline - need focused work environment',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-005',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 12).toISOString().split('T')[0],
                purpose_of_wfh: 'Attending online training course',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 49 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-006',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 2, 5).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 2, 9).toISOString().split('T')[0],
                purpose_of_wfh: 'Heavy rainfall - commute safety concerns',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 79 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-007',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 15).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 17).toISOString().split('T')[0],
                purpose_of_wfh: 'Scheduled maintenance work at home - need to supervise',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'WFH-TEST-008',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 3, 20).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 3, 22).toISOString().split('T')[0],
                purpose_of_wfh: 'Client meeting scheduled near home location',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 109 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
            ];

            // Get locally stored WFH applications submitted by user
            const storageKey = 'test_admin_wfh_applications';
            const storedWFHApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = storedWFHApps ? JSON.parse(storedWFHApps) : [];

            // Merge default mock data with user-submitted applications
            const allApplications = [...userSubmittedApps, ...defaultMockWFHApplications];

            console.log('📦 Returning mock WFH Application data:', allApplications.length, 'applications (', userSubmittedApps.length, 'user-submitted +', defaultMockWFHApplications.length, 'default)');
            setLoading(false);
            return allApplications as T[];
          }

          // Mock OD Application data - merge with locally stored submissions
          if (doctype === 'OD Application') {
            const today = new Date();
            const defaultMockODApplications = [
              {
                name: 'OD-TEST-001',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 8).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().split('T')[0],
                od_type: 'Client Visit',
                od_type_description: 'Meeting with client for project requirements',
                per_day_rate: 500,
                location: 'Mumbai Office',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'OD-TEST-002',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth(), 18).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth(), 19).toISOString().split('T')[0],
                od_type: 'Training',
                od_type_description: 'Attending technical workshop on React Native',
                per_day_rate: 450,
                location: 'Hyderabad Training Center',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                approved_by: 'Manager Name',
              },
              {
                name: 'OD-TEST-003',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
                od_type: 'Site Visit',
                od_type_description: 'Server room inspection and maintenance',
                per_day_rate: 400,
                location: 'Client Data Center - Pune',
                approval_status: 'Rejected',
                creation: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_rejection: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                rejected_by: 'HR Manager',
                reason_for_rejection: 'Insufficient justification for on-duty request',
              },
              {
                name: 'OD-TEST-004',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 22).toISOString().split('T')[0],
                od_type: 'Conference',
                od_type_description: 'Technology conference and networking event',
                per_day_rate: 600,
                location: 'Delhi Convention Center',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 39 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                approved_by: 'Department Head',
              },
              {
                name: 'OD-TEST-005',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 5).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 7).toISOString().split('T')[0],
                od_type: 'Installation',
                od_type_description: 'Software deployment at client location',
                per_day_rate: 550,
                location: 'Chennai Branch Office',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 54 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                approved_by: 'Project Manager',
              },
              {
                name: 'OD-TEST-006',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 2, 15).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 2, 17).toISOString().split('T')[0],
                od_type: 'Client Meeting',
                od_type_description: 'Project review and planning session with stakeholders',
                per_day_rate: 500,
                location: 'Kolkata Client Office',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                approved_by: 'Team Lead',
              },
              {
                name: 'OD-TEST-007',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 25).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 27).toISOString().split('T')[0],
                od_type: 'Audit',
                od_type_description: 'IT infrastructure audit and compliance check',
                per_day_rate: 480,
                location: 'Ahmedabad Branch',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'OD-TEST-008',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 3, 10).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 3, 12).toISOString().split('T')[0],
                od_type: 'Vendor Meeting',
                od_type_description: 'Contract negotiation and vendor evaluation',
                per_day_rate: 520,
                location: 'Gurgaon Corporate Park',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 115 * 24 * 60 * 60 * 1000).toISOString(),
                date_of_approval: new Date(Date.now() - 114 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                approved_by: 'Senior Manager',
              },
            ];

            // Get locally stored OD applications submitted by user
            const storageKey = 'test_admin_od_applications';
            const storedODApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = storedODApps ? JSON.parse(storedODApps) : [];

            // Merge default mock data with user-submitted applications
            const allApplications = [...userSubmittedApps, ...defaultMockODApplications];

            console.log('📦 Returning mock OD Application data:', allApplications.length, 'applications (', userSubmittedApps.length, 'user-submitted +', defaultMockODApplications.length, 'default)');
            setLoading(false);
            return allApplications as T[];
          }

          // Mock Leave Application data - merge with locally stored submissions
          if (doctype === 'Leave Application') {
            const today = new Date();
            const defaultMockLeaveApplications = [
              {
                name: 'LEAVE-TEST-001',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Casual Leave',
                from_date: new Date(today.getFullYear(), today.getMonth() + 1, 12).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() + 1, 14).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Personal work - family function',
                status: 'Open',
                posting_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'LEAVE-TEST-002',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Sick Leave',
                from_date: new Date(today.getFullYear(), today.getMonth(), 22).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth(), 23).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Medical appointment and recovery',
                status: 'Approved',
                posting_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'Manager Name',
              },
              {
                name: 'LEAVE-TEST-003',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Privilege Leave',
                from_date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Half Day (First Half)',
                custom_till_date_leave_value: 'Half Day (First Half)',
                description: 'Urgent personal work',
                status: 'Rejected',
                posting_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'HR Manager',
              },
              {
                name: 'LEAVE-TEST-004',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Casual Leave',
                from_date: new Date(today.getFullYear(), today.getMonth() - 1, 18).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Short vacation with family',
                status: 'Approved',
                posting_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'Team Lead',
              },
              {
                name: 'LEAVE-TEST-005',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Sick Leave',
                from_date: new Date(today.getFullYear(), today.getMonth() - 1, 8).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 1, 9).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Fever and cold symptoms',
                status: 'Approved',
                posting_date: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'Manager Name',
              },
              {
                name: 'LEAVE-TEST-006',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Privilege Leave',
                from_date: new Date(today.getFullYear(), today.getMonth() - 2, 10).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 2, 14).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Planned vacation - hill station trip',
                status: 'Approved',
                posting_date: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'Department Head',
              },
              {
                name: 'LEAVE-TEST-007',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Casual Leave',
                from_date: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() + 1, 6).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Half Day (First Half)',
                description: 'Attending wedding ceremony',
                status: 'Open',
                posting_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'LEAVE-TEST-008',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                leave_type: 'Compensatory Off',
                from_date: new Date(today.getFullYear(), today.getMonth() - 3, 25).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 3, 25).toISOString().split('T')[0],
                custom_from_date_leave_value: 'Full Day',
                custom_till_date_leave_value: 'Full Day',
                description: 'Comp off for weekend work',
                status: 'Approved',
                posting_date: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                creation: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
                leave_approver: 'Project Manager',
              },
            ];

            // Get locally stored Leave applications submitted by user
            const storageKey = 'test_admin_leave_applications';
            const storedLeaveApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = storedLeaveApps ? JSON.parse(storedLeaveApps) : [];

            // Merge default mock data with user-submitted applications
            const allApplications = [...userSubmittedApps, ...defaultMockLeaveApplications];

            console.log('📦 Returning mock Leave Application data:', allApplications.length, 'applications (', userSubmittedApps.length, 'user-submitted +', defaultMockLeaveApplications.length, 'default)');
            setLoading(false);
            return allApplications as T[];
          }

          // Mock Gate Pass Application data - merge with locally stored submissions
          if (doctype === 'Gate Pass Application') {
            const today = new Date();
            const defaultMockGatepassApplications = [
              {
                name: 'GP-TEST-001',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() + 1, 10, 14, 30).toISOString(),
                purpose_of_gp: 'Bank work - Account opening',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'GP-TEST-002',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth(), 20, 15, 0).toISOString(),
                purpose_of_gp: 'Doctor appointment - Regular checkup',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                approved_by: 'Manager Name',
                date_of_approval: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'GP-TEST-003',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth(), 10, 11, 0).toISOString(),
                purpose_of_gp: 'Personal shopping',
                approval_status: 'Rejected',
                creation: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                rejected_by: 'HR Manager',
                date_of_rejection: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                reason_for_rejection: 'Personal work not permitted during office hours',
              },
              {
                name: 'GP-TEST-004',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 1, 15, 13, 30).toISOString(),
                purpose_of_gp: 'Passport office visit - Document submission',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
                approved_by: 'Team Lead',
                date_of_approval: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'GP-TEST-005',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 1, 5, 16, 0).toISOString(),
                purpose_of_gp: 'Vehicle service - Scheduled maintenance',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
                approved_by: 'Manager Name',
                date_of_approval: new Date(Date.now() - 39 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'GP-TEST-006',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 2, 18, 14, 0).toISOString(),
                purpose_of_gp: 'Post office - Important courier pickup',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                approved_by: 'Department Head',
                date_of_approval: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              {
                name: 'GP-TEST-007',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() + 1, 5, 15, 30).toISOString(),
                purpose_of_gp: 'Government office - License renewal',
                approval_status: 'Pending',
                creation: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                name: 'GP-TEST-008',
                employee: 'EMP-TEST-ADMIN',
                employee_name: 'Test Administrator',
                date_of_application: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 3, 12, 12, 0).toISOString(),
                purpose_of_gp: 'Family emergency - Hospital visit',
                approval_status: 'Approved',
                creation: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                approved_by: 'Project Manager',
                date_of_approval: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
            ];

            // Get locally stored Gatepass applications submitted by user
            const storageKey = 'test_admin_gatepass_applications';
            const storedGatepassApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = storedGatepassApps ? JSON.parse(storedGatepassApps) : [];

            // Merge default mock data with user-submitted applications
            const allApplications = [...userSubmittedApps, ...defaultMockGatepassApplications];

            console.log('📦 Returning mock Gate Pass Application data:', allApplications.length, 'applications (', userSubmittedApps.length, 'user-submitted +', defaultMockGatepassApplications.length, 'default)');
            setLoading(false);
            return allApplications as T[];
          }

          // Mock Activity Log data
          if (doctype === 'Activity Log') {
            const mockActivityLog = [
              {
                name: 'ACT-TEST-001',
                subject: 'Welcome to Ashida ESS',
                content: 'Your test admin account has been successfully set up. You can now explore all features of the Employee Self Service portal.',
                creation: new Date().toISOString(),
                user: 'System'
              },
              {
                name: 'ACT-TEST-002',
                subject: 'Attendance Check-in Reminder',
                content: 'Don\'t forget to mark your attendance for today. Check-in and check-out are required for accurate attendance records.',
                creation: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                user: 'HR Department'
              },
              {
                name: 'ACT-TEST-003',
                subject: 'Leave Application Submitted',
                content: 'Your leave application has been successfully submitted and is pending approval from your manager.',
                creation: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
                user: 'Test Administrator'
              },
              {
                name: 'ACT-TEST-004',
                subject: 'New Feature: Attendance Calendar',
                content: 'The new attendance calendar feature is now available. You can view your monthly attendance, WFH days, and OD applications in one place.',
                creation: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                user: 'Admin'
              },
              {
                name: 'ACT-TEST-005',
                subject: 'Profile Update Required',
                content: 'Please review and update your profile information to ensure all details are current.',
                creation: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
                user: 'HR Department'
              },
              {
                name: 'ACT-TEST-006',
                subject: 'Work From Home Application Approved',
                content: 'Your WFH application for next week has been approved by your manager. Please ensure you have all necessary equipment.',
                creation: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
                user: 'Manager'
              },
              {
                name: 'ACT-TEST-007',
                subject: 'System Maintenance Notice',
                content: 'Scheduled maintenance will be performed this weekend. The system may be unavailable for a few hours.',
                creation: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
                user: 'IT Department'
              },
              {
                name: 'ACT-TEST-008',
                subject: 'Monthly Attendance Report',
                content: 'Your monthly attendance report for the previous month is now available for review in your dashboard.',
                creation: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
                user: 'System'
              }
            ];
            console.log('📦 Returning mock Activity Log data:', mockActivityLog.length, 'entries');
            setLoading(false);
            return mockActivityLog as T[];
          }

          // For other doctypes, return empty array
          console.log('📦 Returning empty array for doctype:', doctype);
          setLoading(false);
          return [] as T[];
        }
        // ========================================================================
        // END MOCK DATA
        // ========================================================================

        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const params = new URLSearchParams();

        if (options?.fields) {
          params.append('fields', JSON.stringify(options.fields));
        }

        if (options?.filters) {
          params.append('filters', JSON.stringify(options.filters));
        }

        if (options?.orderBy) {
          params.append('order_by', options.orderBy);
        }

        if (options?.limitStart !== undefined) {
          params.append('limit_start', options.limitStart.toString());
        }

        if (options?.limitPageLength !== undefined) {
          params.append('limit_page_length', options.limitPageLength.toString());
        }

        const url = `${siteUrl}/api/resource/${doctype}?${params.toString()}`;
        console.log('Fetching from URL:', url);
        console.log('Request options:', options);

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        return await handleResponse<T[]>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch list';
        setError(errorMessage);
        console.error(`Error fetching ${doctype} list:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const getDoc = useCallback(
    async <T = any>(doctype: string, name: string): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        // ========================================================================
        // MOCK GET DOC FOR TEST ADMIN USER
        // ========================================================================
        const apiKey = await SecureStore.getItemAsync('api_key');
        if (apiKey === 'dummy_api_key_test_admin') {
          console.log('🔧 Test admin detected - returning mock doc for:', doctype, name);

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 500));

          // Mock Employee profile details
          if (doctype === 'Employee' && name === 'EMP-TEST-ADMIN') {
            const mockEmployeeProfile = {
              name: 'EMP-TEST-ADMIN',
              employee_name: 'Test Administrator',
              employee_number: 'EMP-2025-001',
              designation: 'Senior Software Engineer',
              department: 'Information Technology',
              company: 'Ashida Business Solutions',
              branch: 'Bangalore - Head Office',
              gender: 'Male',
              date_of_birth: '1990-05-15',
              date_of_joining: '2020-01-10',
              status: 'Active',
              company_email: 'test.admin@ashida.com',
              user_id: 'test.admin@ashida.com',
              personal_email: 'testadmin.personal@gmail.com',
              cell_number: '+91 9876543210',
              current_address: '123 MG Road, Koramangala, Bangalore - 560095, Karnataka, India',
              permanent_address: '456 Residency Road, Jayanagar, Bangalore - 560041, Karnataka, India',
              reports_to: 'John Doe (Manager)',
              attendance_device_id: 'TEST-DEVICE-001',
              employment_type: 'Full-time',
              blood_group: 'O+',
              marital_status: 'Single',
              pan_number: 'ABCDE1234F',
              aadhaar_number: '1234 5678 9012',
              notice_number_of_days: 30,
              prefered_contact_email: 'test.admin@ashida.com',
              emergency_phone_number: '+91 9876543211',
              person_to_be_contacted: 'Jane Doe (Sister)',
            };

            console.log('📦 Returning mock Employee profile:', mockEmployeeProfile);
            setLoading(false);
            return mockEmployeeProfile as T;
          }

          // Mock Holiday List document - handle any year dynamically
          if (doctype === 'Holiday List' && name.startsWith('India Holidays')) {
            const currentYear = new Date().getFullYear();

            // Generate holidays for the current year
            const mockHolidayListDoc = {
              name: `India Holidays ${currentYear}`,
              holiday_list_name: `India Holidays ${currentYear}`,
              from_date: `${currentYear}-01-01`,
              to_date: `${currentYear}-12-31`,
              holidays: [
                { holiday_date: `${currentYear}-01-26`, description: 'Republic Day' },
                { holiday_date: `${currentYear}-03-14`, description: 'Holi' },
                { holiday_date: `${currentYear}-03-31`, description: 'Eid ul-Fitr' },
                { holiday_date: `${currentYear}-04-14`, description: 'Ugadi / Gudi Padwa' },
                { holiday_date: `${currentYear}-04-18`, description: 'Good Friday' },
                { holiday_date: `${currentYear}-05-01`, description: 'May Day / Labour Day' },
                { holiday_date: `${currentYear}-06-07`, description: 'Eid ul-Adha' },
                { holiday_date: `${currentYear}-08-15`, description: 'Independence Day' },
                { holiday_date: `${currentYear}-08-27`, description: 'Janmashtami' },
                { holiday_date: `${currentYear}-10-02`, description: 'Gandhi Jayanti' },
                { holiday_date: `${currentYear}-10-12`, description: 'Dussehra / Vijaya Dashami' },
                { holiday_date: `${currentYear}-10-20`, description: 'Diwali' },
                { holiday_date: `${currentYear}-10-21`, description: 'Diwali (Second Day)' },
                { holiday_date: `${currentYear}-11-05`, description: 'Guru Nanak Jayanti' },
                { holiday_date: `${currentYear}-12-25`, description: 'Christmas Day' },
              ]
            };

            console.log('📦 Returning mock Holiday List document for year', currentYear, 'with', mockHolidayListDoc.holidays.length, 'holidays');
            setLoading(false);
            return mockHolidayListDoc as T;
          }

          // For other documents, return mock data
          const mockDoc = {
            name: name,
            doctype: doctype,
            creation: new Date().toISOString(),
            modified: new Date().toISOString(),
          };

          console.log('📦 Returning mock document:', mockDoc);
          setLoading(false);
          return mockDoc as T;
        }
        // ========================================================================
        // END MOCK GET DOC
        // ========================================================================

        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'GET',
            headers,
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch document';
        setError(errorMessage);
        console.error(`Error fetching ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const createDoc = useCallback(
    async <T = any>(doctype: string, doc: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        // ========================================================================
        // MOCK CREATE FOR TEST ADMIN USER
        // ========================================================================
        const apiKey = await SecureStore.getItemAsync('api_key');
        if (apiKey === 'dummy_api_key_test_admin') {
          console.log('🔧 Test admin detected - mocking create for:', doctype);
          console.log('📦 Data to create:', doc);

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 500));

          // Mock Employee Checkin creation
          if (doctype === 'Employee Checkin') {
            const mockCheckinRecord = {
              name: `EMP-CHECKIN-TEST-${Date.now()}`,
              employee: doc.employee,
              time: doc.time,
              log_type: doc.log_type,
              device_id: doc.device_id,
              creation: doc.time,
              modified: doc.time,
              docstatus: 1
            };

            // Store locally in SecureStore
            const storageKey = `test_admin_checkins`;
            const existingCheckins = await SecureStore.getItemAsync(storageKey);
            const checkins = existingCheckins ? JSON.parse(existingCheckins) : [];
            checkins.push(mockCheckinRecord);
            await SecureStore.setItemAsync(storageKey, JSON.stringify(checkins));

            console.log('✅ Mock Employee Checkin created locally:', mockCheckinRecord);
            console.log('📍 Location stored:', doc.device_id);

            setLoading(false);
            return mockCheckinRecord as T;
          }

          // Mock Work From Home Application creation
          if (doctype === 'Work From Home Application') {
            // Validation: Check for duplicate date ranges
            const newStartDate = new Date(doc.wfh_start_date);
            const newEndDate = new Date(doc.wfh_end_date);

            // Get all existing WFH applications (user-submitted + default mock data)
            const storageKey = 'test_admin_wfh_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = existingApps ? JSON.parse(existingApps) : [];

            // Default mock WFH applications for validation
            const today = new Date();
            const defaultMockWFHApplications = [
              {
                name: 'WFH-TEST-001',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 7).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-002',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth(), 22).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-003',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-004',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 25).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 27).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-005',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 12).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-006',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 2, 5).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 2, 9).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-007',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 15).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 17).toISOString().split('T')[0],
              },
              {
                name: 'WFH-TEST-008',
                wfh_start_date: new Date(today.getFullYear(), today.getMonth() - 3, 20).toISOString().split('T')[0],
                wfh_end_date: new Date(today.getFullYear(), today.getMonth() - 3, 22).toISOString().split('T')[0],
              },
            ];

            // Merge all applications for validation
            const allApplications = [...userSubmittedApps, ...defaultMockWFHApplications];

            // Check for date range overlap
            for (const app of allApplications) {
              const existingStartDate = new Date(app.wfh_start_date);
              const existingEndDate = new Date(app.wfh_end_date);

              // Check if date ranges overlap
              // Ranges overlap if: new_start <= existing_end AND new_end >= existing_start
              if (newStartDate <= existingEndDate && newEndDate >= existingStartDate) {
                const formatDate = (date: Date) => date.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                setLoading(false);
                throw new Error(
                  `This date range overlaps with an existing WFH application (${formatDate(existingStartDate)} - ${formatDate(existingEndDate)}). Please choose different dates.`
                );
              }
            }

            // No overlap, create the application
            const mockWFHRecord = {
              name: `WFH-USER-${Date.now()}`,
              employee: doc.employee,
              employee_name: doc.employee_name,
              department: doc.department,
              attendance_device_id: doc.attendance_device_id,
              wfh_start_date: doc.wfh_start_date,
              wfh_end_date: doc.wfh_end_date,
              purpose_of_wfh: doc.purpose_of_wfh,
              approval_status: doc.approval_status || 'Pending',
              creation: new Date().toISOString(),
              modified: new Date().toISOString(),
              docstatus: 0
            };

            // Store locally in SecureStore
            userSubmittedApps.unshift(mockWFHRecord); // Add to beginning (newest first)
            await SecureStore.setItemAsync(storageKey, JSON.stringify(userSubmittedApps));

            console.log('✅ Mock WFH Application created locally:', mockWFHRecord);

            setLoading(false);
            return mockWFHRecord as T;
          }

          // Mock OD Application creation with date validation
          if (doctype === 'OD Application') {
            // Validation: Check for duplicate date ranges
            const newStartDate = new Date(doc.od_start_date);
            const newEndDate = new Date(doc.od_end_date);

            // Get all existing OD applications (user-submitted + default mock data)
            const storageKey = 'test_admin_od_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = existingApps ? JSON.parse(existingApps) : [];

            // Default mock OD applications for validation
            const today = new Date();
            const defaultMockODApplications = [
              {
                name: 'OD-TEST-001',
                od_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 8).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-002',
                od_start_date: new Date(today.getFullYear(), today.getMonth(), 18).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth(), 19).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-003',
                od_start_date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-004',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 22).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-005',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 1, 5).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 1, 7).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-006',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 2, 15).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 2, 17).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-007',
                od_start_date: new Date(today.getFullYear(), today.getMonth() + 1, 25).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() + 1, 27).toISOString().split('T')[0],
              },
              {
                name: 'OD-TEST-008',
                od_start_date: new Date(today.getFullYear(), today.getMonth() - 3, 10).toISOString().split('T')[0],
                od_end_date: new Date(today.getFullYear(), today.getMonth() - 3, 12).toISOString().split('T')[0],
              },
            ];

            // Merge all applications for validation
            const allApplications = [...userSubmittedApps, ...defaultMockODApplications];

            // Check for date range overlap
            for (const app of allApplications) {
              const existingStartDate = new Date(app.od_start_date);
              const existingEndDate = new Date(app.od_end_date);

              // Check if date ranges overlap
              if (newStartDate <= existingEndDate && newEndDate >= existingStartDate) {
                const formatDate = (date: Date) => date.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                setLoading(false);
                throw new Error(
                  `This date range overlaps with an existing OD application (${formatDate(existingStartDate)} - ${formatDate(existingEndDate)}). Please choose different dates.`
                );
              }
            }

            // No overlap, create the application
            const mockODRecord = {
              name: `OD-USER-${Date.now()}`,
              employee: doc.employee,
              employee_name: doc.employee_name,
              od_start_date: doc.od_start_date,
              od_end_date: doc.od_end_date,
              od_type: doc.od_type,
              od_type_description: doc.od_type_description,
              per_day_rate: doc.per_day_rate || 0,
              location: doc.location,
              approval_status: doc.approval_status || 'Pending',
              creation: new Date().toISOString(),
              modified: new Date().toISOString(),
              docstatus: 0
            };

            // Store locally in SecureStore
            userSubmittedApps.unshift(mockODRecord); // Add to beginning (newest first)
            await SecureStore.setItemAsync(storageKey, JSON.stringify(userSubmittedApps));

            console.log('✅ Mock OD Application created locally:', mockODRecord);

            setLoading(false);
            return mockODRecord as T;
          }

          // Mock Leave Application creation with date validation
          if (doctype === 'Leave Application') {
            // Validation: Check for duplicate date ranges
            const newStartDate = new Date(doc.from_date);
            const newEndDate = new Date(doc.to_date);

            // Get all existing Leave applications (user-submitted + default mock data)
            const storageKey = 'test_admin_leave_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = existingApps ? JSON.parse(existingApps) : [];

            // Default mock Leave applications for validation
            const today = new Date();
            const defaultMockLeaveApplications = [
              {
                name: 'LEAVE-TEST-001',
                from_date: new Date(today.getFullYear(), today.getMonth() + 1, 12).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() + 1, 14).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-002',
                from_date: new Date(today.getFullYear(), today.getMonth(), 22).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth(), 23).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-003',
                from_date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-004',
                from_date: new Date(today.getFullYear(), today.getMonth() - 1, 18).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-005',
                from_date: new Date(today.getFullYear(), today.getMonth() - 1, 8).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 1, 9).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-006',
                from_date: new Date(today.getFullYear(), today.getMonth() - 2, 10).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 2, 14).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-007',
                from_date: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() + 1, 6).toISOString().split('T')[0],
              },
              {
                name: 'LEAVE-TEST-008',
                from_date: new Date(today.getFullYear(), today.getMonth() - 3, 25).toISOString().split('T')[0],
                to_date: new Date(today.getFullYear(), today.getMonth() - 3, 25).toISOString().split('T')[0],
              },
            ];

            // Merge all applications for validation
            const allApplications = [...userSubmittedApps, ...defaultMockLeaveApplications];

            // Check for date range overlap
            for (const app of allApplications) {
              const existingStartDate = new Date(app.from_date);
              const existingEndDate = new Date(app.to_date);

              // Check if date ranges overlap
              if (newStartDate <= existingEndDate && newEndDate >= existingStartDate) {
                const formatDate = (date: Date) => date.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                setLoading(false);
                throw new Error(
                  `This date range overlaps with an existing Leave application (${formatDate(existingStartDate)} - ${formatDate(existingEndDate)}). Please choose different dates.`
                );
              }
            }

            // No overlap, create the application
            const mockLeaveRecord = {
              name: `LEAVE-USER-${Date.now()}`,
              employee: doc.employee,
              employee_name: doc.employee_name,
              leave_type: doc.leave_type,
              from_date: doc.from_date,
              to_date: doc.to_date,
              custom_from_date_leave_value: doc.custom_from_date_leave_value,
              custom_till_date_leave_value: doc.custom_till_date_leave_value,
              description: doc.description,
              status: doc.status || 'Open',
              posting_date: new Date().toISOString().split('T')[0],
              creation: new Date().toISOString(),
              modified: new Date().toISOString(),
              docstatus: 0
            };

            // Store locally in SecureStore
            userSubmittedApps.unshift(mockLeaveRecord); // Add to beginning (newest first)
            await SecureStore.setItemAsync(storageKey, JSON.stringify(userSubmittedApps));

            console.log('✅ Mock Leave Application created locally:', mockLeaveRecord);

            setLoading(false);
            return mockLeaveRecord as T;
          }

          // Mock Gate Pass Application creation with date/time validation
          if (doctype === 'Gate Pass Application') {
            // Validation: Check for duplicate date/time
            const newDate = new Date(doc.date_of_application);
            const newDateTime = new Date(doc.gp_start_time);

            // Get all existing Gatepass applications (user-submitted + default mock data)
            const storageKey = 'test_admin_gatepass_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            const userSubmittedApps = existingApps ? JSON.parse(existingApps) : [];

            // Default mock Gatepass applications for validation
            const today = new Date();
            const defaultMockGatepassApplications = [
              {
                name: 'GP-TEST-001',
                date_of_application: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() + 1, 10, 14, 30).toISOString(),
              },
              {
                name: 'GP-TEST-002',
                date_of_application: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth(), 20, 15, 0).toISOString(),
              },
              {
                name: 'GP-TEST-003',
                date_of_application: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth(), 10, 11, 0).toISOString(),
              },
              {
                name: 'GP-TEST-004',
                date_of_application: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 1, 15, 13, 30).toISOString(),
              },
              {
                name: 'GP-TEST-005',
                date_of_application: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 1, 5, 16, 0).toISOString(),
              },
              {
                name: 'GP-TEST-006',
                date_of_application: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 2, 18, 14, 0).toISOString(),
              },
              {
                name: 'GP-TEST-007',
                date_of_application: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() + 1, 5, 15, 30).toISOString(),
              },
              {
                name: 'GP-TEST-008',
                date_of_application: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                gp_start_time: new Date(today.getFullYear(), today.getMonth() - 3, 12, 12, 0).toISOString(),
              },
            ];

            // Merge all applications for validation
            const allApplications = [...userSubmittedApps, ...defaultMockGatepassApplications];

            // Check for duplicate date/time
            for (const app of allApplications) {
              const existingDate = new Date(app.date_of_application);
              const existingDateTime = new Date(app.gp_start_time);

              // Check if same date and similar time (within 30 minutes)
              if (newDate.toDateString() === existingDate.toDateString()) {
                const timeDiff = Math.abs(newDateTime.getTime() - existingDateTime.getTime());
                const minutesDiff = timeDiff / (1000 * 60);

                if (minutesDiff < 30) {
                  const formatDateTime = (date: Date) => date.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  setLoading(false);
                  throw new Error(
                    `A gatepass already exists for a similar time (${formatDateTime(existingDateTime)}). Please choose a different time.`
                  );
                }
              }
            }

            // No conflict, create the application
            const mockGatepassRecord = {
              name: `GP-USER-${Date.now()}`,
              employee: doc.employee,
              employee_name: doc.employee_name,
              date_of_application: doc.date_of_application,
              gp_start_time: doc.gp_start_time,
              purpose_of_gp: doc.purpose_of_gp,
              approval_status: doc.approval_status || 'Pending',
              creation: new Date().toISOString(),
              modified: new Date().toISOString(),
              docstatus: 0
            };

            // Store locally in SecureStore
            userSubmittedApps.unshift(mockGatepassRecord); // Add to beginning (newest first)
            await SecureStore.setItemAsync(storageKey, JSON.stringify(userSubmittedApps));

            console.log('✅ Mock Gate Pass Application created locally:', mockGatepassRecord);

            setLoading(false);
            return mockGatepassRecord as T;
          }

          // For other doctypes, return mock success
          const mockDoc = {
            name: `MOCK-${doctype}-${Date.now()}`,
            ...doc,
            creation: new Date().toISOString(),
            modified: new Date().toISOString(),
            docstatus: 1
          };

          console.log('✅ Mock document created locally:', mockDoc);
          setLoading(false);
          return mockDoc as T;
        }
        // ========================================================================
        // END MOCK CREATE
        // ========================================================================

        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(doc),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create document';
        setError(errorMessage);

        // Don't log validation errors for test_admin (they're expected user-facing messages)
        const apiKey = await SecureStore.getItemAsync('api_key');
        const isValidationError = err instanceof Error && err.message.includes('overlaps with an existing');
        if (!(apiKey === 'dummy_api_key_test_admin' && isValidationError)) {
          console.error(`Error creating ${doctype}:`, err);
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const updateDoc = useCallback(
    async <T = any>(doctype: string, name: string, doc: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(doc),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
        setError(errorMessage);
        console.error(`Error updating ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const deleteDoc = useCallback(
    async (doctype: string, name: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'DELETE',
            headers,
          }
        );

        await handleResponse<void>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
        setError(errorMessage);
        console.error(`Error deleting ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const submitDoc = useCallback(
    async <T = any>(doctype: string, name: string): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        // ========================================================================
        // MOCK SUBMIT DOC FOR TEST ADMIN USER
        // ========================================================================
        const apiKey = await SecureStore.getItemAsync('api_key');
        if (apiKey === 'dummy_api_key_test_admin') {
          console.log('🔧 Test admin detected - mocking submit for:', doctype, name);

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 300));

          // For WFH Application, update docstatus in local storage
          if (doctype === 'Work From Home Application') {
            const storageKey = 'test_admin_wfh_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            if (existingApps) {
              const applications = JSON.parse(existingApps);
              const appIndex = applications.findIndex((app: any) => app.name === name);
              if (appIndex !== -1) {
                applications[appIndex].docstatus = 1;
                await SecureStore.setItemAsync(storageKey, JSON.stringify(applications));
                console.log('✅ Mock WFH Application submitted (docstatus = 1)');
                setLoading(false);
                return applications[appIndex] as T;
              }
            }
          }

          // For OD Application, update docstatus in local storage
          if (doctype === 'OD Application') {
            const storageKey = 'test_admin_od_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            if (existingApps) {
              const applications = JSON.parse(existingApps);
              const appIndex = applications.findIndex((app: any) => app.name === name);
              if (appIndex !== -1) {
                applications[appIndex].docstatus = 1;
                await SecureStore.setItemAsync(storageKey, JSON.stringify(applications));
                console.log('✅ Mock OD Application submitted (docstatus = 1)');
                setLoading(false);
                return applications[appIndex] as T;
              }
            }
          }

          // For Leave Application, update docstatus in local storage
          if (doctype === 'Leave Application') {
            const storageKey = 'test_admin_leave_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            if (existingApps) {
              const applications = JSON.parse(existingApps);
              const appIndex = applications.findIndex((app: any) => app.name === name);
              if (appIndex !== -1) {
                applications[appIndex].docstatus = 1;
                await SecureStore.setItemAsync(storageKey, JSON.stringify(applications));
                console.log('✅ Mock Leave Application submitted (docstatus = 1)');
                setLoading(false);
                return applications[appIndex] as T;
              }
            }
          }

          // For Gate Pass Application, update docstatus in local storage
          if (doctype === 'Gate Pass Application') {
            const storageKey = 'test_admin_gatepass_applications';
            const existingApps = await SecureStore.getItemAsync(storageKey);
            if (existingApps) {
              const applications = JSON.parse(existingApps);
              const appIndex = applications.findIndex((app: any) => app.name === name);
              if (appIndex !== -1) {
                applications[appIndex].docstatus = 1;
                await SecureStore.setItemAsync(storageKey, JSON.stringify(applications));
                console.log('✅ Mock Gate Pass Application submitted (docstatus = 1)');
                setLoading(false);
                return applications[appIndex] as T;
              }
            }
          }

          // For other documents, return mock success
          const mockSubmitResult = {
            name: name,
            doctype: doctype,
            docstatus: 1,
            modified: new Date().toISOString(),
          };

          console.log('✅ Mock document submitted:', mockSubmitResult);
          setLoading(false);
          return mockSubmitResult as T;
        }
        // ========================================================================
        // END MOCK SUBMIT DOC
        // ========================================================================

        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        // First, get the full document
        const doc = await getDoc(doctype, name);

        // Then submit it
        const response = await fetch(
          `${siteUrl}/api/method/frappe.client.submit`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              doc: JSON.stringify(doc)
            }),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit document';
        setError(errorMessage);
        console.error(`Error submitting ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders, getDoc]
  );

  const call = useCallback(
    async <T = any>(method: string, params?: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        // ========================================================================
        // MOCK API CALLS FOR TEST ADMIN USER
        // ========================================================================
        const apiKey = await SecureStore.getItemAsync('api_key');
        if (apiKey === 'dummy_api_key_test_admin') {
          console.log('🔧 Test admin detected - mocking API call for:', method);

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 300));

          // Mock get_leave_type API call
          if (method === 'ashida.ashida_gaxis.api.mobile_auth.get_leave_type') {
            const mockLeaveTypes = {
              message: [
                { name: 'Casual Leave', value: 'Casual Leave' },
                { name: 'Sick Leave', value: 'Sick Leave' },
                { name: 'Privilege Leave', value: 'Privilege Leave' },
                { name: 'Compensatory Off', value: 'Compensatory Off' },
                { name: 'Leave Without Pay', value: 'Leave Without Pay' },
              ]
            };
            console.log('📦 Returning mock leave types:', mockLeaveTypes);
            setLoading(false);
            return mockLeaveTypes as T;
          }

          // Mock get_employee_monthly_usage API call
          if (method === 'ashida.ashida_gaxis.doctype.gate_pass_application.gate_pass_application.get_employee_monthly_usage') {
            const mockMonthlyUsage = {
              total_hours_used: 2.0,
              monthly_limit: 4.0,
              remaining_hours: 2.0,
              total_overall_hours: 2.0,
            };
            console.log('📦 Returning mock monthly gatepass usage:', mockMonthlyUsage);
            setLoading(false);
            return mockMonthlyUsage as T;
          }

          // For other API calls, return empty success
          console.log('📦 Returning mock success for API call:', method);
          setLoading(false);
          return { message: 'Success' } as T;
        }
        // ========================================================================
        // END MOCK API CALLS
        // ========================================================================

        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/method/${method}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params || {}),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'API call failed';
        setError(errorMessage);
        console.error(`Error calling method ${method}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const callGet = useCallback(
    async <T = any>(method: string, params?: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const queryParams = params
          ? '?' + new URLSearchParams(
              Object.entries(params).reduce((acc, [key, value]) => {
                acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return acc;
              }, {} as Record<string, string>)
            ).toString()
          : '';

        const response = await fetch(
          `${siteUrl}/api/method/${method}${queryParams}`,
          {
            method: 'GET',
            headers,
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'API call failed';
        setError(errorMessage);
        console.error(`Error calling method ${method}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  return useMemo(
    () => ({
      loading,
      error,
      getAuthHeaders,
      getList,
      getDoc,
      createDoc,
      updateDoc,
      deleteDoc,
      submitDoc,
      call,
      callGet,
    }),
    // Note: loading and error are intentionally NOT in dependencies
    // They change frequently but shouldn't cause the service object to be recreated
    // Only the methods should trigger recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAuthHeaders, getList, getDoc, createDoc, updateDoc, deleteDoc, submitDoc, call, callGet]
  );
};
