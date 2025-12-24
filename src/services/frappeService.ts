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
            const mockEmployeeData = [{
              name: 'EMP-TEST-ADMIN',
              employee_name: 'Test Administrator',
              user_id: 'test.admin@ashida.com',
              status: 'Active'
            }];
            console.log('📦 Returning mock Employee data:', mockEmployeeData);
            setLoading(false);
            return mockEmployeeData as T[];
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
        console.error(`Error creating ${doctype}:`, err);
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
