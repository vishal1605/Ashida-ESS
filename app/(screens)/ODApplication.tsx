import { Navbar } from '@/components';
import { COLORS } from '@/constants';
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFrappeService } from '@/services/frappeService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const OD_START_VALUE_OPTIONS = [
  'Full Day',
  'Half Day (First Half)',
  'Half Day (Second Half)',
];

const OD_END_VALUE_OPTIONS = [
  'Full Day',
  'Half Day (First Half)',
  'Half Day (Second Half)',
];

const OD_TYPE_OPTIONS = [
  'Local',
  'Local LT',
  'Local NT',
  'Outdoor',
  'International Outdoor',
];

const OD_TYPE_DESCRIPTIONS: Record<string, string> = {
  'Local': "Local work between '7 AM - 7 PM'",
  'Local LT': "Local work between '5-7 AM - 7-11 PM'",
  'Local NT': "Local work between '11 PM - 5 AM'",
  'Outdoor': "Work at site in wide zone",
  'International Outdoor': "International Site"
};

const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];

export default function ODApplicationScreen() {
  const frappeService = useFrappeService();
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  // Auto-filled fields (disabled)
  const [employee, setEmployee] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [department, setDepartment] = useState('');
  const [attendanceDeviceId, setAttendanceDeviceId] = useState('');
  const [approvalStatus] = useState('Pending'); // Always Pending for new applications

  // User-filled fields
  const [odStartDate, setOdStartDate] = useState<Date>(new Date());
  const [odEndDate, setOdEndDate] = useState<Date>(new Date());
  const [odStartValue, setOdStartValue] = useState('');
  const [odEndValue, setOdEndValue] = useState('');
  const [odType, setOdType] = useState('');
  const [location, setLocation] = useState('');

  // UI State
  const [showStartValueDropdown, setShowStartValueDropdown] = useState(false);
  const [showEndValueDropdown, setShowEndValueDropdown] = useState(false);
  const [showOdTypeDropdown, setShowOdTypeDropdown] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);

  // Fetch employee details on mount
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      try {
        setIsLoadingEmployee(true);

        if (user?.employee_id) {
          const empData = await frappeService.getDoc<any>('Employee', user.employee_id);

          setEmployee(empData.name || user.employee_id);
          setEmployeeName(empData.employee_name || user.employee_name || '');
          setDepartment(empData.department || '');
          setAttendanceDeviceId(empData.attendance_device_id || '');
        }
      } catch (error) {
        console.error('Error fetching employee details:', error);
        // Fallback to user data
        setEmployee(user?.employee_id || '');
        setEmployeeName(user?.employee_name || '');
        setAttendanceDeviceId(user?.device_id || '');
      } finally {
        setIsLoadingEmployee(false);
      }
    };

    fetchEmployeeDetails();
  }, [user, frappeService]);

  // Format date to YYYY-MM-DD for API
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display (e.g., "Dec 10, 2025")
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Validate date is not in the past
  const isValidDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today;
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!odStartValue) {
      Alert.alert('Validation Error', 'Please select OD start value');
      return false;
    }

    if (!odEndValue) {
      Alert.alert('Validation Error', 'Please select OD end value');
      return false;
    }

    if (!odType) {
      Alert.alert('Validation Error', 'Please select OD type');
      return false;
    }

    if (!location.trim()) {
      Alert.alert('Validation Error', 'Please enter location');
      return false;
    }

    // Validate start date is not in past
    if (!isValidDate(odStartDate)) {
      Alert.alert('Validation Error', 'OD start date cannot be in the past');
      return false;
    }

    // Validate end date is not in past
    if (!isValidDate(odEndDate)) {
      Alert.alert('Validation Error', 'OD end date cannot be in the past');
      return false;
    }

    // Validate end date is greater than or equal to start date
    const startDateCopy = new Date(odStartDate);
    startDateCopy.setHours(0, 0, 0, 0);
    const endDateCopy = new Date(odEndDate);
    endDateCopy.setHours(0, 0, 0, 0);

    if (endDateCopy < startDateCopy) {
      Alert.alert('Validation Error', 'OD end date must be greater than or equal to start date');
      return false;
    }

    return true;
  };

  // Handle start date change
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios'); // Keep showing on iOS
    if (selectedDate) {
      setOdStartDate(selectedDate);
      // If end date is before new start date, update it
      if (selectedDate > odEndDate) {
        setOdEndDate(selectedDate);
      }
    }
  };

  // Handle end date change
  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios'); // Keep showing on iOS
    if (selectedDate) {
      setOdEndDate(selectedDate);
    }
  };

  // Parse Frappe error and return user-friendly message
  const parseErrorMessage = (error: any): string => {
    // Log full error for debugging
    console.log('=== ERROR DEBUGGING ===');
    console.log('Error type:', typeof error);
    console.log('Error:', error);
    console.log('Error.message type:', typeof error?.message);
    console.log('Error.message:', error?.message);
    console.log('Is array?', Array.isArray(error?.message));
    console.log('======================');

    // Handle different error formats from Frappe
    try {
      let tracebackStr = null;

      // Case 1: error.message is an array (Frappe traceback format)
      if (error?.message && Array.isArray(error.message)) {
        tracebackStr = error.message[0];
      }
      // Case 2: error.message is a stringified array
      else if (error?.message && typeof error.message === 'string') {
        // Try to parse it as JSON array
        if (error.message.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(error.message);
            if (Array.isArray(parsed) && parsed.length > 0) {
              tracebackStr = parsed[0];
            }
          } catch (e) {
            // Not a valid JSON array, treat as regular string
            console.log('Not a JSON array, treating as string');
          }
        }
      }

      // If we have a traceback string, extract the actual error message
      if (tracebackStr && typeof tracebackStr === 'string') {
        try {
          console.log('Parsing traceback string...');

          // Extract the last line which contains the actual error
          const lines = tracebackStr.split('\n').filter((line: string) => line.trim());
          const lastLine = lines[lines.length - 1];

          console.log('Last line of traceback:', lastLine);

          // Extract message after the exception type (e.g., "ValidationError: Message")
          if (lastLine.includes(':')) {
            const colonIndex = lastLine.indexOf(':');
            const message = lastLine.substring(colonIndex + 1).trim();

            console.log('Extracted message:', message);

            if (message) {
              return message;
            }
          }

          return lastLine;
        } catch (e) {
          console.error('Error parsing traceback string:', e);
        }
      }

      // Check if error has _server_messages
      if (error?._server_messages) {
        try {
          const messages = JSON.parse(error._server_messages);
          if (Array.isArray(messages) && messages.length > 0) {
            const parsed = JSON.parse(messages[0]);
            return parsed.message || 'An error occurred while submitting the application.';
          }
        } catch (e) {
          // If parsing fails, continue to next check
        }
      }

      // Check if error has exc_type (exception messages)
      if (error?.exc_type) {
        return error.exc_type;
      }

      // Check if error has exception message
      if (error?.exception) {
        // Extract readable message from exception
        const exceptionStr = typeof error.exception === 'string' ? error.exception : JSON.stringify(error.exception);

        // Common Frappe error patterns
        if (exceptionStr.includes('Duplicate entry')) {
          return 'A similar application already exists. Please check your pending applications.';
        }
        if (exceptionStr.includes('Mandatory field')) {
          const fieldMatch = exceptionStr.match(/Mandatory field: (.+)/);
          return fieldMatch ? `Required field missing: ${fieldMatch[1]}` : 'Some required fields are missing.';
        }
        if (exceptionStr.includes('does not have permission')) {
          return 'You do not have permission to submit this application. Please contact your administrator.';
        }
        if (exceptionStr.includes('ValidationError')) {
          return 'Validation failed. Please check your input and try again.';
        }

        // Return first line of exception if it's readable
        const firstLine = exceptionStr.split('\n')[0];
        if (firstLine && firstLine.length < 100 && !firstLine.includes('Traceback')) {
          return firstLine;
        }
      }

      // Check for message property as string
      if (error?.message && typeof error.message === 'string') {
        const message = error.message;

        // Filter out technical error messages
        if (message.includes('fetch') || message.includes('Network')) {
          return 'Network error. Please check your internet connection and try again.';
        }
        if (message.includes('timeout')) {
          return 'Request timeout. Please try again.';
        }

        // If it's a reasonably short message without code traces, show it
        if (!message.includes('Error:') && !message.includes('at ') && message.length < 200) {
          return message;
        }

        // As a last resort, show the raw message even if technical
        // Better than showing nothing
        console.log('Showing raw error message as fallback');
        return message;
      }

      // Check if error is a string
      if (typeof error === 'string') {
        return error;
      }

      // Default fallback - shouldn't reach here if we have any error message
      console.log('Reached default fallback - no error message found');
      return 'Failed to submit application. Please try again or contact support.';
    } catch (e) {
      console.error('Error parsing error message:', e);
      // Even in catch, try to show something useful
      if (error?.message) {
        return String(error.message);
      }
      return 'An unexpected error occurred. Please try again.';
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const applicationData = {
        employee: employee,
        employee_name: employeeName,
        department: department,
        attendance_device_id: attendanceDeviceId,
        od_start_date: formatDateForAPI(odStartDate),
        od_end_date: formatDateForAPI(odEndDate),
        od_start_value: odStartValue,
        od_end_value: odEndValue,
        od_type: odType,
        location: location,
        approval_status: approvalStatus,
      };

      console.log('Submitting OD Application:', applicationData);

      // Create the document
      const createdDoc = await frappeService.createDoc('OD Application', applicationData);
      console.log('Document created:', createdDoc);

      // Submit the document (change docstatus to 1)
      if (createdDoc?.name) {
        console.log('Submitting document:', createdDoc.name);
        await frappeService.submitDoc('OD Application', createdDoc.name);
        console.log('Document submitted successfully');
      }

      Alert.alert('Success', 'Outdoor application submitted successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);

      // Reset form
      setOdStartDate(new Date());
      setOdEndDate(new Date());
      setOdStartValue('');
      setOdEndValue('');
      setOdType('');
      setLocation('');
    } catch (error: any) {
      console.error('Error submitting OD application:', error);

      const errorMessage = parseErrorMessage(error);
      Alert.alert('Submission Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowStartValueDropdown(false);
    setShowEndValueDropdown(false);
    setShowOdTypeDropdown(false);
  };

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
            Apply for Outdoor Application
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {isLoadingEmployee ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading employee details...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!showStartValueDropdown && !showEndValueDropdown && !showOdTypeDropdown}
          >
            {/* User Info Card */}
            {employeeName && attendanceDeviceId && (
              <View style={styles.userInfoCard}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.userInfoGradient}
                >
                  <Ionicons name="person" size={24} color="#fff" />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{employeeName}</Text>
                    <Text style={styles.userEmployee}>ID: {attendanceDeviceId}</Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* OD Start Date */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                OD Start Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowStartDatePicker(true);
                  closeAllDropdowns();
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                  {formatDateForDisplay(odStartDate)}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                Tap to select date (Today or future date only)
              </Text>
              {showStartDatePicker && (
                <DateTimePicker
                  value={odStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartDateChange}
                  minimumDate={getMinDate()}
                />
              )}
            </View>

            {/* OD End Date */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                OD End Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowEndDatePicker(true);
                  closeAllDropdowns();
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                  {formatDateForDisplay(odEndDate)}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                Tap to select date (Must be ≥ start date)
              </Text>
              {showEndDatePicker && (
                <DateTimePicker
                  value={odEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndDateChange}
                  minimumDate={odStartDate}
                />
              )}
            </View>

            {/* OD Start Value (Dropdown) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                OD Start Value <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowStartValueDropdown(!showStartValueDropdown);
                  setShowEndValueDropdown(false);
                  setShowOdTypeDropdown(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: odStartValue ? theme.colors.text : theme.colors.textSecondary }]}>
                  {odStartValue || 'Select start value'}
                </Text>
                <Ionicons
                  name={showStartValueDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {showStartValueDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {OD_START_VALUE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.dropdownItem, { borderBottomColor: theme.colors.border }]}
                      onPress={() => {
                        setOdStartValue(option);
                        setShowStartValueDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                        {option}
                      </Text>
                      {odStartValue === option && (
                        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* OD End Value (Dropdown) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                OD End Value <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowEndValueDropdown(!showEndValueDropdown);
                  setShowStartValueDropdown(false);
                  setShowOdTypeDropdown(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: odEndValue ? theme.colors.text : theme.colors.textSecondary }]}>
                  {odEndValue || 'Select end value'}
                </Text>
                <Ionicons
                  name={showEndValueDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {showEndValueDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {OD_END_VALUE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.dropdownItem, { borderBottomColor: theme.colors.border }]}
                      onPress={() => {
                        setOdEndValue(option);
                        setShowEndValueDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                        {option}
                      </Text>
                      {odEndValue === option && (
                        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* OD Type (Dropdown) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                OD Type <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowOdTypeDropdown(!showOdTypeDropdown);
                  setShowStartValueDropdown(false);
                  setShowEndValueDropdown(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: odType ? theme.colors.text : theme.colors.textSecondary }]}>
                  {odType || 'Select OD type'}
                </Text>
                <Ionicons
                  name={showOdTypeDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {showOdTypeDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {OD_TYPE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.dropdownItem, { borderBottomColor: theme.colors.border }]}
                      onPress={() => {
                        setOdType(option);
                        setShowOdTypeDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                        {option}
                      </Text>
                      {odType === option && (
                        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {odType && (
                <Text style={[styles.hint, { color: theme.colors.primary, marginTop: 8, fontWeight: '600' }]}>
                  {OD_TYPE_DESCRIPTIONS[odType]}
                </Text>
              )}
            </View>

            {/* Location (Text Input) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Location <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Enter location"
                placeholderTextColor={theme.colors.textSecondary}
                value={location}
                onChangeText={setLocation}
                onFocus={closeAllDropdowns}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: COLORS.primary }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.6,
  },
  disabledText: {
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    flex: 1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
