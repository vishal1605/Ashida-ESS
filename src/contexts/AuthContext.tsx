import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { User } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  siteUrl: string | null;
  login: (appId: string, appPassword: string, urlOverride?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setupSiteUrl: (url: string) => Promise<{ success: boolean; error?: string; url?: string }>;
  resetSiteUrl: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const SECURE_STORE_KEYS = {
  SITE_URL: 'site_url',
  USER_DATA: 'user_data',
  API_KEY: 'api_key',
  API_SECRET: 'api_secret',
  DEVICE_ID_PREFIX: 'device_id_',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  const generateDeviceId = async (appId: string): Promise<string> => {
    try {
      const storageKey = `${SECURE_STORE_KEYS.DEVICE_ID_PREFIX}${appId}`;
      const storedDeviceId = await SecureStore.getItemAsync(storageKey);

      if (storedDeviceId) {
        console.log(`📱 Retrieved existing device ID for ${appId} from storage`);
        return storedDeviceId;
      }

      // Generate a unique device ID based on device characteristics
      // Put appId FIRST to ensure it's included in the final device ID
      const deviceFingerprint = [
        appId || 'unknown',
        Device.modelName || 'unknown',
        Device.brand || 'unknown',
        Device.osVersion || 'unknown',
        Device.deviceName || 'unknown',
        Constants.sessionId || Date.now().toString(),
      ].join('-');

      console.log('Device fingerprint:', deviceFingerprint);

      // Create a hash-like ID (simplified base64 encoding)
      let deviceId: string;
      try {
        deviceId = btoa(deviceFingerprint)
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 40);
      } catch (e) {
        // Fallback if btoa fails
        deviceId = deviceFingerprint
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 40);
      }

      // Store it securely for future use
      await SecureStore.setItemAsync(storageKey, deviceId);
      console.log(`📱 Generated new device ID for ${appId} using device fingerprint`);

      return deviceId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      const fallbackId = Constants.sessionId?.substring(0, 32) || `fallback-${Date.now()}`;
      console.warn('Using fallback device ID');
      return fallbackId;
    }
  };

  const validateAndFormatUrl = (url: string): string => {
    let formattedUrl = url.trim();

    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    formattedUrl = formattedUrl.replace(/\/+$/, '');

    return formattedUrl;
  };

  const setupSiteUrl = async (url: string): Promise<{ success: boolean; error?: string; url?: string }> => {
    try {
      const formattedUrl = validateAndFormatUrl(url);

      console.log('Testing connection to:', formattedUrl);

      // Test connection to the Frappe site
      const response = await fetch(
        `${formattedUrl}/api/method/frappe.auth.get_logged_user`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      if (response.status === 403 || response.status === 200) {
        // 403 means site exists but we're not authenticated (expected)
        // 200 means site exists and might have cached credentials
        await SecureStore.setItemAsync(SECURE_STORE_KEYS.SITE_URL, formattedUrl);
        setSiteUrl(formattedUrl);

        console.log('Site URL configured successfully:', formattedUrl);
        return { success: true, url: formattedUrl };
      } else {
        throw new Error('Unable to connect to Frappe site');
      }
    } catch (error) {
      console.error('Site setup failed:', error);

      let errorMessage = 'Unable to connect to the site. Please check the URL and try again.';

      if (error instanceof Error) {
        if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Invalid URL format or site not reachable.';
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const resetSiteUrl = async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SITE_URL);
      await clearAuthData();
      setSiteUrl(null);
      console.log('Site URL reset successfully');
    } catch (error) {
      console.error('Failed to reset site URL:', error);
    }
  };

  const login = async (
    appId: string,
    appPassword: string,
    urlOverride?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const targetUrl = urlOverride || siteUrl;

      if (!targetUrl) {
        return { success: false, error: 'Site URL not configured' };
      }

      const deviceId = await generateDeviceId(appId);
      const deviceModel = Device.modelName || 'unknown';
      const deviceBrand = Device.brand || 'unknown';

      console.log('Attempting mobile app login at:', targetUrl);
      console.log('App ID:', appId);
      console.log('Device ID:', deviceId);
      console.log('Device Info:', {
        model: deviceModel,
        brand: deviceBrand,
      });

      const response = await fetch(
        `${targetUrl}/api/method/ashida.ashida_gaxis.api.mobile_auth.mobile_app_login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usr: appId,
            app_password: appPassword,
            device_id: deviceId,
            device_model: deviceModel,
            device_brand: deviceBrand,
          }),
        }
      );

      console.log('Response status:', response.status);

      const loginData = await response.json();
      console.log('Login response:', JSON.stringify(loginData, null, 2));

      // Backend returns { message: { success: true/false, data: {...} } }
      if (response.ok && loginData.message) {
        const result = loginData.message;

        if (result.success && result.data) {
          const { employee_id, employee_name, user, api_key, api_secret, device_id, app_id, require_password_reset } = result.data;

          console.log('✅ Login successful!');
          console.log('📱 Device registered/verified:', deviceModel, deviceBrand);
          console.log('👤 Employee:', employee_name, `(${employee_id})`);
          console.log('🔐 Require password reset:', require_password_reset);

          const userObject: User = {
            employee_id,
            employee_name,
            email: user,
            api_key,
            api_secret,
            device_id,
            app_id,
            require_password_reset: require_password_reset === 1,
          };

          await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_DATA, JSON.stringify(userObject));
          await SecureStore.setItemAsync(SECURE_STORE_KEYS.API_KEY, api_key);
          await SecureStore.setItemAsync(SECURE_STORE_KEYS.API_SECRET, api_secret);

          setUser(userObject);

          // Only set authenticated if password reset is NOT required
          if (require_password_reset !== 1) {
            setIsAuthenticated(true);
          }

          console.log('Login successful with API credentials');
        } else {
          // Backend returned success: false with a message
          const errorMessage = result.message || 'Login failed';
          console.error('Login failed with error:', errorMessage);
          throw new Error(errorMessage);
        }
      } else {
        throw new Error(loginData.exc || loginData.message || 'Invalid credentials');
      }

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);

      let errorMessage = 'Login failed. Please check your credentials.';

      // Handle specific error messages from backend
      if (error instanceof Error) {
        if (error.message.includes('Invalid App ID')) {
          errorMessage = 'Invalid App ID. Please check your credentials.';
        } else if (error.message.includes('Employee Self Service is not enabled')) {
          errorMessage = error.message;
        } else if (error.message.includes('App password not set')) {
          errorMessage = 'App password not set. Please contact your administrator.';
        } else if (error.message.includes('Invalid app password')) {
          errorMessage = 'Invalid app password. Please try again.';
        } else if (error.message.includes('Access denied. This account is registered to a different device')) {
          console.log('🚫 Device mismatch - login blocked');
          errorMessage = 'This account is registered to a different device. Please contact HR to reset device access.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('Site URL not configured')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async (): Promise<void> => {
    await clearAuthData();
    console.log('Logout completed');
  };

  const resetPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user || !siteUrl) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(
        `${siteUrl}/api/method/ashida.ashida_gaxis.api.mobile_auth.reset_app_password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ${user.api_key}:${user.api_secret}`,
          },
          body: JSON.stringify({
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      // Backend returns { message: { success: true/false, message: "..." } }
      if (response.ok && data.message && data.message.success) {
        console.log('✅ Password reset successful');
      } else {
        throw new Error(data.message?.message || 'Password reset failed');
      }

      const updatedUser = { ...user, require_password_reset: false };
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsAuthenticated(true);

      console.log('✅ Password reset successful - user is now authenticated');
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed',
      };
    }
  };

  const restoreSession = async () => {
    try {
      setLoading(true);

      const storedUrl = await SecureStore.getItemAsync(SECURE_STORE_KEYS.SITE_URL);
      const storedUserData = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_DATA);
      const storedApiKey = await SecureStore.getItemAsync(SECURE_STORE_KEYS.API_KEY);
      const storedApiSecret = await SecureStore.getItemAsync(SECURE_STORE_KEYS.API_SECRET);

      if (storedUrl) {
        setSiteUrl(storedUrl);
        console.log('Site URL found:', storedUrl);
      } else {
        console.log('No saved URL - user will enter on LoginScreen');
        setLoading(false);
        return;
      }

      if (storedUserData && storedApiKey && storedApiSecret) {
        const userData = JSON.parse(storedUserData);

        // Verify API credentials are still valid
        try {
          const authToken = `token ${storedApiKey}:${storedApiSecret}`;

          const response = await fetch(
            `${storedUrl}/api/method/frappe.auth.get_logged_user`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authToken,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.message) {
              // Credentials are still valid
              setUser(userData);

              // Only set authenticated if password reset is NOT required
              if (!userData.require_password_reset) {
                setIsAuthenticated(true);
                console.log('Session restored successfully with API credentials');
              } else {
                console.log('Session restored but password reset required');
              }
            } else {
              await clearAuthData();
            }
          } else {
            // Invalid credentials
            console.log('Stored credentials are invalid, clearing...');
            await clearAuthData();
          }
        } catch (error) {
          console.log('Session verification failed:', error);
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Session restore error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_DATA);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.API_KEY);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.API_SECRET);
    } catch (error) {
      console.error('Failed to clear stored data:', error);
    }

    setIsAuthenticated(false);
    setUser(null);
  };

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        siteUrl,
        login,
        logout,
        resetPassword,
        setupSiteUrl,
        resetSiteUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
