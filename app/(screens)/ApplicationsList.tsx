import { Navbar } from '@/components';
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useFrappeService } from '@/services/frappeService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Type Definitions
type ApplicationType = 'Gatepass' | 'OD' | 'WFH';
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
type SortBy = 'date' | 'employee';

interface BaseApplication {
  id: string;
  type: ApplicationType;
  employee: string;
  employee_name: string;
  approval_status: ApprovalStatus;
  date_of_application: string;
}

interface WFHApplication extends BaseApplication {
  type: 'WFH';
  department: string;
  designation: string;
  wfh_start_date: string;
  wfh_end_date: string;
  purpose_of_wfh: string;
  date_of_approval?: string;
  reason_for_rejection?: string;
}

interface ODApplication extends BaseApplication {
  type: 'OD';
  od_start_date: string;
  od_end_date: string;
  od_type: string;
  od_type_description: string;
  per_day_rate: number;
  location: string;
  approved_by?: string;
  date_of_approval?: string;
  rejected_by?: string;
  date_of_rejection?: string;
  reason_for_rejection?: string;
}

interface GatepassApplication extends BaseApplication {
  type: 'Gatepass';
  designation: string;
  department: string;
  gp_start_time: string;
  gp_end_time: string;
  purpose_of_gp: string;
  approved_duration_hours?: number;
  actual_duration_hours?: number;
  approved_by?: string;
  rejected_by?: string;
  date_of_approval?: string;
  date_of_rejection?: string;
  reason_for_rejection?: string;
}

type Application = WFHApplication | ODApplication | GatepassApplication;

interface Employee {
  id: string;
  name: string;
}

// Dummy Data
const DUMMY_EMPLOYEES: Employee[] = [
  { id: 'EMP001', name: 'Rajesh Kumar' },
  { id: 'EMP002', name: 'Priya Sharma' },
  { id: 'EMP003', name: 'Amit Patel' },
  { id: 'EMP004', name: 'Sneha Gupta' },
  { id: 'EMP005', name: 'Vikram Singh' },
  { id: 'EMP006', name: 'Anjali Verma' },
  { id: 'EMP007', name: 'Rahul Desai' },
  { id: 'EMP008', name: 'Meera Iyer' },
  { id: 'EMP009', name: 'Karan Malhotra' },
  { id: 'EMP010', name: 'Pooja Reddy' },
  { id: 'EMP011', name: 'Suresh Nair' },
  { id: 'EMP012', name: 'Divya Krishnan' },
  { id: 'EMP013', name: 'Arjun Mehta' },
  { id: 'EMP014', name: 'Kavita Joshi' },
  { id: 'EMP015', name: 'Rohit Shah' },
];

