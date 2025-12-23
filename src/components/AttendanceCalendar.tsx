import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useFrappeService } from '@/services/frappeService';
import type { Employee, EmployeeCheckin } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CELL_WIDTH = (width - 40) / 7;

interface AttendanceCalendarProps {
  visible: boolean;
  onClose: () => void;
  currentEmployee: Employee | null;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
}

interface DayInfo {
  day: number;
  dateKey: string;
  isWFH?: boolean;
  isOD?: boolean;
}

interface WFHApplication {
  name: string;
  employee: string;
  wfh_start_date: string;
  wfh_end_date: string;
  approval_status: string;
  purpose_of_wfh: string;
}

interface ODApplication {
  name: string;
  employee: string;
  od_start_date: string;
  od_end_date: string;
  approval_status: string;
  od_type_description: string;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  visible,
  onClose,
  currentEmployee,
  currentMonth,
  setCurrentMonth,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const frappeService = useFrappeService();

  const [wfhApplications, setWfhApplications] = useState<WFHApplication[]>([]);
  const [wfhDates, setWfhDates] = useState<Set<string>>(new Set());
  const [odApplications, setOdApplications] = useState<ODApplication[]>([]);
  const [odDates, setOdDates] = useState<Set<string>>(new Set());

  // Dialog state for check-in/check-out
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [checkinTime, setCheckinTime] = useState('');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCheckins, setExistingCheckins] = useState<EmployeeCheckin[]>([]);
  const [allowedLogType, setAllowedLogType] = useState<'IN' | 'OUT' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch WFH applications
  useEffect(() => {
    const fetchWFHApplications = async () => {
      if (!visible || !currentEmployee) return;

      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        console.log('Fetching WFH applications for:', currentEmployee.name);
        console.log('Date range:', startDateStr, 'to', endDateStr);

        const wfhRecords = await frappeService.getList<WFHApplication>('Work From Home Application', {
          fields: ['name', 'employee', 'wfh_start_date', 'wfh_end_date', 'approval_status', 'purpose_of_wfh'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: 1000
        });

        console.log('Fetched WFH applications:', wfhRecords);

        setWfhApplications(wfhRecords || []);

        // Process WFH dates
        const wfhDateSet = new Set<string>();
        (wfhRecords || []).forEach(wfh => {
          const start = new Date(wfh.wfh_start_date);
          const end = new Date(wfh.wfh_end_date);

          // Add all dates in the range
          const currentDate = new Date(start);
          while (currentDate <= end) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            wfhDateSet.add(dateKey);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });

        console.log('WFH dates:', Array.from(wfhDateSet));
        setWfhDates(wfhDateSet);

      } catch (error) {
        console.error('Error fetching WFH applications:', error);
      }
    };

    const fetchODApplications = async () => {
      if (!visible || !currentEmployee) return;

      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        console.log('Fetching OD applications for:', currentEmployee.name);
        console.log('Date range:', startDateStr, 'to', endDateStr);

        const odRecords = await frappeService.getList<ODApplication>('OD Application', {
          fields: ['name', 'employee', 'od_start_date', 'od_end_date', 'approval_status', 'od_type_description'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: 1000
        });

        console.log('Fetched OD applications:', odRecords);

        setOdApplications(odRecords || []);

        // Process OD dates
        const odDateSet = new Set<string>();
        (odRecords || []).forEach(od => {
          const start = new Date(od.od_start_date);
          const end = new Date(od.od_end_date);

          // Add all dates in the range
          const currentDate = new Date(start);
          while (currentDate <= end) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            odDateSet.add(dateKey);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });

        console.log('OD dates:', Array.from(odDateSet));
        setOdDates(odDateSet);

      } catch (error) {
        console.error('Error fetching OD applications:', error);
      }
    };

    fetchWFHApplications();
    fetchODApplications();
  }, [visible, currentMonth, currentEmployee, frappeService]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!visible || !currentEmployee) return;

    setRefreshing(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      // Fetch both WFH and OD applications in parallel
      const [wfhRecords, odRecords] = await Promise.all([
        frappeService.getList<WFHApplication>('Work From Home Application', {
          fields: ['name', 'employee', 'wfh_start_date', 'wfh_end_date', 'approval_status', 'purpose_of_wfh'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: 1000
        }),
        frappeService.getList<ODApplication>('OD Application', {
          fields: ['name', 'employee', 'od_start_date', 'od_end_date', 'approval_status', 'od_type_description'],
          filters: {
            employee: currentEmployee.name,
            approval_status: 'Approved',
            docstatus: 1,
          },
          limitPageLength: 1000
        })
      ]);

      // Process WFH dates
      setWfhApplications(wfhRecords || []);
      const wfhDateSet = new Set<string>();
      (wfhRecords || []).forEach(wfh => {
        const start = new Date(wfh.wfh_start_date);
        const end = new Date(wfh.wfh_end_date);
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          wfhDateSet.add(dateKey);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      setWfhDates(wfhDateSet);

      // Process OD dates
      setOdApplications(odRecords || []);
      const odDateSet = new Set<string>();
      (odRecords || []).forEach(od => {
        const start = new Date(od.od_start_date);
        const end = new Date(od.od_end_date);
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          odDateSet.add(dateKey);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      setOdDates(odDateSet);

      console.log('Refresh completed - WFH:', wfhRecords?.length, 'OD:', odRecords?.length);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [visible, currentEmployee, currentMonth, frappeService]);

  // Check if a date is today
  const isCurrentDate = (dateKey: string): boolean => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateKey === todayKey;
  };

  // Convert 24-hour time to 12-hour format
  const convert24to12 = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Convert 12-hour time to 24-hour format
  const convert12to24 = (time12: string): string => {
    if (!time12) return '';
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return time12; // Return as is if not in correct format

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  // Fetch existing check-ins for the selected date
  const fetchExistingCheckins = async (dateKey: string) => {
    if (!currentEmployee) return;

    try {
      const startTime = `${dateKey} 00:00:00`;
      const endTime = `${dateKey} 23:59:59`;

      const checkins = await frappeService.getList<EmployeeCheckin>('Employee Checkin', {
        fields: ['name', 'employee', 'time', 'log_type'],
        filters: {
          employee: currentEmployee.name,
          time: ['between', [startTime, endTime]]
        },
        limitPageLength: 100
      });

      setExistingCheckins(checkins || []);

      // Determine allowed log type
      const hasCheckIn = checkins?.some(c => c.log_type === 'IN');
      const hasCheckOut = checkins?.some(c => c.log_type === 'OUT');

      if (!hasCheckIn) {
        setAllowedLogType('IN');
      } else if (hasCheckIn && !hasCheckOut) {
        setAllowedLogType('OUT');
      } else {
        setAllowedLogType(null);
      }

    } catch (error) {
      console.error('Error fetching existing check-ins:', error);
      setExistingCheckins([]);
      setAllowedLogType('IN'); // Default to IN if error
    }
  };

  // Handle day click
  const handleDayClick = async (dateKey: string) => {
    // Check if it's current date
    if (!isCurrentDate(dateKey)) {
      Alert.alert('Not Allowed', 'You can only add check-in/check-out for today\'s date.');
      return;
    }

    // Check if there's an approved WFH application for this date
    const hasApprovedWFH = wfhDates.has(dateKey);
    if (!hasApprovedWFH) {
      Alert.alert('Not Allowed', 'You can only add check-in/check-out when you have an approved Work From Home application.');
      return;
    }

    setSelectedDate(dateKey);

    // Fetch existing check-ins for this date
    await fetchExistingCheckins(dateKey);

    // Set default times in 12-hour format
    const now = new Date();
    const currentTime24 = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentTime12 = convert24to12(currentTime24);
    setCheckinTime(currentTime12);
    setCheckoutTime(currentTime12);

    setShowCheckinDialog(true);
  };

  // Submit check-in
  const handleSubmitCheckin = async () => {
    if (!checkinTime || !selectedDate || !currentEmployee) {
      Alert.alert('Error', 'Please enter a valid check-in time');
      return;
    }

    // Convert 12-hour time to 24-hour format
    const time24 = convert12to24(checkinTime);
    if (!time24 || !time24.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Error', 'Please enter a valid time in format HH:MM AM/PM (e.g., 09:30 AM)');
      return;
    }

    setIsSubmitting(true);
    try {
      const checkinTimestamp = `${selectedDate} ${time24}:00`;

      console.log('Creating check-in record:', {
        employee: currentEmployee.name,
        time: checkinTimestamp,
        log_type: 'IN'
      });

      await frappeService.createDoc<EmployeeCheckin>('Employee Checkin', {
        employee: currentEmployee.name,
        time: checkinTimestamp,
        log_type: 'IN'
      });

      Alert.alert('Success', 'Check-in recorded successfully!');
      setShowCheckinDialog(false);
      setCheckinTime('');
      setCheckoutTime('');
      setSelectedDate(null);

    } catch (error) {
      console.error('Error creating check-in record:', error);
      Alert.alert('Error', 'Failed to record check-in: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit check-out
  const handleSubmitCheckout = async () => {
    if (!checkoutTime || !selectedDate || !currentEmployee) {
      Alert.alert('Error', 'Please enter a valid check-out time');
      return;
    }

    // Convert 12-hour time to 24-hour format
    const time24 = convert12to24(checkoutTime);
    if (!time24 || !time24.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Error', 'Please enter a valid time in format HH:MM AM/PM (e.g., 05:30 PM)');
      return;
    }

    setIsSubmitting(true);
    try {
      const checkoutTimestamp = `${selectedDate} ${time24}:00`;

      console.log('Creating check-out record:', {
        employee: currentEmployee.name,
        time: checkoutTimestamp,
        log_type: 'OUT'
      });

      await frappeService.createDoc<EmployeeCheckin>('Employee Checkin', {
        employee: currentEmployee.name,
        time: checkoutTimestamp,
        log_type: 'OUT'
      });

      Alert.alert('Success', 'Check-out recorded successfully!');
      setShowCheckinDialog(false);
      setCheckinTime('');
      setCheckoutTime('');
      setSelectedDate(null);

    } catch (error) {
      console.error('Error creating check-out record:', error);
      Alert.alert('Error', 'Failed to record check-out: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

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

      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isWFH = wfhDates.has(dateKey);
      const isOD = odDates.has(dateKey);

      currentWeek.push({
        day,
        dateKey,
        isWFH,
        isOD,
      });
    }

    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);

    return weeks;
  };

  const renderDayCell = (dayInfo: DayInfo | null, index: number) => {
    if (!dayInfo) {
      return <View style={[styles.dayCell, styles.emptyCell, { backgroundColor: theme.colors.background }]} key={`empty-${index}`} />;
    }

    const { day, dateKey, isWFH, isOD } = dayInfo;
    const today = new Date();
    const isToday =
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day;

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          { backgroundColor: theme.colors.card },
          isToday && { backgroundColor: theme.colors.primary + '20' },
          isWFH && { backgroundColor: '#2196F3' + '20' },
          isOD && { backgroundColor: '#FF9800' + '20' },
        ]}
        onPress={() => handleDayClick(dateKey)}
        accessibilityRole="button"
        accessibilityLabel={`Day ${day}${isWFH ? ', Work From Home' : ''}${isToday ? ', Today' : ''}`}
      >
        <Text style={[styles.dayNumber, { color: theme.colors.text }, isToday && { color: theme.colors.primary, fontWeight: 'bold' }]}>
          {day}
        </Text>
        {isWFH && (
          <View style={[styles.statusIndicator, { backgroundColor: '#2196F3' }]}>
            <Text style={styles.statusText}>W</Text>
          </View>
        )}
        {isOD && (
          <View style={[styles.statusIndicator, styles.statusIndicatorOD, { backgroundColor: '#FF9800' }]}>
            <Text style={styles.statusText}>O</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderWeek = (week: (DayInfo | null)[], weekIndex: number) => (
    <View key={weekIndex} style={styles.weekRow}>
      {week.map((dayInfo, dayIndex) => renderDayCell(dayInfo, dayIndex))}
    </View>
  );

  const weeks = renderCalendarGrid();

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

          {/* Legend */}
          <View style={[styles.legendContainer, { backgroundColor: theme.colors.card }]}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#9C27B0' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>On Leave</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#00BCD4' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Half Day</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>OD</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>WFH</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FFC107' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Incomplete</Text>
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

        {/* Check-in/Check-out Dialog */}
        <Modal
          visible={showCheckinDialog}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCheckinDialog(false)}
        >
          <View style={styles.dialogOverlay}>
            <View style={[styles.dialogContainer, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.dialogHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>Add Check-in/Check-out</Text>
                <TouchableOpacity
                  onPress={() => setShowCheckinDialog(false)}
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
                  <Text style={[styles.warningText, { color: '#FF9800' }]}>
                    You have already completed both check-in and check-out for today.
                  </Text>
                )}

                {allowedLogType === 'IN' && (
                  <View style={styles.inputSection}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Check-in Time (12-hour format):</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={checkinTime}
                      onChangeText={setCheckinTime}
                      placeholder="09:00 AM"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>Format: HH:MM AM/PM (e.g., 09:30 AM)</Text>
                  </View>
                )}

                {allowedLogType === 'OUT' && (
                  <View style={styles.inputSection}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Check-out Time (12-hour format):</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={checkoutTime}
                      onChangeText={setCheckoutTime}
                      placeholder="05:00 PM"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>Format: HH:MM AM/PM (e.g., 05:30 PM)</Text>
                  </View>
                )}
              </View>

              <View style={[styles.dialogActions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCheckinDialog(false)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                {allowedLogType === 'IN' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#4CAF50' }, isSubmitting && styles.actionButtonDisabled]}
                    onPress={handleSubmitCheckin}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <Text style={styles.actionButtonText}>
                      {isSubmitting ? 'Adding...' : 'Check In'}
                    </Text>
                  </TouchableOpacity>
                )}

                {allowedLogType === 'OUT' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }, isSubmitting && styles.actionButtonDisabled]}
                    onPress={handleSubmitCheckout}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <Text style={styles.actionButtonText}>
                      {isSubmitting ? 'Adding...' : 'Check Out'}
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
  statusIndicatorOD: {
    right: 'auto',
    left: 2,
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
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AttendanceCalendar;
