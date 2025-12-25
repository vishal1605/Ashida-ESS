import React from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants';
import { getUserInitials, getGreeting } from '@/utils';

interface NavbarProps {
  onProfilePress?: () => void;
}

const { width } = Dimensions.get('window');

const Navbar: React.FC<NavbarProps> = ({ onProfilePress }) => {
  const { user } = useAuth();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      Alert.alert('Profile', `User: ${user?.employee_name || 'Unknown'}`);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.primary, COLORS.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.navbar}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.navbarContent}>
          {/* Left Side - Brand and Greeting */}
          <View style={styles.leftSection}>
            <View style={styles.brandContainer}>
              <Text style={styles.brandName}>
                {user?.employee_id === 'EMP-TEST-ADMIN' ? 'Demo' : 'Ashida'}
              </Text>
            </View>
            <Text style={styles.greetingText}>
              {getGreeting()}, {user?.employee_name || 'User'}
            </Text>
          </View>

          {/* Right Side - Profile Avatar */}
          <TouchableOpacity
            style={styles.profileSection}
            onPress={handleProfilePress}
            activeOpacity={0.8}
          >
            <View style={styles.profileAvatarContainer}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileAvatar}
              >
                <Text style={styles.avatarText}>
                  {getUserInitials(user?.employee_name)}
                </Text>
              </LinearGradient>
              <View style={styles.statusIndicator} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  navbar: {
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  navbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    paddingTop: 8,
  },
  leftSection: {
    flex: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandName: {
    fontSize: width > 768 ? 28 : width > 400 ? 26 : 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  greetingText: {
    fontSize: width > 768 ? 16 : width > 400 ? 15 : 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  profileSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarContainer: {
    position: 'relative',
  },
  profileAvatar: {
    width: width > 768 ? 50 : 46,
    height: width > 768 ? 50 : 46,
    borderRadius: width > 768 ? 25 : 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: width > 768 ? 18 : 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: width > 768 ? 14 : 12,
    height: width > 768 ? 14 : 12,
    borderRadius: width > 768 ? 7 : 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default Navbar;
