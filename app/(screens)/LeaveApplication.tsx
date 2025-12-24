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
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const LEAVE_VALUE_OPTIONS = ['Full Day', 'Half Day'];

interface Employee {
  name: string;
  employee_name: string;
  user_id: string;
  attendance_device_id?: string;
  designation?: string;
  department?: string;
  company?: string;
}

interface LeaveType {
  name: string;
  leave_type_name?: string;
  max_leaves_allowed?: number;
  is_earned_leave?: number;
  available_leaves?: number;
}

interface LeaveApplication {
  employee: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  posting_date: string;
  description: string;
  half_day: number;
  status: string;
  company?: string;
  custom_from_date_leave_value?: string;
  custom_till_date_leave_value?: string;
}

export default function LeaveApplication() {
  const { user } = useAuth();
  const router = useRouter();
  const { getList, createDoc, call } = useFrappeService();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  // State management
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);
  const [fromDateLeaveValue, setFromDateLeaveValue] = useState<'Full Day' | 'Half Day'>('Full Day');
  const [tillDateLeaveValue, setTillDateLeaveValue] = useState<'Full Day' | 'Half Day'>('Full Day');
  const [halfDay, setHalfDay] = useState(false);
  const [showFromDateLeaveValueDropdown, setShowFromDateLeaveValueDropdown] = useState(false);
  const [showTillDateLeaveValueDropdown, setShowTillDateLeaveValueDropdown] = useState(false);

  // Load employee and leave types on component mount
  useEffect(() => {
    fetchEmployeeAndLeaveTypes();
  }, []);

  const fetchEmployeeAndLeaveTypes = async () => {
    try {
      // First, get current employee
      const employees = await getList<Employee>('Employee', {
        fields: ['name', 'employee_name', 'user_id', 'attendance_device_id', 'designation', 'department', 'company'],
        filters: { user_id: user?.email },
        limitPageLength: 1,
      });

      if (employees && employees.length > 0) {
        setCurrentEmployee(employees[0]);

        const currentDate = new Date().toISOString().split('T')[0];

        // Call backend method to get leave types with balances
        // This uses the whitelisted ashida.ashida_gaxis.api.mobile_auth.get_leave_type method
        // which internally calls get_leave_balance_on without requiring direct field access
        const response = await call<any>('ashida.ashida_gaxis.api.mobile_auth.get_leave_type', {
          from_date: currentDate,
          to_date: currentDate,
        });

        console.log('Leave types response:', response);

        // The backend returns: (200, "Leave type get successfully", leave_types)
        // Frappe wraps this in different ways, so we need to handle both cases
        let leaveTypesData = [];

        if (Array.isArray(response)) {
          // If response is array: [200, "message", data]
          leaveTypesData = response[2] || [];
        } else if (response && Array.isArray(response.message)) {
          // If response is wrapped: {message: data}
          leaveTypesData = response.message;
        } else if (response && response.data && Array.isArray(response.data)) {
          // If response has data field
          leaveTypesData = response.data;
        }

        if (leaveTypesData && leaveTypesData.length > 0) {
          // Map backend response to LeaveType interface
          const leaveTypesWithBalance: LeaveType[] = leaveTypesData.map((lt: any) => ({
            name: lt.name,
            leave_type_name: lt.name,
            available_leaves: parseFloat(lt.balance) || 0,
          }));

          // Filter out leave types with 0 balance or keep all based on requirements
          const filteredLeaveTypes = leaveTypesWithBalance.filter(
            lt => (lt.available_leaves ?? 0) > 0 || lt.name === 'Leave Without Pay'
          );

          if (filteredLeaveTypes.length > 0) {
            setLeaveTypes(filteredLeaveTypes);
            setSelectedLeaveType(filteredLeaveTypes[0].name);
          } else {
            // No leave types with balance, show Leave Without Pay
            const defaultLeaveTypes: LeaveType[] = [
              { name: 'Leave Without Pay', leave_type_name: 'Leave Without Pay' },
            ];
            setLeaveTypes(defaultLeaveTypes);
            setSelectedLeaveType(defaultLeaveTypes[0].name);
          }
        } else {
          // No leave types found, show only Leave Without Pay
          const defaultLeaveTypes: LeaveType[] = [
            { name: 'Leave Without Pay', leave_type_name: 'Leave Without Pay' },
          ];
          setLeaveTypes(defaultLeaveTypes);
          setSelectedLeaveType(defaultLeaveTypes[0].name);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // On error, show only Leave Without Pay
      const defaultLeaveTypes: LeaveType[] = [
        { name: 'Leave Without Pay', leave_type_name: 'Leave Without Pay' },
      ];
      setLeaveTypes(defaultLeaveTypes);
      setSelectedLeaveType(defaultLeaveTypes[0].name);
    } finally {
      setLoadingLeaveTypes(false);
    }
  };

  const calculateLeaveDays = (): number => {
    const timeDifference = toDate.getTime() - fromDate.getTime();
    const dayDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
    return Math.max(dayDifference, 1);
  };

  const handleSubmitLeave = async () => {
    // Validation
    if (!currentEmployee) {
      Alert.alert('Error', 'Employee information not found');
      return;
    }

    if (!selectedLeaveType) {
      Alert.alert('Error', 'Please select a leave type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description for leave');
      return;
    }

    if (fromDate > toDate) {
      Alert.alert('Error', 'From date cannot be after to date');
      return;
    }

    try {
      setLoading(true);

      const leaveData: LeaveApplication = {
        employee: currentEmployee.name,
        leave_type: selectedLeaveType,
        from_date: fromDate.toISOString().split('T')[0],
        to_date: toDate.toISOString().split('T')[0],
        posting_date: new Date().toISOString().split('T')[0],
        description: description.trim(),
        half_day: halfDay ? 1 : 0,
        status: 'Open',
        company: currentEmployee.company,
        custom_from_date_leave_value: fromDateLeaveValue,
        custom_till_date_leave_value: tillDateLeaveValue,
      };

      console.log('Submitting leave data:', leaveData);

      const result = await createDoc('Leave Application', leaveData);

      console.log('Leave application result:', result);

      Alert.alert('Success', 'Your leave application has been submitted successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit leave application';

      // Only log non-validation errors to avoid cluttering console
      // Validation errors only occur for test_admin (mock validation)
      const isTestAdmin = user?.employee_id === 'EMP-TEST-ADMIN';
      const isValidationError = errorMessage.includes('overlaps with an existing');
      if (!(isTestAdmin && isValidationError)) {
        console.error('Error submitting leave:', error);
      }

      Alert.alert('Error', 'Failed to submit leave application: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const onFromDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowFromDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFromDate(selectedDate);
      // Auto-adjust to date if it's before from date
      if (selectedDate > toDate) {
        setToDate(selectedDate);
      }
    }
  };

  const onToDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowToDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  const closeAllDropdowns = () => {
    setShowFromDateLeaveValueDropdown(false);
    setShowTillDateLeaveValueDropdown(false);
  };

  const renderLeaveTypeChip = (leaveType: LeaveType) => (
    <TouchableOpacity
      key={leaveType.name}
      style={[
        styles.leaveTypeChip,
        selectedLeaveType === leaveType.name && styles.leaveTypeChipSelected,
      ]}
      onPress={() => {
        setSelectedLeaveType(leaveType.name);
        closeAllDropdowns();
      }}
    >
      <View>
        <Text
          style={[
            styles.leaveTypeChipText,
            selectedLeaveType === leaveType.name && styles.leaveTypeChipTextSelected,
          ]}
        >
          {leaveType.leave_type_name || leaveType.name}
        </Text>
        {leaveType.available_leaves !== undefined && (
          <Text
            style={[
              styles.availableLeavesText,
              selectedLeaveType === leaveType.name && styles.availableLeavesTextSelected,
            ]}
          >
            Available: {leaveType.available_leaves}
          </Text>
        )}
      </View>
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
            Apply for Leave
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingLeaveTypes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading leave types...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!showFromDateLeaveValueDropdown && !showTillDateLeaveValueDropdown}
          >
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
                  {currentEmployee.attendance_device_id && (
                    <Text style={styles.userEmployee}>
                      ECode: {currentEmployee.attendance_device_id}
                    </Text>
                  )}
                </View>
              </LinearGradient>
              {/* Additional Employee Details */}
              {/* {(currentEmployee.designation || currentEmployee.department) && (
                <View style={styles.employeeDetails}>
                  {currentEmployee.designation && (
                    <View style={styles.detailRow}>
                      <Ionicons name="briefcase-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Designation:</Text>
                      <Text style={styles.detailValue}>{currentEmployee.designation}</Text>
                    </View>
                  )}
                  {currentEmployee.department && (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Department:</Text>
                      <Text style={styles.detailValue}>{currentEmployee.department}</Text>
                    </View>
                  )}
                </View>
              )} */}
            </View>
          )}

          {/* Leave Type Selection */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Leave Type <Text style={styles.required}>*</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.leaveTypeScroll}
              contentContainerStyle={styles.leaveTypeScrollContent}
            >
              {leaveTypes.map(renderLeaveTypeChip)}
            </ScrollView>
          </View>

          {/* From Date */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              From Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.datePickerButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => {
                setShowFromDatePicker(true);
                closeAllDropdowns();
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                {formatDate(fromDate)}
              </Text>
            </TouchableOpacity>
            {showFromDatePicker && (
              <DateTimePicker
                value={fromDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onFromDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* From Date Leave Value (Dropdown) */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              From Date Leave Value <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => {
                setShowFromDateLeaveValueDropdown(!showFromDateLeaveValueDropdown);
                setShowTillDateLeaveValueDropdown(false);
              }}
            >
              <Text style={[styles.dropdownText, { color: fromDateLeaveValue ? theme.colors.text : theme.colors.textSecondary }]}>
                {fromDateLeaveValue || 'Select leave value'}
              </Text>
              <Ionicons
                name={showFromDateLeaveValueDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            {showFromDateLeaveValueDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {LEAVE_VALUE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.dropdownItem, { borderBottomColor: theme.colors.border }]}
                    onPress={() => {
                      setFromDateLeaveValue(option as 'Full Day' | 'Half Day');
                      setShowFromDateLeaveValueDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                      {option}
                    </Text>
                    {fromDateLeaveValue === option && (
                      <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* To Date */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              To Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.datePickerButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => {
                setShowToDatePicker(true);
                closeAllDropdowns();
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                {formatDate(toDate)}
              </Text>
            </TouchableOpacity>
            {showToDatePicker && (
              <DateTimePicker
                value={toDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onToDateChange}
                minimumDate={fromDate}
              />
            )}
          </View>

          {/* Till Date Leave Value (Dropdown) */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Till Date Leave Value <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => {
                setShowTillDateLeaveValueDropdown(!showTillDateLeaveValueDropdown);
                setShowFromDateLeaveValueDropdown(false);
              }}
            >
              <Text style={[styles.dropdownText, { color: tillDateLeaveValue ? theme.colors.text : theme.colors.textSecondary }]}>
                {tillDateLeaveValue || 'Select leave value'}
              </Text>
              <Ionicons
                name={showTillDateLeaveValueDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
            {showTillDateLeaveValueDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {LEAVE_VALUE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.dropdownItem, { borderBottomColor: theme.colors.border }]}
                    onPress={() => {
                      setTillDateLeaveValue(option as 'Full Day' | 'Half Day');
                      setShowTillDateLeaveValueDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                      {option}
                    </Text>
                    {tillDateLeaveValue === option && (
                      <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Half Day Checkbox */}
          {/* <View style={styles.fieldContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                setHalfDay(!halfDay);
                closeAllDropdowns();
              }}
            >
              <View style={[styles.checkbox, halfDay && styles.checkboxChecked, { borderColor: theme.colors.border }]}>
                {halfDay && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>Half Day</Text>
            </TouchableOpacity>
          </View> */}

          {/* Description Input */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Remark <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.reasonInput, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Please provide a description for your leave request..."
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={closeAllDropdowns}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: COLORS.primary }]}
            onPress={handleSubmitLeave}
            disabled={loading}
          >
            {loading ? (
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
  employeeDetails: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: width > 768 ? 15 : 13,
    color: '#666',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: width > 768 ? 15 : 13,
    color: '#333',
    flex: 1,
  },
  reasonInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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
    maxHeight: 200,
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
  leaveTypeScroll: {
    marginBottom: 8,
  },
  leaveTypeScrollContent: {
    paddingRight: 20,
  },
  leaveTypeChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
  leaveTypeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  leaveTypeChipText: {
    fontSize: width > 768 ? 16 : 14,
    color: '#666',
    fontWeight: '600',
  },
  leaveTypeChipTextSelected: {
    color: '#fff',
  },
  availableLeavesText: {
    fontSize: width > 768 ? 12 : 11,
    color: '#999',
    marginTop: 4,
    fontWeight: '500',
  },
  availableLeavesTextSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
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
