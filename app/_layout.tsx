import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function RootLayoutNav() {
  const { isAuthenticated, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    // Check password reset FIRST (before authentication check)
    if (user?.require_password_reset) {
      if (segments[1] !== "ResetPasswordScreen") {
        console.log('📍 Navigating to ResetPasswordScreen - password reset required');
        router.replace("/(auth)/ResetPasswordScreen");
      }
    } else if (!isAuthenticated) {
      if (!inAuthGroup) {
        console.log('📍 Navigating to LoginScreen - not authenticated');
        router.replace("/(auth)/LoginScreen");
      }
    } else {
      if (!inTabsGroup) {
        console.log('📍 Navigating to tabs - authenticated');
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
