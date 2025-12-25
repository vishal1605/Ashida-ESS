import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";

const { height } = Dimensions.get("window");

const LoginScreen = () => {
  const { login, siteUrl, setupSiteUrl } = useAuth();
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [appId, setAppId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Input validation helper
  const validateInputs = (): { isValid: boolean; error?: string } => {
    // Validate workspace URL
    if (!siteUrl && !workspaceUrl.trim()) {
      return { isValid: false, error: "Please enter your Workspace URL." };
    }

    // Validate workspace URL format
    if (!siteUrl && workspaceUrl.trim()) {
      const urlPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      const cleanUrl = workspaceUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!urlPattern.test(cleanUrl)) {
        return { isValid: false, error: "Please enter a valid Workspace URL format (e.g., your-site.frappe.cloud)." };
      }
    }

    // Validate App ID
    if (!appId.trim()) {
      return { isValid: false, error: "Please enter your App ID." };
    }

    const trimmedAppId = appId.trim();

    // Check App ID length
    if (trimmedAppId.length < 3 || trimmedAppId.length > 50) {
      return { isValid: false, error: "App ID must be between 3 and 50 characters." };
    }

    // Check for suspicious characters (prevent injection)
    const appIdPattern = /^[a-zA-Z0-9@._-]+$/;
    if (!appIdPattern.test(trimmedAppId)) {
      return { isValid: false, error: "App ID contains invalid characters. Only letters, numbers, @, ., _, and - are allowed." };
    }

    // Validate password
    if (!password.trim()) {
      return { isValid: false, error: "Please enter your App Password." };
    }

    const trimmedPassword = password.trim();

    // Check password length
    if (trimmedPassword.length < 8 || trimmedPassword.length > 100) {
      return { isValid: false, error: "Password must be between 8 and 100 characters." };
    }

    return { isValid: true };
  };

  const handleLogin = async () => {
    // Validate inputs
    const validation = validateInputs();
    if (!validation.isValid) {
      Alert.alert("Validation Error", validation.error || "Invalid input.");
      return;
    }

    // Sanitize inputs by trimming
    const sanitizedAppId = appId.trim();
    const sanitizedPassword = password.trim();
    const sanitizedWorkspaceUrl = workspaceUrl.trim();

    try {
      setIsLoading(true);

      let urlToUse = siteUrl;

      // ========================================================================
      // SKIP URL VALIDATION FOR TEST ADMIN
      // ========================================================================
      if (!siteUrl) {
        // Check if this is test_admin login - skip URL validation
        if (sanitizedAppId === 'test_admin' && sanitizedPassword === 'Test@@Admin#25') {
          console.log('🔧 test_admin detected - skipping URL validation');
          // Just use the provided URL directly for test_admin
          urlToUse = sanitizedWorkspaceUrl ? `https://${sanitizedWorkspaceUrl.replace(/^https?:\/\//, '')}` : 'https://dummy.sample.com';
        } else {
          // For normal users, validate the URL
          const setupResult = await setupSiteUrl(sanitizedWorkspaceUrl);
          if (!setupResult.success) {
            Alert.alert("Connection Failed", setupResult.error || "Unable to connect to workspace");
            setIsLoading(false);
            return;
          }
          urlToUse = setupResult.url || null;
        }
      }
      // ========================================================================
      // END TEST ADMIN URL HANDLING
      // ========================================================================

      const result = await login(sanitizedAppId, sanitizedPassword, urlToUse || undefined);

      if (!result.success) {
        Alert.alert(
          "Login Failed",
          result.error || "Please check your credentials"
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      <LinearGradient
        colors={["#667eea", "#764ba2", "#f093fb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />

      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.loginContainer}>
                <View style={styles.brandContainer}>
                  <View style={styles.logoContainer}>
                    <Ionicons name="business" size={52} color="#667eea" />
                  </View>
                </View>

                {siteUrl && (
                  <View style={styles.siteInfo}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <View style={styles.siteInfoText}>
                      <Text style={styles.siteLabel}>Connected to</Text>
                      <Text style={styles.siteUrl}>
                        {siteUrl.replace("https://", "").replace("http://", "")}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.formContainer}>
                  {!siteUrl && (
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Workspace URL</Text>
                      <View
                        style={[
                          styles.inputContainer,
                          workspaceUrl.length > 0 && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons
                          name="link-outline"
                          size={20}
                          color="#9CA3AF"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          placeholder="your-site.frappe.cloud"
                          value={workspaceUrl}
                          onChangeText={setWorkspaceUrl}
                          style={styles.input}
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          autoComplete="off"
                          textContentType="none"
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>App ID</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        appId.length > 0 && styles.inputContainerFocused,
                      ]}
                    >
                      <Ionicons
                        name="card-outline"
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Enter your App ID"
                        value={appId}
                        onChangeText={setAppId}
                        style={styles.input}
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        textContentType="username"
                      />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>App Password</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        password.length > 0 && styles.inputContainerFocused,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Enter your app password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        style={[styles.input, styles.passwordInput]}
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showPassword ? "eye-outline" : "eye-off-outline"}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      isLoading && styles.loginButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={
                        isLoading ? ["#9CA3AF", "#9CA3AF"] : ["#667eea", "#764ba2"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.loginButtonGradient}
                    >
                      {isLoading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                          <Text style={styles.buttonText}>Signing in...</Text>
                        </View>
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.buttonText}>Sign In</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
  },
  circle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    top: -50,
    right: -50,
  },
  circle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    bottom: 100,
    left: -75,
  },
  circle3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    top: height * 0.3,
    right: 20,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  loginContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 15,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F8F7FF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  siteInfo: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
  },
  siteInfoText: {
    marginLeft: 10,
    flex: 1,
  },
  siteLabel: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  siteUrl: {
    fontSize: 15,
    color: "#065F46",
    fontWeight: "700",
    marginTop: 2,
  },
  formContainer: {
    marginTop: 4,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    minHeight: 54,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: "#667eea",
    backgroundColor: "#FFFFFF",
    shadowColor: "#667eea",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    padding: 6,
  },
  loginButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 24,
    shadowColor: "#667eea",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 56,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default LoginScreen;
