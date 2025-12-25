//new code
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useFrappeService } from '@/services/frappeService';
import type { Employee, EmployeeCheckin } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CELL_WIDTH = (width - 40) / 7;

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_COLORS = {
  present: '#4CAF50',      // Green
  absent: '#F44336',       // Red
  on_leave: '#9C27B0',     // Purple
  half_day: '#00BCD4',     // Cyan
  work_from_home: '#2196F3', // Blue
  incomplete: '#FFC107',   // Amber/Yellow
  default: '#E0E0E0',      // Light gray
  wfh: '#2196F3',          // Blue
  od: '#FF9800',           // Orange
} as const;

const STATUS_TEXT = {
  present: 'P',
  absent: 'A',
  on_leave: 'L',
  half_day: 'H',
  work_from_home: 'W',
  incomplete: 'I',
} as const;

const OPACITY = {
  FULL: '80',    // For both attendance + checkins
  MEDIUM: '60',  // For single record type
  LIGHT: '20',   // For WFH/OD without attendance
} as const;

const DATE_RANGE = {
  EDITABLE_DAYS: 7, // Last 7 days are editable
} as const;

const API_LIMITS = {
  MAX_RECORDS: 1000,
} as const;

const MISSING_PUNCH_LIMITS = {
  MAX_DAYS_PER_MONTH: 3, // Maximum 3 missing punch days per month
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

interface AttendanceCalendarProps {
  visible: boolean;
  onClose: () => void;
  currentEmployee: Employee | null;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
}

interface DayData {
  date: string;
  checkIns: string[];
  checkOuts: string[];
  status: 'present' | 'incomplete' | 'absent' | 'on_leave' | 'half_day' | 'work_from_home';
  attendanceStatus: string | null;
  isWFH?: boolean;
  isOD?: boolean;
}

interface ProcessedData {
  [dateKey: string]: DayData;
}

interface DayInfo {
  day: number;
  dateKey: string;
  data: DayData | undefined;
}

interface WFHApplication {
  name: string;
  employee: string;
  wfh_start_date: string;
  wfh_end_date: string;
  approval_status: string;
  purpose_of_wfh: string;
  creation: string;
}

interface ODApplication {
  name: string;
  employee: string;
  od_start_date: string;
  od_end_date: string;
  approval_status: string;
  od_type_description: string;
  creation: string;
}

interface Attendance {
  name: string;
  employee: string;
  attendance_date: string;
  status: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  visible,
  onClose,
  currentEmployee,
  currentMonth,
  setCurrentMonth,
}) => {
  // --------------------------------------------------------------------------
  // Hooks & Theme
  // --------------------------------------------------------------------------
  const frappeService = useFrappeService();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  // --------------------------------------------------------------------------
  // State - Data
  // --------------------------------------------------------------------------
  const [monthlyRecords, setMonthlyRecords] = useState<EmployeeCheckin[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData>({});
  const [wfhDates, setWfhDates] = useState<Set<string>>(new Set());
  const [odDates, setOdDates] = useState<Set<string>>(new Set());
  const [wfhDateCreation, setWfhDateCreation] = useState<Map<string, string>>(new Map());
  const [odDateCreation, setOdDateCreation] = useState<Map<string, string>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  // --------------------------------------------------------------------------
  // State - Missing Punch Tracking
  // --------------------------------------------------------------------------
  const [missingPunchDaysUsed, setMissingPunchDaysUsed] = useState(0);

  // --------------------------------------------------------------------------
  // State - Dialog
  // --------------------------------------------------------------------------
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<DayData | null>(null);
  const [entryTime, setEntryTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowedLogType, setAllowedLogType] = useState<'IN' | 'OUT' | null>(null);

  // --------------------------------------------------------------------------
  // Utility Functions
  // --------------------------------------------------------------------------

  // Format date as YYYY-MM-DD
  const formatDateKey = useCallback((year: number, month: number, day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, []);

  // Get month's start and end date range
  const getMonthDateRange = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const startDateKey = formatDateKey(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateKey = formatDateKey(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    return {
      startTime: `${startDateKey} 00:00:00`,
      endTime: `${endDateKey} 23:59:59`,
      startDate: startDateKey,
      endDate: endDateKey,
    };
  }, [formatDateKey]);

  // --------------------------------------------------------------------------
  // Data Processing
  // --------------------------------------------------------------------------

  // Process attendance and checkin records to determine daily status
  const processAttendanceData = useCallback((
    records: EmployeeCheckin[],
    attendanceRecords: Attendance[] = [],
    wfhDateSet: Set<string> = new Set(),
    odDateSet: Set<string> = new Set()
  ): ProcessedData => {
    const dailyData: ProcessedData = {};

    // First, process Attendance records (for official status like Leave, Half Day, WFH)
    attendanceRecords.forEach(record => {
      if (!record.attendance_date) return;

      const dateKey = record.attendance_date; // Already in YYYY-MM-DD format

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          checkIns: [],
          checkOuts: [],
          status: 'absent',
          attendanceStatus: null,
          isWFH: wfhDateSet.has(dateKey),
          isOD: odDateSet.has(dateKey),
        };
      }

      // Map Frappe attendance status to our status
      const status = record.status?.toLowerCase().replace(/\s+/g, '_');
      dailyData[dateKey].attendanceStatus = status;

      // Set initial status from Attendance record
      if (status === 'on_leave') {
        dailyData[dateKey].status = 'on_leave';
      } else if (status === 'half_day') {
        dailyData[dateKey].status = 'half_day';
      } else if (status === 'work_from_home') {
        dailyData[dateKey].status = 'work_from_home';
      } else if (status === 'present') {
        dailyData[dateKey].status = 'present';
      } else if (status === 'absent') {
        dailyData[dateKey].status = 'absent';
      }
    });

    // Then process Employee Checkin records
    records.forEach(record => {
      if (!record.time) {
        console.warn('Skipping record without time field:', record);
        return;
      }

      const recordDate = new Date(record.time);
      if (isNaN(recordDate.getTime())) {
        console.warn('Invalid date for record:', record);
        return;
      }

      const dateKey = recordDate.toISOString().split('T')[0];

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          checkIns: [],
          checkOuts: [],
          status: 'absent',
          attendanceStatus: null,
          isWFH: wfhDateSet.has(dateKey),
          isOD: odDateSet.has(dateKey),
        };
      }

      if (record.log_type === 'IN') {
        dailyData[dateKey].checkIns.push(record.time);
      } else if (record.log_type === 'OUT') {
        dailyData[dateKey].checkOuts.push(record.time);
      }
    });

    // Determine final status for each day
    Object.keys(dailyData).forEach(dateKey => {
      const dayData = dailyData[dateKey];

      // Check if there are check-in/check-out records
      const hasCheckIn = dayData.checkIns.length > 0;
      const hasCheckOut = dayData.checkOuts.length > 0;

      // Priority 1: If there's an official attendance status (half_day, leave, WFH), preserve it
      // UNLESS the check-ins/outs are incomplete
      if (dayData.attendanceStatus && ['on_leave', 'half_day', 'work_from_home'].includes(dayData.attendanceStatus)) {
        // Check if punches are incomplete (has one but not the other)
        if ((hasCheckIn && !hasCheckOut) || (!hasCheckIn && hasCheckOut)) {
          // Override with incomplete status
          dayData.status = 'incomplete';
        }
        // Otherwise keep the official attendance status (half_day, leave, WFH)
        return;
      }

      // Priority 2: If no official attendance status, determine from check-ins/outs
      if (hasCheckIn || hasCheckOut) {
        if (hasCheckIn && hasCheckOut) {
          if (dayData.checkOuts.length >= dayData.checkIns.length) {
            dayData.status = 'present';
          } else {
            dayData.status = 'incomplete';
          }
        } else if (hasCheckIn && !hasCheckOut) {
          // Has IN but no OUT → Incomplete
          dayData.status = 'incomplete';
        } else if (!hasCheckIn && hasCheckOut) {
          // Has OUT but no IN → Incomplete
          dayData.status = 'incomplete';
        }
      } else if (!dayData.attendanceStatus) {
        // No check-ins, no check-outs, no attendance status → Absent
        dayData.status = 'absent';
      }
    });

    return dailyData;
  }, []);

  // --------------------------------------------------------------------------
  // API Functions
  // --------------------------------------------------------------------------

  // Fetch all monthly records (checkins, attendance, WFH, OD)
  const fetchMonthlyRecords = useCallback(async () => {
    if (!currentEmployee) return;

    try {
      console.log('=== FETCHING MONTHLY RECORDS ===');
      console.log('Employee:', currentEmployee);
      console.log('Current Month:', currentMonth);

      const { startTime, endTime, startDate, endDate } = getMonthDateRange(currentMonth);
      console.log('Date range:', { startTime, endTime });

      // Fetch all data in parallel
      const [records, attendanceRecords, wfhRecords, odRecords] = await Promise.all([
        // Employee Checkin records
        frappeService.getList<EmployeeCheckin>('Employee Checkin', {
          fields: ['name', 'employee', 'time', 'log_type', 'is_missing_punch_entry'],
          filters: {
            employee: currentEmployee.name,
            time: ['between', [startTime, endTime]]
          },
          orderBy: 'time asc',
          limitPageLength: API_LIMITS.MAX_RECORDS
        }),
        // Attendance records
        frappeService.getList<Attendance>('Attendance', {
          fields: ['name', 'employee', 'attendance_date', 'status'],
          filters: {
            employee: currentEmployee.name,
            attendance_date: ['between', [startDate, endDate]],
            docstatus: 1,
          },
          orderBy: 'attendance_date asc',
          limitPageLength: API_LIMITS.MAX_RECORDS
        }),
        // WFH Applications
        frappeService.getList<WFHApplication>('Work From Home Application', {
          fields: ['name', 'employee', 'wfh_start_date', 'wfh_end_date', 'approval_status', 'purpose_of_wfh', 'creation'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: API_LIMITS.MAX_RECORDS
        }),
        // OD Applications
        frappeService.getList<ODApplication>('OD Application', {
          fields: ['name', 'employee', 'od_start_date', 'od_end_date', 'approval_status', 'od_type_description', 'creation'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: API_LIMITS.MAX_RECORDS
        })
      ]);

      console.log('Fetched checkin records:', records?.length || 0);
      console.log('Fetched attendance records:', attendanceRecords?.length || 0);
      console.log('Fetched WFH records:', wfhRecords?.length || 0);
      console.log('Fetched OD records:', odRecords?.length || 0);

      // Process WFH dates with creation timestamps
      const wfhDateSet = new Set<string>();
      const wfhCreationMap = new Map<string, string>();
      (wfhRecords || []).forEach(wfh => {
        const start = new Date(wfh.wfh_start_date);
        const end = new Date(wfh.wfh_end_date);
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
          wfhDateSet.add(dateKey);
          // Store the latest creation time if multiple WFH records exist for same date
          const existingCreation = wfhCreationMap.get(dateKey);
          if (!existingCreation || new Date(wfh.creation) > new Date(existingCreation)) {
            wfhCreationMap.set(dateKey, wfh.creation);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      setWfhDates(wfhDateSet);
      setWfhDateCreation(wfhCreationMap);

      // Process OD dates with creation timestamps
      const odDateSet = new Set<string>();
      const odCreationMap = new Map<string, string>();
      (odRecords || []).forEach(od => {
        const start = new Date(od.od_start_date);
        const end = new Date(od.od_end_date);
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
          odDateSet.add(dateKey);
          // Store the latest creation time if multiple OD records exist for same date
          const existingCreation = odCreationMap.get(dateKey);
          if (!existingCreation || new Date(od.creation) > new Date(existingCreation)) {
            odCreationMap.set(dateKey, od.creation);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      setOdDates(odDateSet);
      setOdDateCreation(odCreationMap);

      setMonthlyRecords(records || []);
      const processed = processAttendanceData(records || [], attendanceRecords || [], wfhDateSet, odDateSet);
      setProcessedData(processed);
      console.log('Processed data:', processed);

    } catch (error) {
      console.error('Error fetching monthly records:', error);
      Alert.alert('Error', 'Failed to fetch calendar data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [currentEmployee, currentMonth, getMonthDateRange, frappeService, processAttendanceData, formatDateKey]);

  // Refresh calendar data
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMonthlyRecords();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMonthlyRecords]);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (visible && currentEmployee) {
      console.log('Calendar opened, fetching records...');
      fetchMonthlyRecords();
    }
  }, [visible, currentMonth, currentEmployee?.name, fetchMonthlyRecords]);

  // --------------------------------------------------------------------------
  // Helper Functions
  // --------------------------------------------------------------------------

  // Format time string to 12-hour format
  const formatTime = (timeString: string): string => {
    const time = new Date(timeString);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Check if date is within editable range (last N days)
  const isWithinLast7Days = (dateKey: string): boolean => {
    const selectedDate = new Date(dateKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - selectedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 && diffDays <= DATE_RANGE.EDITABLE_DAYS - 1;
  };

  // Check if a date is today
  const isToday = (dateKey: string): boolean => {
    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    return dateKey === todayKey;
  };

  // Check if a specific day already has missing punch entries
  const checkIfDayHasMissingPunch = useCallback(async (dateKey: string): Promise<boolean> => {
    if (!currentEmployee) return false;

    try {
      const startTime = `${dateKey} 00:00:00`;
      const endTime = `${dateKey} 23:59:59`;

      const records = await frappeService.getList<EmployeeCheckin>('Employee Checkin', {
        fields: ['name'],
        filters: {
          employee: currentEmployee.name,
          time: ['between', [startTime, endTime]],
          is_missing_punch_entry: 1
        },
        limitPageLength: 1
      });

      return (records?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking if day has missing punch:', error);
      return false;
    }
  }, [currentEmployee, frappeService]);

  // Calculate number of missing punch days used in current month (manual submissions only)
  const calculateMissingPunchDaysUsed = useCallback(async (): Promise<number> => {
    if (!currentEmployee) return 0;

    try {
      const { startTime, endTime } = getMonthDateRange(currentMonth);

      // Fetch only Employee Checkin records marked as missing punch entries
      const missingPunchRecords = await frappeService.getList<EmployeeCheckin>('Employee Checkin', {
        fields: ['name', 'time', 'log_type'],
        filters: {
          employee: currentEmployee.name,
          time: ['between', [startTime, endTime]],
          is_missing_punch_entry: 1
        },
        limitPageLength: API_LIMITS.MAX_RECORDS
      });

      // Count unique days (not records, since a day might have both IN and OUT)
      const uniqueDays = new Set<string>();
      (missingPunchRecords || []).forEach(record => {
        if (record.time) {
          const dateKey = new Date(record.time).toISOString().split('T')[0];
          uniqueDays.add(dateKey);
        }
      });

      console.log('=== MISSING PUNCH CALCULATION ===');
      console.log('Total records with is_missing_punch_entry=1:', missingPunchRecords?.length || 0);
      console.log('Records:', missingPunchRecords?.map(r => ({
        time: r.time,
        log_type: r.log_type,
        date: new Date(r.time).toISOString().split('T')[0]
      })));
      console.log('Unique days:', Array.from(uniqueDays));
      console.log('Count:', uniqueDays.size);

      return uniqueDays.size;
    } catch (error) {
      console.error('Error calculating missing punch days:', error);
      return 0;
    }
  }, [currentEmployee, currentMonth, getMonthDateRange, frappeService]);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (visible && currentEmployee) {
      console.log('Calendar opened, fetching records...');
      fetchMonthlyRecords();
    }
  }, [visible, currentMonth, currentEmployee?.name, fetchMonthlyRecords]);

  // Calculate missing punch days used whenever processedData changes
  useEffect(() => {
    const fetchMissingPunchDays = async () => {
      const daysUsed = await calculateMissingPunchDaysUsed();
      setMissingPunchDaysUsed(daysUsed);
      console.log(`Missing punch days used this month: ${daysUsed}/${MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH}`);
    };
    fetchMissingPunchDays();
  }, [processedData, calculateMissingPunchDaysUsed]);

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  // Handle day cell click - open dialog if within editable range
  const handleDayClick = async (day: number, dayData: DayData | undefined) => {
    const dateKey = formatDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    // Check if date is within last 7 days
    if (!isWithinLast7Days(dateKey)) {
      // If not in last 7 days, don't open dialog - just return without any action
      return;
    }

    // Check if this is today
    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const isCurrentDay = dateKey === todayKey;

    // Determine what entry is allowed
    const hasCheckIn = (dayData?.checkIns.length || 0) > 0;
    const hasCheckOut = (dayData?.checkOuts.length || 0) > 0;
    const isIncomplete = hasCheckIn !== hasCheckOut; // Has one but not the other

    // For current day, check if WFH or OD application exists
    if (isCurrentDay) {
      const hasWFH = wfhDates.has(dateKey);
      const hasOD = odDates.has(dateKey);

      if (!hasWFH && !hasOD) {
        Alert.alert(
          'Not Allowed',
          'Missing punch submission for the current day is only allowed if you have a Work From Home (WFH) or On Duty (OD) application for today.'
        );
        return;
      }
    } else {
      // For past days (within last 7 days)
      // If status is incomplete (has IN but no OUT, or vice versa), allow completing the pair
      // This is allowed even without WFH/OD because employee already punched from biometric
      if (!isIncomplete) {
        // If both are missing (no IN and no OUT), this would be a full missing punch
        // For full missing punch on past days, require WFH or OD
        const hasWFH = wfhDates.has(dateKey);
        const hasOD = odDates.has(dateKey);

        if (!hasWFH && !hasOD) {
          Alert.alert(
            'Not Allowed',
            'Missing punch submission for past days requires a Work From Home (WFH) or On Duty (OD) application, unless you are completing an incomplete punch from biometric.'
          );
          return;
        }
      }
      // If incomplete (has one punch), allow completing without WFH/OD check
      // But still apply 3-day limit for past days

      // For ALL past days (both incomplete and full missing), check 3-day limit
      // Check if this date already has a missing punch entry
      const dayAlreadyHasMissingPunch = await checkIfDayHasMissingPunch(dateKey);

      // Only check limit if this is a NEW day (not already counted)
      if (!dayAlreadyHasMissingPunch && missingPunchDaysUsed >= MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH) {
        Alert.alert(
          'Limit Reached',
          `You have already used ${MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH} missing punch days this month. No more missing punch requests are allowed.`
        );
        return;
      }
    }

    // Check if both check-in and check-out exist, no missing punch entry needed
    if (hasCheckIn && hasCheckOut) {
      Alert.alert('Info', 'You have already completed both check-in and check-out for this day.');
      return;
    }

    // If there's an official Attendance record marked as Present (without check-ins/outs), don't allow manual entry
    if (dayData?.attendanceStatus === 'present' && !hasCheckIn && !hasCheckOut) {
      Alert.alert(
        'Not Allowed',
        'This day is already marked as Present in the attendance system. Manual check-in/out entry is not allowed.'
      );
      return;
    }

    // Within last 7 days - open dialog for entry
    setSelectedDate(dateKey);
    setSelectedDayData(dayData || null);

    // Determine what entry is allowed based on existing punches
    if (hasCheckIn && !hasCheckOut) {
      // Only check-in exists, allow check-out
      setAllowedLogType('OUT');
    } else if (!hasCheckIn && hasCheckOut) {
      // Only check-out exists, allow check-in
      setAllowedLogType('IN');
    } else {
      // Neither exists, start with check-in
      setAllowedLogType('IN');
    }

    // Set default time to current time
    setEntryTime(new Date());

    setShowDialog(true);
  };

  // Handle check-in/check-out entry submission
  const handleSubmitEntry = async () => {
    if (!entryTime || !selectedDate || !currentEmployee || !allowedLogType) {
      Alert.alert('Error', 'Please select a valid time');
      return;
    }

    // Extract time from Date object
    const hours = entryTime.getHours();
    const minutes = entryTime.getMinutes();
    const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Check if this is current day or past day
    const isCurrentDay = isToday(selectedDate);

    // Only mark as missing punch if it's a PAST day (not current day)
    // Current day punches are regular punches, not missing punches
    const isMissingPunchEntry = isCurrentDay ? 0 : 1;

    setIsSubmitting(true);
    try {
      const timestamp = `${selectedDate} ${time24}:00`;

      console.log(`Creating ${allowedLogType} record:`, {
        employee: currentEmployee.name,
        time: timestamp,
        log_type: allowedLogType,
        is_missing_punch_entry: isMissingPunchEntry
      });

      const result = await frappeService.createDoc<EmployeeCheckin>('Employee Checkin', {
        employee: currentEmployee.name,
        time: timestamp,
        log_type: allowedLogType,
        is_missing_punch_entry: isMissingPunchEntry
      });

      console.log(`${allowedLogType} record created:`, result);

      setShowDialog(false);
      setEntryTime(new Date());
      setShowTimePicker(false);
      setSelectedDate(null);
      setSelectedDayData(null);
      setAllowedLogType(null);

      Alert.alert('Success', `${allowedLogType === 'IN' ? 'Check-in' : 'Check-out'} record added successfully!`);

      await fetchMonthlyRecords();

      // Recalculate missing punch days to update the display
      const updatedDaysUsed = await calculateMissingPunchDaysUsed();
      setMissingPunchDaysUsed(updatedDaysUsed);
      console.log(`Updated missing punch days: ${updatedDaysUsed}/${MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH}`);

    } catch (error) {
      console.error(`Error creating ${allowedLogType} record:`, error);
      Alert.alert('Error', `Failed to add ${allowedLogType === 'IN' ? 'check-in' : 'check-out'} record: ` + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Rendering Functions
  // --------------------------------------------------------------------------

  // Generate calendar grid data structure
  const renderCalendarGrid = (): (DayInfo | null)[][] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const weeks: (DayInfo | null)[][] = [];
    let currentWeek: (DayInfo | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const dateKey = formatDateKey(year, month, day);
      const dayData = processedData[dateKey];

      currentWeek.push({
        day,
        dateKey,
        data: dayData
      });
    }

    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);

    return weeks;
  };

  // Get status color from constants
  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.default;
  };

  // Get status text indicator from constants
  const getStatusText = (status: string): string => {
    return STATUS_TEXT[status as keyof typeof STATUS_TEXT] || '';
  };

  // Render individual day cell
  const renderDayCell = (dayInfo: DayInfo | null, index: number) => {
    if (!dayInfo) {
      return <View style={[styles.dayCell, styles.emptyCell, { backgroundColor: theme.colors.background }]} key={`empty-${index}`} />;
    }

    const { day, data, dateKey } = dayInfo;

    // Check if this is today
    const today = new Date();
    const isToday =
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day;

    // Check if WFH or OD application exists for this date
    const isWFH = wfhDates.has(dateKey);
    const isOD = odDates.has(dateKey);

    // Determine background color based on data availability
    // Priority: Attendance status > WFH/OD applications > Today highlight
    let backgroundColor = theme.colors.card;

    // Check if there's attendance/checkin data
    const hasAttendanceRecord = data && data.attendanceStatus !== null;

    // Priority 1: If there's an official Attendance record or check-ins/outs, use that color
    if (data && (hasAttendanceRecord || data.status === 'incomplete')) {
      // Use consistent opacity for all attendance records (same color for same status, like a chart)
      backgroundColor = getStatusColor(data.status) + OPACITY.FULL;
    } else if (isWFH || isOD) {
      // Priority 2: If no attendance but WFH/OD exists, show WFH/OD color
      // Determine which application to show (if both exist, show the later one)
      let showWFHColor = false;

      if (isWFH && isOD) {
        const wfhCreation = wfhDateCreation.get(dateKey);
        const odCreation = odDateCreation.get(dateKey);
        showWFHColor = !!(wfhCreation && odCreation && new Date(wfhCreation) > new Date(odCreation));
      } else if (isWFH) {
        showWFHColor = true;
      }

      if (showWFHColor) {
        backgroundColor = STATUS_COLORS.wfh + OPACITY.LIGHT;
      } else {
        backgroundColor = STATUS_COLORS.od + OPACITY.LIGHT;
      }
    } else if (isToday) {
      // Priority 3: Today highlight
      backgroundColor = theme.colors.primary + OPACITY.LIGHT;
    }

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          { backgroundColor }
        ]}
        onPress={() => handleDayClick(day, data)}
        accessibilityRole="button"
        accessibilityLabel={`Day ${day}${data ? `, Status: ${data.status}` : ''}${isWFH ? ', Work From Home' : ''}${isOD ? ', On Duty' : ''}`}
      >
        <Text style={[styles.dayNumber, { color: theme.colors.text }, isToday && { color: theme.colors.primary, fontWeight: 'bold' }]}>
          {day}
        </Text>
        {/* Status indicator badge - Priority: Most recent application (WFH/OD by creation time) > Attendance Status */}
        {(() => {
          // If both WFH and OD exist, show the one that was created later
          if (isWFH && isOD) {
            const wfhCreation = wfhDateCreation.get(dateKey);
            const odCreation = odDateCreation.get(dateKey);

            // Compare creation timestamps - show the later one
            const showWFH = !!(wfhCreation && odCreation && new Date(wfhCreation) > new Date(odCreation));

            if (showWFH) {
              return (
                <View style={[styles.statusIndicator, { backgroundColor: STATUS_COLORS.wfh }]}>
                  <Text style={styles.statusText}>W</Text>
                </View>
              );
            } else {
              return (
                <View style={[styles.statusIndicator, { backgroundColor: STATUS_COLORS.od }]}>
                  <Text style={styles.statusText}>O</Text>
                </View>
              );
            }
          } else if (isWFH) {
            return (
              <View style={[styles.statusIndicator, { backgroundColor: STATUS_COLORS.wfh }]}>
                <Text style={styles.statusText}>W</Text>
              </View>
            );
          } else if (isOD) {
            return (
              <View style={[styles.statusIndicator, { backgroundColor: STATUS_COLORS.od }]}>
                <Text style={styles.statusText}>O</Text>
              </View>
            );
          } else if (data) {
            return (
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(data.status) }]}>
                <Text style={styles.statusText}>{getStatusText(data.status)}</Text>
              </View>
            );
          }
          return null;
        })()}
      </TouchableOpacity>
    );
  };

  // Render week row
  const renderWeek = (week: (DayInfo | null)[], weekIndex: number) => (
    <View key={weekIndex} style={styles.weekRow}>
      {week.map((dayInfo, dayIndex) => renderDayCell(dayInfo, dayIndex))}
    </View>
  );

  const weeks = renderCalendarGrid();

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.background }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Attendance Calendar</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary, theme.colors.activeTab]}
              tintColor={theme.colors.primary}
              title="Pull to refresh"
              titleColor={theme.colors.primary}
            />
          }
        >
          {/* Current Month Display */}
          <View style={[styles.monthDisplay, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.monthText, { color: theme.colors.text }]}>
              {currentMonth?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          {/* Missing Punch Limit Info */}
          <View style={[styles.missingPunchInfo, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.missingPunchHeader}>
              <Ionicons name="time-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.missingPunchTitle, { color: theme.colors.text }]}>Missing Punch Limit</Text>
            </View>
            <View style={styles.missingPunchStats}>
              <Text style={[styles.missingPunchText, { color: theme.colors.textSecondary }]}>
                Used: <Text style={{ color: missingPunchDaysUsed >= MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH ? STATUS_COLORS.absent : theme.colors.text, fontWeight: 'bold' }}>
                  {missingPunchDaysUsed}
                </Text> / {MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH} days
              </Text>
              {missingPunchDaysUsed >= MISSING_PUNCH_LIMITS.MAX_DAYS_PER_MONTH && (
                <Text style={[styles.limitReachedText, { color: STATUS_COLORS.absent }]}>
                  Limit reached - no more missing punch requests allowed this month
                </Text>
              )}
            </View>
          </View>

          {/* Legend */}
          <View style={[styles.legendContainer, { backgroundColor: theme.colors.card }]}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.present }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.absent }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.on_leave }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>On Leave</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.half_day }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Half Day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.work_from_home }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>WFH</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.incomplete }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Incomplete</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.od }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>OD</Text>
              </View>
            </View>
          </View>

          {/* Day Headers */}
          <View style={[styles.dayHeaders, { backgroundColor: theme.colors.card }]}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Text key={day} style={[styles.dayHeader, { color: theme.colors.textSecondary }]}>{day}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={[styles.calendarGrid, { backgroundColor: theme.colors.card }]}>
            {weeks.map((week, weekIndex) => renderWeek(week, weekIndex))}
          </View>
        </ScrollView>

        {/* Checkout Dialog */}
        <Modal
          visible={showDialog}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowDialog(false);
            setShowTimePicker(false);
          }}
        >
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogContainer, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.dialogHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>
                  {allowedLogType === 'IN' ? 'Add Check-in' : allowedLogType === 'OUT' ? 'Add Check-out' : 'Attendance Entry'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowDialog(false);
                    setShowTimePicker(false);
                  }}
                  style={styles.dialogCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close dialog"
                >
                  <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.dialogContent}>
                <Text style={[styles.dialogDate, { color: theme.colors.text }]}>
                  Date: {selectedDate}
                </Text>

                {allowedLogType === null && (
                  <Text style={[styles.warningText, { color: STATUS_COLORS.od }]}>
                    You have already completed both check-in and check-out for this day.
                  </Text>
                )}

                {selectedDayData && (selectedDayData.checkIns.length > 0 || selectedDayData.checkOuts.length > 0) && (
                  <View style={[styles.existingRecords, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Existing Records:</Text>
                    {selectedDayData.checkIns.map((checkIn, index) => (
                      <Text key={`in-${index}`} style={[styles.recordText, { color: theme.colors.textSecondary }]}>
                        Check-in: {formatTime(checkIn)}
                      </Text>
                    ))}
                    {selectedDayData.checkOuts.map((checkOut, index) => (
                      <Text key={`out-${index}`} style={[styles.recordText, { color: theme.colors.textSecondary }]}>
                        Check-out: {formatTime(checkOut)}
                      </Text>
                    ))}
                  </View>
                )}

                {allowedLogType && (
                  <View style={styles.inputSection}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                      {allowedLogType === 'IN' ? 'Check-in' : 'Check-out'} Time:
                    </Text>
                    <TouchableOpacity
                      style={[styles.timePickerButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={20} color={theme.colors.text} />
                      <Text style={[styles.timePickerText, { color: theme.colors.text }]}>
                        {entryTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={entryTime}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === 'android') {
                            setShowTimePicker(false);
                          }
                          if (selectedDate) {
                            setEntryTime(selectedDate);
                          }
                        }}
                      />
                    )}
                    {Platform.OS === 'ios' && showTimePicker && (
                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={[styles.dialogActions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowDialog(false);
                    setShowTimePicker(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                {allowedLogType && (
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.colors.primary }, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmitEntry}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? 'Adding...' : `Add ${allowedLogType === 'IN' ? 'Check-in' : 'Check-out'}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  monthDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  missingPunchInfo: {
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  missingPunchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  missingPunchTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  missingPunchStats: {
    marginLeft: 28,
  },
  missingPunchText: {
    fontSize: 13,
  },
  limitReachedText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  legendContainer: {
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    flexShrink: 1,
  },
  dayHeaders: {
    flexDirection: 'row',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 12,
  },
  dayHeader: {
    width: CELL_WIDTH,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: CELL_WIDTH,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  emptyCell: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dialogCloseButton: {
    padding: 4,
  },
  dialogContent: {
    padding: 20,
  },
  dialogDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  existingRecords: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  recordText: {
    fontSize: 14,
    marginBottom: 4,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  timePickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  doneButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AttendanceCalendar;