const generateDummyApplications = (): Application[] => {
  const applications: Application[] = [];
  const statuses: ApprovalStatus[] = ['Pending', 'Approved', 'Rejected'];
  const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Operations'];
  const designations = ['Manager', 'Executive', 'Senior Executive', 'Team Lead', 'Associate'];

  // Generate WFH Applications
  for (let i = 0; i < 30; i++) {
    const emp = DUMMY_EMPLOYEES[i % DUMMY_EMPLOYEES.length];
    const status = statuses[i % 3];
    const startDate = new Date(2025, 0, Math.floor(Math.random() * 28) + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 5) + 1);

    applications.push({
      id: `WFH${i + 1}`,
      type: 'WFH',
      employee: emp.id,
      employee_name: emp.name,
      department: departments[i % departments.length],
      designation: designations[i % designations.length],
      wfh_start_date: startDate.toISOString().split('T')[0],
      wfh_end_date: endDate.toISOString().split('T')[0],
      purpose_of_wfh: 'Personal work / Medical appointment / Family emergency',
      approval_status: status,
      date_of_application: new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      date_of_approval: status === 'Approved' ? new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0] : undefined,
      reason_for_rejection: status === 'Rejected' ? 'Insufficient justification' : undefined,
    });
  }

  // Generate OD Applications
  for (let i = 0; i < 25; i++) {
    const emp = DUMMY_EMPLOYEES[i % DUMMY_EMPLOYEES.length];
    const status = statuses[(i + 1) % 3];
    const startDate = new Date(2025, 0, Math.floor(Math.random() * 28) + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 3) + 1);

    applications.push({
      id: `OD${i + 1}`,
      type: 'OD',
      employee: emp.id,
      employee_name: emp.name,
      od_start_date: startDate.toISOString().split('T')[0],
      od_end_date: endDate.toISOString().split('T')[0],
      od_type: 'Client Meeting',
      od_type_description: 'Meeting with client at their office',
      per_day_rate: 500,
      location: 'Mumbai / Bangalore / Delhi / Pune',
      approval_status: status,
      date_of_application: new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      approved_by: status === 'Approved' ? 'Manager Name' : undefined,
      date_of_approval: status === 'Approved' ? new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0] : undefined,
      rejected_by: status === 'Rejected' ? 'Manager Name' : undefined,
      date_of_rejection: status === 'Rejected' ? new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0] : undefined,
      reason_for_rejection: status === 'Rejected' ? 'Not approved by client' : undefined,
    });
  }

  // Generate Gatepass Applications
  for (let i = 0; i < 25; i++) {
    const emp = DUMMY_EMPLOYEES[i % DUMMY_EMPLOYEES.length];
    const status = statuses[(i + 2) % 3];
    const startTime = `${9 + Math.floor(Math.random() * 8)}:00:00`;
    const endTime = `${12 + Math.floor(Math.random() * 6)}:00:00`;

    applications.push({
      id: `GP${i + 1}`,
      type: 'Gatepass',
      employee: emp.id,
      employee_name: emp.name,
      designation: designations[i % designations.length],
      department: departments[i % departments.length],
      gp_start_time: startTime,
      gp_end_time: endTime,
      purpose_of_gp: 'Bank work / Personal appointment / Medical checkup',
      approved_duration_hours: status === 'Approved' ? 2 : undefined,
      actual_duration_hours: status === 'Approved' ? 2.5 : undefined,
      approval_status: status,
      date_of_application: new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      approved_by: status === 'Approved' ? 'HR Manager' : undefined,
      rejected_by: status === 'Rejected' ? 'HR Manager' : undefined,
      date_of_approval: status === 'Approved' ? new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0] : undefined,
      date_of_rejection: status === 'Rejected' ? new Date(2025, 0, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0] : undefined,
      reason_for_rejection: status === 'Rejected' ? 'Already taken too many gatepasses this month' : undefined,
    });
  }

  return applications;
};

