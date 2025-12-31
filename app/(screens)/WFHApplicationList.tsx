import { Navbar } from '@/components';
import { COLORS } from '@/constants';
import { darkTheme, lightTheme } from '@/constants/TabTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useFrappeService } from '@/services/frappeService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Type Definitions
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Open';

interface WFHApplication {
  id: string;
  employee: string;
  employee_name: string;
  wfh_start_date: string;
  wfh_end_date: string;
  purpose_of_wfh: string;
  approval_status: ApprovalStatus;
  date_of_application: string;
  date_of_approval?: string;
  reason_for_rejection?: string;
}

export default function WFHApplicationList() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const frappeService = useFrappeService();
  const { user } = useAuth();

  // State
  const [selectedStatus, setSelectedStatus] = useState<'All' | ApprovalStatus>('All');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // desc = newest first
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination state
  const [wfhApplications, setWfhApplications] = useState<WFHApplication[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [hasReportingEmployees, setHasReportingEmployees] = useState<boolean>(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number>(0);

  const PAGE_SIZE = 20;

  // Fetch WFH applications from API with pagination
  const fetchWFHApplications = useCallback(async (pageNum: number = 0, isRefresh: boolean = false) => {
    try {
      if (pageNum === 0) {
        setIsLoadingApplications(true);
      }
      setApplicationsError(null);

      console.log(`Fetching WFH applications - Page: ${pageNum}, Status: ${selectedStatus}, Sort: ${sortOrder}`);

      // Build filters
      const filters: any[] = [
        ['employee', '=', user?.employee_id]
      ];

      // Add status filter if not 'All'
      if (selectedStatus !== 'All') {
        filters.push(['approval_status', '=', selectedStatus]);
      }

      // Fetch WFH Applications with pagination
      const wfhApps = await frappeService.getList<any>('Work From Home Application', {
        fields: [
          'name',
          'employee',
          'employee_name',
          'wfh_start_date',
          'wfh_end_date',
          'purpose_of_wfh',
          'approval_status',
          'creation',
          'date_of_approval',
          'reason_for_rejection'
        ],
        filters: filters,
        limitPageLength: PAGE_SIZE,
        limitStart: pageNum * PAGE_SIZE,
        orderBy: `creation ${sortOrder}`
      });

      console.log(`Fetched ${wfhApps.length} WFH Applications for page ${pageNum}`);

      // Transform applications
      const transformedApps: WFHApplication[] = wfhApps.map((app: any): WFHApplication => ({
        id: app.name,
        employee: app.employee,
        employee_name: app.employee_name,
        wfh_start_date: app.wfh_start_date,
        wfh_end_date: app.wfh_end_date,
        purpose_of_wfh: app.purpose_of_wfh,
        approval_status: app.approval_status,
        date_of_application: app.creation?.split(' ')[0] || new Date().toISOString().split('T')[0],
        date_of_approval: app.date_of_approval,
        reason_for_rejection: app.reason_for_rejection
      }));

      // Update state
      if (isRefresh || pageNum === 0) {
        setWfhApplications(transformedApps);
      } else {
        setWfhApplications(prev => [...prev, ...transformedApps]);
      }

      // Check if there are more records
      setHasMore(wfhApps.length === PAGE_SIZE);
      setCurrentPage(pageNum);
    } catch (err: any) {
      console.error('Error fetching WFH applications:', err);

      // Provide user-friendly error messages based on error type
      let errorMessage = 'Failed to fetch WFH applications';

      if (err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.message?.toLowerCase().includes('unauthorized') ||
        err.message?.toLowerCase().includes('authentication')) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (err.message?.toLowerCase().includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err.message?.toLowerCase().includes('server')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setApplicationsError(errorMessage);

      // If it's the first load and there's an error, keep empty array
      // If loading more pages fails, show alert and keep existing data
      if (pageNum === 0) {
        setWfhApplications([]);
      } else {
        // Show alert for load more failures
        Alert.alert(
          'Error Loading More',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoadingApplications(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [frappeService, user?.employee_id, selectedStatus, sortOrder, PAGE_SIZE]);

  // Fetch applications on mount and when filters/sort change
  useEffect(() => {
    fetchWFHApplications(0, false);
  }, [selectedStatus, sortOrder]);

  // Fetch pending approval count for team members (role-based access)
  useEffect(() => {
    const fetchPendingApprovalCount = async () => {
      try {
        if (!user?.employee_id) {
          setPendingApprovalCount(0);
          setHasReportingEmployees(false);
          return;
        }

        // Step 1: Check if logged-in user has "WFH Approver" role
        const loggedinEmp = await frappeService.getList<any>('Employee', {
          fields: ['user_id'],
          filters: [
            ['name', '=', user?.employee_id]
          ],
          limitPageLength: 1
        });

        if (loggedinEmp.length === 0 || !loggedinEmp[0].user_id) {
          throw new Error('Employee not found or not linked to user');
        }

        const userData = await frappeService.getDoc<any>('User', loggedinEmp[0].user_id);

        // Check if user has the WFH Approver role
        const hasApproverRole = userData?.roles?.some(
          (roleObj: any) => roleObj.role === 'WFH Approver'
        );

        if (!hasApproverRole) {
          // User does not have WFH Approver role
          setPendingApprovalCount(0);
          setHasReportingEmployees(false);
          return;
        }

        // Step 2: Get the employee's team
        const employeeData = await frappeService.getList<any>('Employee', {
          fields: ['name', 'team'],
          filters: [['user_id', '=', loggedinEmp[0].user_id]],
          limitPageLength: 1
        });

        if (employeeData.length === 0 || !employeeData[0].team) {
          // Employee not found or not assigned to a team
          setPendingApprovalCount(0);
          setHasReportingEmployees(false);
          return;
        }

        const userTeam = employeeData[0].team;

        // Step 3: Get all employees in the same team
        const teamMembers = await frappeService.getList<any>('Employee', {
          fields: ['name'],
          filters: [
            ['team', '=', userTeam],
            ['name', '!=', user.employee_id] // Exclude the logged-in user
          ],
          limitPageLength: 999999 // Get all team members
        });

        if (teamMembers.length === 0) {
          setPendingApprovalCount(0);
          setHasReportingEmployees(false);
          return;
        }

        // User has WFH Approver role and team members exist
        setHasReportingEmployees(true);

        // Extract employee IDs
        const employeeIds = teamMembers.map((emp: any) => emp.name);

        // Step 4: Fetch pending WFH applications for team members
        const pendingApplications = await frappeService.getList<any>('Work From Home Application', {
          fields: ['name'],
          filters: [
            ['employee', 'in', employeeIds],
            ['approval_status', 'in', ['Pending', 'Open']]
          ],
          limitPageLength: 999999 // Get all pending applications
        });

        setPendingApprovalCount(pendingApplications.length);
      } catch (err) {
        console.error('Error fetching pending approval count:', err);
        setPendingApprovalCount(0);
        setHasReportingEmployees(false);
      }
    };

    fetchPendingApprovalCount();
  }, [frappeService, user?.employee_id]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWFHApplications(0, true);
  }, [fetchWFHApplications]);

  // Load more handler - fetch next page from API
  const onLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || isLoadingApplications) return;
    setLoadingMore(true);
    fetchWFHApplications(currentPage + 1, false);
  }, [loadingMore, hasMore, isLoadingApplications, currentPage, fetchWFHApplications]);

  // Get status color
  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'Approved':
        return '#4CAF50';
      case 'Rejected':
        return '#F44336';
      case 'Pending':
      case 'Open':
        return '#FF9800';
      default:
        return theme.colors.textSecondary;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Render WFH application card
  const renderWFHCard = ({ item }: { item: WFHApplication }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      {/* Header with Status */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: '#2196F3' + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: '#2196F3' }]}>
            WFH Application
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.approval_status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.approval_status) }]} />
          <Text style={[styles.statusBadgeText, { color: getStatusColor(item.approval_status) }]}>
            {item.approval_status}
          </Text>
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={[styles.infoText, { color: theme.colors.text, fontWeight: '600' }]}>
          {formatDate(item.wfh_start_date)} - {formatDate(item.wfh_end_date)}
        </Text>
      </View>

      {/* Purpose */}
      <View style={styles.infoRow}>
        <Ionicons name="document-text-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          {item.purpose_of_wfh}
        </Text>
      </View>

      {/* Approval Date */}
      {item.approval_status === 'Approved' && item.date_of_approval && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Approved on {formatDate(item.date_of_approval)}
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

      {/* Application Date */}
      <View style={[styles.footer, { borderTopWidth: 0, paddingTop: 4 }]}>
        <Text style={[styles.footerText, { color: theme.colors.textSecondary, fontSize: 11 }]}>
          Applied on {formatDate(item.date_of_application)}
        </Text>
      </View>
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
              My WFH Applications
            </Text>
          </View>
          {hasReportingEmployees && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/(screens)/wfhApprovalApplicationList')}
            >
              <Ionicons name="document-text-outline" size={30} color={theme.colors.text} />
              {pendingApprovalCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{pendingApprovalCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Add WFH Application Button */}
        <View style={[styles.addButtonContainer, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push('/(screens)/WFHApplication')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add WFH Application</Text>
          </TouchableOpacity>
        </View>

        {/* Filters Section */}
        <View style={[styles.filtersContainer, { backgroundColor: theme.colors.card }]}>
          {/* Status Filter */}
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
                Filter by Status
              </Text>
              <TouchableOpacity
                style={[styles.filterInput, { borderColor: theme.colors.border }]}
                onPress={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                <Text style={[styles.filterInputText, { color: theme.colors.text }]}>
                  {selectedStatus}
                </Text>
                <Ionicons
                  name={showStatusDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {showStatusDropdown && (
                <View style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
                    <TouchableOpacity
                      key={status}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedStatus(status as 'All' | ApprovalStatus);
                        setShowStatusDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>
                        {status}
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
              onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <Ionicons name="swap-vertical" size={16} color={theme.colors.primary} />
              <Text style={[styles.sortButtonText, { color: theme.colors.primary }]}>
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
              {wfhApplications.length} application{wfhApplications.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Applications List */}
        <FlatList
          data={wfhApplications}
          keyExtractor={(item) => item.id}
          renderItem={renderWFHCard}
          contentContainerStyle={styles.listContent}
          scrollEnabled={!showStatusDropdown}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No WFH applications found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                Create your first WFH application using the button above
              </Text>
            </View>
          }
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
        />

        {/* Loading Overlay */}
        {isLoadingApplications && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
              Loading WFH applications...
            </Text>
          </View>
        )}

        {/* Error Message */}
        {applicationsError && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
            <Text style={styles.errorText}>{applicationsError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchWFHApplications(0, false)}
            >
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
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
    maxHeight: 200,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
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
});
