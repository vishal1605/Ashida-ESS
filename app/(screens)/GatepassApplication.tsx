import { Navbar } from '@/components';
import { COLORS } from '@/constants';
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFrappeService } from '@/services/frappeService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Employee {
  name: string;
  employee_name: string;
  user_id: string;
  attendance_device_id: string;
}

interface MonthlyUsage {
  total_hours_used: number;
  monthly_limit: number;
  remaining_hours: number;
  total_overall_hours: number;
}

interface GatepassApplication {
  employee: string;
  date_of_application: string;
  gp_start_time: string;
  purpose_of_gp: string;
}

export default function GatepassApplicationScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { getList, createDoc, call, submitDoc } = useFrappeService();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  // State management
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);
  const [applicationDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [purpose, setPurpose] = useState<'Personal' | 'Official'>('Personal');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Load employee and monthly usage on component mount
  useEffect(() => {
    fetchEmployeeAndUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEmployeeAndUsage = async () => {
    try {
      // First, get current employee
      const employees = await getList<Employee>('Employee', {
        fields: ['name', 'employee_name', 'user_id', 'attendance_device_id'],
        filters: { user_id: user?.email },
        limitPageLength: 1,
      });

      if (employees && employees.length > 0) {
        setCurrentEmployee(employees[0]);

        // Then fetch monthly usage
        try {
          const usage = await call<MonthlyUsage>(
            'ashida.ashida_gaxis.doctype.gate_pass_application.gate_pass_application.get_employee_monthly_usage',
            {
              employee: employees[0].name,
              date: formatDateForAPI(new Date()),
            }
          );

          if (usage) {
            // Ensure all values are valid numbers, provide defaults if undefined/null
            setMonthlyUsage({
              total_hours_used: usage.total_hours_used ?? 0,
              monthly_limit: usage.monthly_limit ?? 4.0,
              remaining_hours: usage.remaining_hours ?? 4.0,
              total_overall_hours: usage.total_overall_hours ?? 0,
            });
          }
        } catch (usageError) {
          console.error('Error fetching monthly usage:', usageError);
          // Set default values if API fails
          setMonthlyUsage({
            total_hours_used: 0,
            monthly_limit: 4.0,
            remaining_hours: 4.0,
            total_overall_hours: 0,
          });
        }
      } else {
        Alert.alert('Error', 'Employee record not found. Please contact HR.');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      Alert.alert('Error', 'Failed to load employee information');
    } finally {
      setLoadingData(false);
    }
  };

  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatTimeForAPI = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}:00`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const onStartTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      // Validate that selected time is not in the past
      const now = new Date();
      const selectedDateTime = new Date(applicationDate);
      selectedDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());

      if (selectedDateTime < now) {
        Alert.alert(
          'Invalid Time',
          'GP Start Time cannot be in the past. Please select a future time.',
          [{ text: 'OK' }]
        );
        return;
      }

      setStartTime(selectedTime);
      // Auto-calculate end time (start + 2 hours)
      const end = new Date(selectedTime);
      end.setHours(end.getHours() + 2);
      setEndTime(end);
    }
  };

  const validateSubmission = (): string | null => {
    if (!currentEmployee) return 'Employee information not loaded';
    if (!purpose) return 'Please select a purpose';
    if (!monthlyUsage) return 'Loading usage data...';

    // Validate start time is not in the past
    const now = new Date();
    const startDateTime = new Date(applicationDate);
    startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), startTime.getSeconds());

    if (startDateTime < now) {
      return 'GP Start Time cannot be in the past. Please select a future time.';
    }

    // Check sufficient hours (2-hour gatepass)
    if (monthlyUsage.remaining_hours < 2.0) {
      return `Insufficient hours. You have ${monthlyUsage.remaining_hours.toFixed(2)} hours remaining this month.`;
    }

    return null; // Valid
  };

  const handleSubmit = async () => {
    // Validate
    const error = validateSubmission();
    if (error) {
      Alert.alert('Error', error);
      return;
    }

    try {
      setLoading(true);

      const gatepassData: GatepassApplication = {
        employee: currentEmployee!.name,
        date_of_application: formatDateForAPI(applicationDate),
        gp_start_time: formatTimeForAPI(startTime),
        purpose_of_gp: purpose,
      };

      console.log('Submitting gatepass data:', gatepassData);

      // Create the document
      const createdDoc = await createDoc('Gate Pass Application', gatepassData);
      console.log('Document created:', createdDoc);

      // Submit the document (change docstatus to 1)
      if (createdDoc?.name) {
        console.log('Submitting document:', createdDoc.name);
        await submitDoc('Gate Pass Application', createdDoc.name);
        console.log('Document submitted successfully');
      }

      Alert.alert('Success', 'Your gatepass application has been submitted successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit gatepass application';

      // Only log non-validation errors to avoid cluttering console
      // Validation errors only occur for test_admin (mock validation)
      const isTestAdmin = user?.employee_id === 'EMP-TEST-ADMIN';
      const isValidationError = errorMessage.includes('gatepass already exists');
      if (!(isTestAdmin && isValidationError)) {
        console.error('Error submitting gatepass:', error);
      }

      Alert.alert('Error', 'Failed to submit gatepass application: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getUsageColor = () => {
    if (!monthlyUsage) return COLORS.primary;
    const percentage = (monthlyUsage.total_hours_used / monthlyUsage.monthly_limit) * 100;
    if (percentage >= 90) return '#EF4444'; // Red
    if (percentage >= 70) return '#F59E0B'; // Orange
    return '#10B981'; // Green
  };

  const getUsagePercentage = () => {
    if (!monthlyUsage) return 0;
    return Math.min((monthlyUsage.total_hours_used / monthlyUsage.monthly_limit) * 100, 100);
  };

  const renderPurposeChip = (chipPurpose: 'Personal' | 'Official') => (
    <TouchableOpacity
      key={chipPurpose}
      style={[
        styles.purposeChip,
        purpose === chipPurpose && styles.purposeChipSelected,
      ]}
      onPress={() => setPurpose(chipPurpose)}
    >
      <Text
        style={[
          styles.purposeChipText,
          purpose === chipPurpose && styles.purposeChipTextSelected,
        ]}
      >
        {chipPurpose}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Navbar onProfilePress={() => router.push('/(tabs)/profile')} />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Apply for Gatepass
          </Text>
          <View style={{ width: 24 }} />
        </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* User Info Card */}
          {currentEmployee && (
            <View style={styles.userInfoCard}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.userInfoGradient}
              >
                <Ionicons name="person" size={24} color="#fff" />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{currentEmployee.employee_name}</Text>
                  <Text style={styles.userEmployee}>
                    ECode: {currentEmployee.attendance_device_id || currentEmployee.name || 'N/A'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Monthly Usage Card */}
          {loadingData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading usage data...</Text>
            </View>
          ) : monthlyUsage && (
            <View style={styles.usageCard}>
              <Text style={styles.usageTitle}>Monthly Gatepass Usage</Text>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Used:</Text>
                <Text style={styles.usageValue}>
                  {monthlyUsage.total_hours_used.toFixed(2)} / {monthlyUsage.monthly_limit.toFixed(2)} hours
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Remaining:</Text>
                <Text style={[styles.usageValue, { color: getUsageColor() }]}>
                  {monthlyUsage.remaining_hours.toFixed(2)} hours
                </Text>
              </View>
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${getUsagePercentage()}%`,
                        backgroundColor: getUsageColor(),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Application Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Application Date</Text>
            <View style={styles.dateButtonReadonly}>
              <Ionicons name="calendar" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>{formatDate(applicationDate)}</Text>
            </View>
          </View>

          {/* Start Time Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
          </View>

          {/* End Time Display (Auto-calculated) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Time (Auto-calculated)</Text>
            <View style={styles.dateButtonReadonly}>
              <Ionicons name="time-outline" size={20} color="#9CA3AF" />
              <Text style={[styles.dateButtonText, { color: '#9CA3AF' }]}>
                {formatTime(endTime)}
              </Text>
            </View>
          </View>

          {/* Purpose Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Purpose *</Text>
            <View style={styles.purposeContainer}>
              {renderPurposeChip('Personal')}
              {renderPurposeChip('Official')}
            </View>
          </View>

          {/* Summary Card */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>2.00 hours</Text>
            </View>
            {monthlyUsage && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Will use:</Text>
                <Text style={styles.summaryValue}>
                  {(monthlyUsage.total_hours_used + 2.0).toFixed(2)} / {monthlyUsage.monthly_limit.toFixed(2)} hours
                </Text>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || loadingData}
          >
            <LinearGradient
              colors={loading || loadingData ? ['#9CA3AF', '#9CA3AF'] : [COLORS.primary, COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="default"
            onChange={onStartTimeChange}
          />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: width > 768 ? 20 : 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  userInfoCard: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  userInfoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: width > 768 ? 20 : 18,
    fontWeight: '600',
    color: '#fff',
  },
  userEmployee: {
    fontSize: width > 768 ? 16 : 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  usageCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  usageTitle: {
    fontSize: width > 768 ? 18 : 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageLabel: {
    fontSize: width > 768 ? 16 : 14,
    color: '#666',
  },
  usageValue: {
    fontSize: width > 768 ? 16 : 14,
    fontWeight: '600',
    color: '#333',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  loadingText: {
    marginLeft: 12,
    color: '#666',
    fontSize: width > 768 ? 16 : 14,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: width > 768 ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dateButtonReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  dateButtonText: {
    marginLeft: 12,
    fontSize: width > 768 ? 16 : 14,
    color: '#333',
    fontWeight: '500',
  },
  purposeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  purposeChip: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  purposeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  purposeChipText: {
    fontSize: width > 768 ? 16 : 14,
    color: '#666',
    fontWeight: '600',
  },
  purposeChipTextSelected: {
    color: '#fff',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryTitle: {
    fontSize: width > 768 ? 18 : 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: width > 768 ? 16 : 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: width > 768 ? 16 : 14,
    fontWeight: '600',
    color: '#333',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: width > 768 ? 18 : 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});
