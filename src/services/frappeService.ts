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
              holiday_list: `India Holidays ${currentYear}`
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