export default function ApplicationsList() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const frappeService = useFrappeService();

  // State
  const [activeTab, setActiveTab] = useState<'pending' | 'complete'>('pending');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedAppType, setSelectedAppType] = useState<'All' | ApplicationType>('All');
  const [showAppTypeDropdown, setShowAppTypeDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);

  // Applications data from API
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);

  // Employee data from API (server-side search)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Fetch employees with server-side search
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);

        // Only search if user has typed something
        if (employeeSearchQuery.trim()) {
          console.log('Searching employees:', employeeSearchQuery);

          const empList = await frappeService.getList<any>('Employee', {
            fields: ['name', 'employee_name'],
            filters: [
              ['employee_name', 'like', `%${employeeSearchQuery}%`]
            ],
            limitPageLength: 10 // Only get 10 results
          });
          console.log("ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo")
          console.log('Found employees:', empList.length);

          const formattedEmployees = empList.map((emp: any) => ({
            id: emp.name,
            name: emp.employee_name
          }));

          setEmployees(formattedEmployees);
        } else {
          // When no search query, fetch first 10 employees
          console.log('Fetching initial employees...');

          const empList = await frappeService.getList<any>('Employee', {
            fields: ['name', 'employee_name'],
            limitPageLength: 10,
            orderBy: 'employee_name asc'
          });

          const formattedEmployees = empList.map((emp: any) => ({
            id: emp.name,
            name: emp.employee_name
          }));

          setEmployees(formattedEmployees);
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };

    // Debounce: Only fetch after user stops typing for 300ms
    const timeoutId = setTimeout(() => {
      if (showEmployeeDropdown) {
        fetchEmployees();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [employeeSearchQuery, showEmployeeDropdown, frappeService]);

  // Use employees directly from state (no client-side filtering needed)
  const filteredEmployees = useMemo(() => {
    return employees; // Already filtered by server
  }, [employees]);

  // Fetch all applications from API
  const fetchApplications = useCallback(async () => {
    try {
      setIsLoadingApplications(true);
      setApplicationsError(null);
      console.log('Fetching applications from API...');

      // Fetch all three types of applications in parallel
      const [wfhApps, odApps, gatepassApps] = await Promise.all([
        // Fetch WFH Applications
        frappeService.getList<any>('Work From Home Application', {
          fields: [
            'name',
            'employee',
            'employee_name',
            'department',
            'designation',
            'wfh_start_date',
            'wfh_end_date',
            'purpose_of_wfh',
            'approval_status',
            'creation', // Use creation date instead
            'reason_for_rejection'
          ],
          limitPageLength: 0
        }),

        // Fetch OD Applications
        frappeService.getList<any>('OD Application', {
          fields: [
            'name',
            'employee',
            'employee_name',
            'od_start_date',
            'od_end_date',
            'od_type',
            'od_type_description',
            'per_day_rate',
            'location',
            'approval_status',
            'creation', // Use creation date instead
            'approved_by',
            'rejected_by',
            'reason_for_rejection'
          ],
          limitPageLength: 0
        }),

        // Fetch Gatepass Applications
        frappeService.getList<any>('Gate Pass Application', {
          fields: [
            'name',
            'employee',
            'employee_name',
            'designation',
            'department',
            'gp_start_time',
            'gp_end_time',
            'purpose_of_gp',
            'approved_duration_hours',
            'actual_duration_hours',
            'approval_status',
            'creation', // Use creation date instead
            'approved_by',
            'rejected_by',
            'reason_for_rejection'
          ],
          limitPageLength: 0
        })
      ]);

      console.log('Fetched WFH:', wfhApps.length);
      console.log('Fetched OD:', odApps.length);
      console.log('Fetched Gatepass:', gatepassApps.length);

      // Transform and combine all applications
      const allApps: Application[] = [
        // WFH Applications
        ...wfhApps.map((app: any): WFHApplication => ({
          id: app.name,
          type: 'WFH',
          employee: app.employee,
          employee_name: app.employee_name,
          department: app.department,
          designation: app.designation,
          wfh_start_date: app.wfh_start_date,
          wfh_end_date: app.wfh_end_date,
          purpose_of_wfh: app.purpose_of_wfh,
          approval_status: app.approval_status,
          date_of_application: app.creation, // Use creation date
          date_of_approval: app.date_of_approval,
          reason_for_rejection: app.reason_for_rejection,
        })),

        // OD Applications
        ...odApps.map((app: any): ODApplication => ({
          id: app.name,
          type: 'OD',
          employee: app.employee,
          employee_name: app.employee_name,
          od_start_date: app.od_start_date,
          od_end_date: app.od_end_date,
          od_type: app.od_type,
          od_type_description: app.od_type_description,
          per_day_rate: app.per_day_rate,
          location: app.location,
          approval_status: app.approval_status,
          date_of_application: app.creation, // Use creation date
          approved_by: app.approved_by,
          date_of_approval: app.date_of_approval,
          rejected_by: app.rejected_by,
          date_of_rejection: app.date_of_rejection,
          reason_for_rejection: app.reason_for_rejection,
        })),

        // Gatepass Applications
        ...gatepassApps.map((app: any): GatepassApplication => ({
          id: app.name,
          type: 'Gatepass',
          employee: app.employee,
          employee_name: app.employee_name,
          designation: app.designation,
          department: app.department,
          gp_start_time: app.gp_start_time,
          gp_end_time: app.gp_end_time,
          purpose_of_gp: app.purpose_of_gp,
          approved_duration_hours: app.approved_duration_hours,
          actual_duration_hours: app.actual_duration_hours,
          approval_status: app.approval_status,
          date_of_application: app.creation, // Use creation date
          approved_by: app.approved_by,
          rejected_by: app.rejected_by,
          date_of_approval: app.date_of_approval,
          date_of_rejection: app.date_of_rejection,
          reason_for_rejection: app.reason_for_rejection,
        }))
      ];

      console.log('Total applications loaded:', allApps.length);
      setAllApplications(allApps);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setApplicationsError('Failed to load applications');
    } finally {
      setIsLoadingApplications(false);
    }
  }, [frappeService]);

  // Fetch applications on mount
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Filter and sort applications
  const filteredApplications = useMemo(() => {
    let filtered = allApplications;

    console.log('Filtering - Selected Employee:', selectedEmployee);
    console.log('Total applications:', allApplications.length);

    // Filter by tab (pending or complete)
    if (activeTab === 'pending') {
      filtered = filtered.filter(app => app.approval_status === 'Pending');
    } else {
      filtered = filtered.filter(app => app.approval_status === 'Approved' || app.approval_status === 'Rejected');
    }
    console.log('After tab filter:', filtered.length);

    // Filter by employee
    if (selectedEmployee) {
      filtered = filtered.filter(app => app.employee === selectedEmployee);
      console.log('After employee filter:', filtered.length, 'for employee:', selectedEmployee);
    }

    // Filter by application type
    if (selectedAppType !== 'All') {
      filtered = filtered.filter(app => app.type === selectedAppType);
    }
    console.log('After type filter:', filtered.length);

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date_of_application).getTime() - new Date(a.date_of_application).getTime();
      } else {
        return a.employee_name.localeCompare(b.employee_name);
      }
    });

    console.log('Final filtered:', filtered.length);
    return filtered;
  }, [allApplications, activeTab, selectedEmployee, selectedAppType, sortBy]);

  // Paginated applications
  const displayedApplications = useMemo(() => {
    return filteredApplications.slice(0, displayCount);
  }, [filteredApplications, displayCount]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
    setDisplayCount(20);
  }, [fetchApplications]);

  // Load more handler
  const onLoadMore = useCallback(() => {
    if (loadingMore || displayedApplications.length >= filteredApplications.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + 20);
      setLoadingMore(false);
    }, 500);
  }, [loadingMore, displayedApplications.length, filteredApplications.length]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(20);
  }, [activeTab, selectedEmployee, selectedAppType, sortBy]);

  // Get status color
  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'Approved':
        return '#4CAF50';
      case 'Rejected':
        return '#F44336';
      case 'Pending':
        return '#FF9800';
      default:
        return theme.colors.textSecondary;
    }
  };

  // Get type color
  const getTypeColor = (type: ApplicationType) => {
    switch (type) {
      case 'Gatepass':
        return '#2196F3';
      case 'OD':
        return '#9C27B0';
      case 'WFH':
        return '#FF5722';
      default:
        return theme.colors.primary;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get date range
  const getDateRange = (app: Application): string => {
    if (app.type === 'WFH') {
      return `${formatDate(app.wfh_start_date)} - ${formatDate(app.wfh_end_date)}`;
    } else if (app.type === 'OD') {
      return `${formatDate(app.od_start_date)} - ${formatDate(app.od_end_date)}`;
    } else {
      return `${app.gp_start_time.substring(0, 5)} - ${app.gp_end_time.substring(0, 5)}`;
    }
  };

  // Get purpose
  const getPurpose = (app: Application): string => {
    if (app.type === 'WFH') {
      return app.purpose_of_wfh;
    } else if (app.type === 'OD') {
      return app.od_type_description;
    } else {
      return app.purpose_of_gp;
    }
  };

  // Render application card
  const renderApplicationCard = ({ item }: { item: Application }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      {/* Header with Type and Status */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>
            {item.type}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.approval_status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.approval_status) }]} />
          <Text style={[styles.statusBadgeText, { color: getStatusColor(item.approval_status) }]}>
            {item.approval_status}
          </Text>
        </View>
      </View>

      {/* Employee Info */}
      <Text style={[styles.employeeName, { color: theme.colors.text }]}>
        {item.employee_name}
      </Text>
      <Text style={[styles.employeeId, { color: theme.colors.textSecondary }]}>
        {item.employee}
      </Text>

      {/* Date Range */}
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          {getDateRange(item)}
        </Text>
      </View>

      {/* Purpose */}
      <View style={styles.infoRow}>
        <Ionicons name="document-text-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {getPurpose(item).substring(0, 50)}...
        </Text>
      </View>

      {/* Department and Designation */}
      {(item.type === 'WFH' || item.type === 'Gatepass') && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            {item.department} • {item.designation}
          </Text>
        </View>
      )}

      {/* Location for OD */}
      {item.type === 'OD' && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            {item.location}
          </Text>
        </View>
      )}

      {/* Rejection Reason */}
      {item.approval_status === 'Rejected' && item.reason_for_rejection && (
        <View style={[styles.rejectionBox, { backgroundColor: '#F4433620' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
          <Text style={[styles.rejectionText, { color: '#F44336' }]} numberOfLines={2}>
            {item.reason_for_rejection}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Navbar onProfilePress={() => router.push('/(tabs)/profile')} />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Applications
            </Text>
          </View>
        </View>

        {/* Filters Section */}
      <View style={[styles.filtersContainer, { backgroundColor: theme.colors.card }]}>
        {/* Employee Filter */}
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
              Employee
            </Text>
            <TouchableOpacity
              style={[styles.filterInput, { borderColor: theme.colors.border }]}
              onPress={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
            >
              <TextInput
                style={[styles.filterInputText, { color: theme.colors.text }]}
                placeholder="Search employee..."
                placeholderTextColor={theme.colors.textSecondary}
                value={employeeSearchQuery}
                onChangeText={setEmployeeSearchQuery}
                onFocus={() => setShowEmployeeDropdown(true)}
              />
              <Ionicons
                name={showEmployeeDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            {showEmployeeDropdown && (
              <View style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {loadingEmployees ? (
                  <View style={styles.dropdownLoading}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.dropdownLoadingText, { color: theme.colors.textSecondary }]}>
                      Loading employees...
                    </Text>
                  </View>
                ) : (
                <FlatList
                  data={[{ id: 'all', name: 'All Employees' }, ...filteredEmployees]}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        if (item.id === 'all') {
                          setSelectedEmployee('');
                          setEmployeeSearchQuery('');
                        } else {
                          setSelectedEmployee(item.id);
                          setEmployeeSearchQuery(item.name);
                        }
                        setShowEmployeeDropdown(false);
                        console.log('Selected Employee:', item.id, item.name);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                        {item.name}
                      </Text>
                      {item.id !== 'all' && (
                        <Text style={[styles.dropdownItemSubtext, { color: theme.colors.textSecondary }]}>
                          {item.id}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                />
                )}
              </View>
            )}
          </View>

          {/* Application Type Filter */}
          <View style={styles.filterItem}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
              Type
            </Text>
            <TouchableOpacity
              style={[styles.filterInput, { borderColor: theme.colors.border }]}
              onPress={() => setShowAppTypeDropdown(!showAppTypeDropdown)}
            >
              <Text style={[styles.filterInputText, { color: theme.colors.text }]}>
                {selectedAppType}
              </Text>
              <Ionicons
                name={showAppTypeDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            {showAppTypeDropdown && (
              <View style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {['All', 'Gatepass', 'OD', 'WFH'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedAppType(type as 'All' | ApplicationType);
                      setShowAppTypeDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Sort and Stats Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => setSortBy(sortBy === 'date' ? 'employee' : 'date')}
          >
            <Ionicons name="swap-vertical" size={16} color={theme.colors.primary} />
            <Text style={[styles.sortButtonText, { color: theme.colors.primary }]}>
              Sort by {sortBy === 'date' ? 'Date' : 'Employee'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
            {filteredApplications.length} applications
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          setShowEmployeeDropdown(false);
          setShowAppTypeDropdown(false);
        }}
      >
      <View style={[styles.tabsContainer, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'pending' && [styles.activeTab, { borderBottomColor: '#FF9800' }],
          ]}
          onPress={() => {
            setActiveTab('pending');
            setShowEmployeeDropdown(false);
            setShowAppTypeDropdown(false);
          }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'pending' ? '#FF9800' : theme.colors.textSecondary },
            ]}
          >
            Pending
          </Text>
          <View style={[styles.tabBadge, { backgroundColor: '#FF9800' }]}>
            <Text style={styles.tabBadgeText}>
              {allApplications.filter(app => app.approval_status === 'Pending').length}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'complete' && [styles.activeTab, { borderBottomColor: theme.colors.primary }],
          ]}
          onPress={() => {
            setActiveTab('complete');
            setShowEmployeeDropdown(false);
            setShowAppTypeDropdown(false);
          }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'complete' ? theme.colors.primary : theme.colors.textSecondary },
            ]}
          >
            Complete
          </Text>
          <View style={[styles.tabBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.tabBadgeText}>
              {allApplications.filter(app => app.approval_status === 'Approved' || app.approval_status === 'Rejected').length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      </TouchableOpacity>

      {/* Applications List */}
      <FlatList
        data={displayedApplications}
        renderItem={renderApplicationCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={!showEmployeeDropdown && !showAppTypeDropdown}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingMoreText, { color: theme.colors.textSecondary }]}>
                Loading more...
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No applications found
            </Text>
          </View>
        }
      />

      {/* Loading Overlay */}
      {isLoadingApplications && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
            Loading applications...
          </Text>
        </View>
      )}

      {/* Error Message */}
      {applicationsError && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.card }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{applicationsError}</Text>
          <TouchableOpacity onPress={fetchApplications} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filtersContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  filterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterInputText: {
    flex: 1,
    fontSize: 14,
  },
  dropdown: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    maxHeight: 250,
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10000,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 13,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  rejectionText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  dropdownLoading: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownLoadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
