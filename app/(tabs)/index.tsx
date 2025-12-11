import { AttendanceCalendar, Navbar } from '@/components';
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFrappeService } from '@/services/frappeService';
import type { Employee, EmployeeCheckin, GreetingIcon, QuickAction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const frappeService = useFrappeService();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  // State management
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [todayCheckins, setTodayCheckins] = useState<EmployeeCheckin[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [showCheckButton, setShowCheckButton] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Quick Actions Configuration
  const quickActions: QuickAction[] = [
    {
      id: 'gatepass',
      title: 'Gatepass',
      icon: 'exit-outline' as keyof typeof Ionicons.glyphMap,
      color: '#4CAF50',
      onPress: () => router.push('/(screens)/GatepassApplication')
    },
    {
      id: 'od',
      title: 'OD Application',
      icon: 'briefcase-outline' as keyof typeof Ionicons.glyphMap,
      color: '#2196F3',
      onPress: () => router.push('/(screens)/ODApplication')
    },
    {
      id: 'wfh',
      title: 'WFH Application',
      icon: 'home-outline' as keyof typeof Ionicons.glyphMap,
      color: '#FF9800',
      onPress: () => router.push('/(screens)/WFHApplication')
    },
    {
      id: 'applications',
      title: 'All Applications',
      icon: 'documents-outline',
      color: '#667eea',
      onPress: () => router.push('/(screens)/ApplicationsList')
    },
    {
      id: 'leave',
      title: 'Apply Leave',
      icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
      color: '#9C27B0',
      onPress: () => router.push('/(screens)/LeaveApplication')
    },
    {
      id: 'holidays',
      title: 'Holidays',
      icon: 'calendar' as keyof typeof Ionicons.glyphMap,
      color: '#FF5722',
      onPress: () => router.push('/(screens)/Holidays')
    }
  ];

  // Utility functions
  const formatTimestamp = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const getTodayDateRange = useCallback(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    return {
      startTime: `${yyyy}-${mm}-${dd} 00:00:00`,
      endTime: `${yyyy}-${mm}-${dd} 23:59:59`,
    };
  }, []);

  const formatTime = (timeString: string): string => {
    const time = new Date(timeString);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get dynamic greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  };

  // Get dynamic icon based on time of day
  const getGreetingIcon = (): GreetingIcon => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { name: 'sunny', color: '#FF9800' };
    } else if (hour >= 12 && hour < 17) {
      return { name: 'sunny-outline', color: '#FFC107' };
    } else if (hour >= 17 && hour < 21) {
      return { name: 'partly-sunny', color: '#FF6F00' };
    } else {
      return { name: 'moon', color: '#7B1FA2' };
    }
  };

  // Core functions
  const checkTodayCheckinStatus = useCallback(async (employeeName: string) => {
    try {
      const { startTime, endTime } = getTodayDateRange();

      const checkins = await frappeService.getList<EmployeeCheckin>('Employee Checkin', {
        fields: ['name', 'employee', 'time', 'log_type', 'creation'],
        filters: {
          employee: employeeName,
          creation: ['between', [startTime, endTime]]
        },
        orderBy: 'creation asc'
      });

      console.log('Today checkins:', checkins);
      setTodayCheckins(checkins || []);

      if (checkins && checkins.length > 0) {
        const inLog = checkins.find(entry => entry.log_type === 'IN');
        const outLog = checkins.find(entry => entry.log_type === 'OUT');

        if (inLog && outLog) {
          setShowCheckButton(false);
          setCheckInTime('');
          setIsCheckedIn(false);
        } else if (inLog) {
          setShowCheckButton(true);

          let checkinTime = inLog.time || inLog.creation;

          if (!checkinTime) {
            console.log('Time field missing in list response, fetching full document:', inLog.name);
            try {
              const fullDoc = await frappeService.getDoc<EmployeeCheckin>('Employee Checkin', inLog.name);
              console.log('Full checkin document:', fullDoc);
              checkinTime = fullDoc.time || fullDoc.creation;
            } catch (fetchError) {
              console.error('Error fetching full checkin document:', fetchError);
            }
          }

          try {
            console.log('Raw check-in time from DB:', checkinTime);

            if (!checkinTime) {
              console.warn('Check-in record has no time field');
              setCheckInTime('--:--');
              setIsCheckedIn(true);
              return;
            }

            const timeStr = String(checkinTime);
            let parsedDate: Date;

            if (timeStr.includes(' ')) {
              const [datePart, timePart] = timeStr.split(' ');

              if (datePart.includes('-')) {
                const parts = datePart.split('-');

                if (parts[0].length === 4) {
                  parsedDate = new Date(timeStr.replace(' ', 'T'));
                } else {
                  const [day, month, year] = parts;
                  parsedDate = new Date(`${year}-${month}-${day}T${timePart}`);
                }
              } else {
                parsedDate = new Date(timeStr);
              }
            } else {
              parsedDate = new Date(timeStr);
            }

            if (!parsedDate || isNaN(parsedDate.getTime())) {
              throw new Error('Invalid date');
            }

            const formattedTime = parsedDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

            console.log('Formatted check-in time:', formattedTime);
            setCheckInTime(formattedTime);
          } catch (error) {
            console.error('Error parsing check-in time:', error, checkinTime);
            try {
              const timeStr = String(checkinTime);
              const timePart = timeStr.split(' ')[1];
              if (timePart) {
                const [hours, minutes] = timePart.split(':');
                const hour = parseInt(hours);
                const minute = parseInt(minutes);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                const formattedTime = `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
                console.log('Fallback formatted time:', formattedTime);
                setCheckInTime(formattedTime);
              } else {
                setCheckInTime('--:--');
              }
            } catch (fallbackError) {
              console.error('Fallback parsing also failed:', fallbackError);
              setCheckInTime('--:--');
            }
          }

          setIsCheckedIn(true);
        } else {
          setShowCheckButton(true);
          setCheckInTime('');
          setIsCheckedIn(false);
        }
      } else {
        setShowCheckButton(true);
        setCheckInTime('');
        setIsCheckedIn(false);
      }
    } catch (error) {
      console.error('Error checking today checkin status:', error);
      throw error;
    }
  }, [getTodayDateRange, frappeService]);


  const checkEmployeeExist = useCallback(async () => {
    if (!user?.email) {
      setShowCheckButton(false);
      setCurrentEmployee(null);
      return;
    }

    try {
      console.log('Checking employee for user:', user.email);

      const employees = await frappeService.getList<Employee>('Employee', {
        fields: ['name', 'employee_name', 'user_id', 'status'],
        filters: { user_id: user.email },
        limitPageLength: 1
      });

      if (employees && employees.length > 0) {
        const employeeData = employees[0];
        console.log('Found employee:', employeeData);
        setCurrentEmployee(employeeData);
        await checkTodayCheckinStatus(employeeData.name);
      } else {
        console.log('No employee found for user:', user.email);
        setShowCheckButton(false);
        setCurrentEmployee(null);
        setIsCheckedIn(false);
        setCheckInTime('');
      }
    } catch (error) {
      console.error('Error checking employee:', error);
      if (!refreshing) {
        Alert.alert('Error', 'Failed to check employee status: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      setShowCheckButton(false);
      setCurrentEmployee(null);
    }
  }, [user?.email, frappeService, checkTodayCheckinStatus, refreshing]);

  const handleEmployeeCheckIn = useCallback(async () => {
    if (!currentEmployee) {
      Alert.alert('Error', 'Employee information not found. Please try refreshing.');
      return;
    }

    setCheckInLoading(true);
    try {
      const logType: 'IN' | 'OUT' = isCheckedIn ? 'OUT' : 'IN';
      const timestamp = formatTimestamp();

      let locationString: string | null = null;
      let hasLocation = false;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const latitude = location.coords.latitude;
          const longitude = location.coords.longitude;

          console.log(`Location captured for ${isCheckedIn ? 'check-out' : 'check-in'}:`, { lat: latitude, lng: longitude });

          let locationParts = [`${latitude}, ${longitude}`];

          try {
            const [address] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            if (address) {
              const addressComponents = [];

              if (address.name) addressComponents.push(address.name);
              if (address.street) {
                const street = address.streetNumber
                  ? `${address.streetNumber} ${address.street}`
                  : address.street;
                addressComponents.push(street);
              }
              if (address.district) addressComponents.push(address.district);
              if (address.city) addressComponents.push(address.city);
              if (address.postalCode) addressComponents.push(address.postalCode);
              if (address.country) addressComponents.push(address.country);

              const fullAddress = addressComponents.join(', ');
              if (fullAddress) {
                locationParts.push(fullAddress);
              }

              console.log('Address resolved:', fullAddress);
            }
          } catch (geocodeError) {
            console.warn('Could not get address from coordinates:', geocodeError);
          }

          locationString = locationParts.join(' | ');
          hasLocation = true;

          console.log(`${isCheckedIn ? 'Check-out' : 'Check-in'} location:`, locationString);
        } else {
          console.warn('Location permission denied');
          Alert.alert(
            'Location Permission',
            'Location permission is required for attendance tracking. ' +
            (isCheckedIn ? 'Check-out' : 'Check-in') + ' will continue without location.',
            [{ text: 'OK' }]
          );
        }
      } catch (locationError) {
        console.error('Error getting location:', locationError);
      }

      console.log('Creating checkin record:', {
        employee: currentEmployee.name,
        time: timestamp,
        log_type: logType,
        device_id: locationString
      });

      const result = await frappeService.createDoc<EmployeeCheckin>('Employee Checkin', {
        employee: currentEmployee.name,
        time: timestamp,
        log_type: logType,
        device_id: locationString,
      });

      console.log('Checkin result:', result);

      if (result) {
        if (!isCheckedIn) {
          setIsCheckedIn(true);
          const time = new Date(timestamp);
          const formattedTime = time.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          setCheckInTime(formattedTime);
          console.log('Check-in time set to:', formattedTime);

          let successMessage = `Successfully checked in at ${formatTime(result.creation || timestamp)}`;
          if (hasLocation) {
            successMessage += `\nLocation captured`;
          }

          Alert.alert('Success', successMessage);
        } else {
          setShowCheckButton(false);
          setCheckInTime('');
          setIsCheckedIn(false);

          let successMessage = 'Successfully checked out. Have a great day!';
          if (hasLocation) {
            successMessage += '\nLocation captured';
          }

          Alert.alert('Success', successMessage);
        }

        await checkTodayCheckinStatus(currentEmployee.name);
      }
    } catch (error) {
      console.error('Checkin error:', error);
      Alert.alert('Error', `Failed to ${isCheckedIn ? 'check out' : 'check in'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCheckInLoading(false);
    }
  }, [currentEmployee, isCheckedIn, frappeService, checkTodayCheckinStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await checkEmployeeExist();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [checkEmployeeExist]);

  // Effects
  useEffect(() => {
    let isMounted = true;

    const initializeEmployee = async () => {
      if (isMounted && user?.email) {
        await checkEmployeeExist();
      }
    };

    initializeEmployee();

    return () => {
      isMounted = false;
    };
  }, [user?.email, checkEmployeeExist]);

  // Render functions
  const renderCheckinStatus = () => {
    if (!currentEmployee) {
      return (
        <View style={[styles.statusContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="alert-circle" size={32} color="#F44336" />
          </View>
          <Text style={[styles.statusText, { color: theme.colors.text }]}>Employee Not Found</Text>
          <Text style={[styles.statusSubtext, { color: theme.colors.textSecondary }]}>
            Please contact HR or try refreshing the page.
          </Text>
        </View>
      );
    }

    if (!showCheckButton) {
      return (
        <View style={[styles.statusContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
          </View>
          <Text style={[styles.statusText, { color: theme.colors.text }]}>Work Day Complete!</Text>
          <Text style={[styles.statusSubtext, { color: theme.colors.textSecondary }]}>
            You've successfully completed your work day. Have a great evening!
          </Text>
        </View>
      );
    }

    const greeting = getGreeting();
    const greetingIcon = getGreetingIcon();

    return (
      <View style={[styles.statusContainer, { backgroundColor: theme.colors.background }]}>
        {isCheckedIn ? (
          <>
            <View style={styles.statusIconContainer}>
              <Ionicons name="checkmark-done-circle" size={32} color="#4CAF50" />
            </View>
            <Text style={[styles.statusText, { color: theme.colors.text }]}>Already Checked In!</Text>
            <Text style={[styles.statusSubtext, { color: theme.colors.textSecondary }]}>
              You started your day at <Text style={styles.timeHighlight}>{checkInTime}</Text>
            </Text>
            <Text style={[styles.statusReminder, { color: theme.colors.textSecondary }]}>
              Don't forget to check out when you're done!
            </Text>
          </>
        ) : (
          <>
            <View style={styles.statusIconContainer}>
              <Ionicons name={greetingIcon.name as any} size={32} color={greetingIcon.color} />
            </View>
            <Text style={[styles.statusText, { color: theme.colors.text }]}>{greeting}!</Text>
            <Text style={[styles.statusSubtext, { color: theme.colors.textSecondary }]}>
              You haven't checked in today. Ready to start your day?
            </Text>
          </>
        )}
      </View>
    );
  };

  const renderQuickAction = (action: QuickAction) => (
    <TouchableOpacity
      key={action.id}
      style={styles.quickActionItem}
      onPress={action.onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${action.title} quick action`}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
        <Ionicons name={action.icon as any} size={24} color="#fff" />
      </View>
      <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{action.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Navbar */}
      <Navbar onProfilePress={() => router.push('/(tabs)/profile')} />

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
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
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.activeTab]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.welcomeGradient}
          >
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.welcomeName}>
                {currentEmployee?.employee_name || user?.employee_name || 'User'}
              </Text>
              <Text style={styles.lastRefreshText}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Check-in/Check-out Card */}
        <View style={[styles.checkinCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Attendance</Text>
            <Ionicons name="time" size={24} color={theme.colors.primary} />
          </View>

          {renderCheckinStatus()}

          {/* Check-in/Check-out Button */}
          {showCheckButton && (
            <TouchableOpacity
              onPress={handleEmployeeCheckIn}
              disabled={checkInLoading}
              style={[
                styles.checkinButton,
                checkInLoading && styles.checkinButtonDisabled
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isCheckedIn ? "Check out button" : "Check in button"}
              accessibilityState={{ disabled: checkInLoading }}
            >
              <LinearGradient
                colors={isCheckedIn ? ['#F44336', '#D32F2F'] : ['#4CAF50', '#388E3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkinButtonGradient}
              >
                {checkInLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={isCheckedIn ? "log-out" : "log-in"}
                      size={20}
                      color="#fff"
                      style={styles.checkinIcon}
                    />
                    <Text style={styles.checkinButtonText}>
                      {isCheckedIn ? "Check-Out" : "Check-In"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Calendar Button */}
        {currentEmployee && (
          <View style={styles.calendarCard}>
            <TouchableOpacity
              style={styles.calendarButton}
              onPress={() => {
                // Set to November 2024
                setCurrentMonth(new Date(2025, 10, 1)); // Month is 0-indexed, so 10 = November
                setShowCalendar(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View attendance calendar"
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.activeTab]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.calendarButtonGradient}
              >
                <Ionicons name="calendar" size={24} color="#fff" style={styles.calendarIcon} />
                <Text style={styles.calendarButtonText}>View Attendance Calendar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions Card */}
        {currentEmployee && (
          <View style={[styles.quickActionsCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Quick Actions</Text>
              <Ionicons name="apps" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.quickActionsGrid}>
              {quickActions.map(renderQuickAction)}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Attendance Calendar Modal */}
      <AttendanceCalendar
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        currentEmployee={currentEmployee}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  welcomeCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeGradient: {
    padding: 24,
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  lastRefreshText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkinCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  timeHighlight: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statusReminder: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  checkinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkinButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  checkinButtonDisabled: {
    opacity: 0.6,
  },
  checkinIcon: {
    marginRight: 8,
  },
  checkinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  calendarCard: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  calendarButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calendarButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  calendarIcon: {
    marginRight: 12,
  },
  calendarButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickActionsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quickActionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 24,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  quickActionText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
});
