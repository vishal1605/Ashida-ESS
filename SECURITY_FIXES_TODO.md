# Security Fixes & Improvements TODO

**Project:** Ashida ESS Mobile App
**Date Created:** 2025-12-06
**Status:** Pending Implementation

---

## 🔴 CRITICAL PRIORITY (Must Fix Before Production)

### 1. Backend: Hash Passwords Instead of Plain Text Storage

**Issue:** Passwords are currently stored and compared in plain text
**Location:** `backend/backend_mobile_auth.py:57-68`
**Risk Level:** 🔴 CRITICAL
**Impact:** Complete password compromise if database is breached

**Current Code:**
```python
stored_password = employee_doc.get_password("app_password")
if stored_password != app_password:  # ❌ PLAIN TEXT COMPARISON
    return {"success": False, "message": _("Invalid app password")}
```

**Required Fix:**
```python
import bcrypt

# When setting password (in Employee doctype or API):
hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
employee_doc.app_password_hash = hashed_password  # Store hash, not plain text

# When verifying password:
stored_hash = employee_doc.get_password("app_password_hash")
if not bcrypt.checkpw(app_password.encode('utf-8'), stored_hash.encode('utf-8')):
    return {"success": False, "message": _("Invalid app password")}
```

**Implementation Steps:**
1. Add `bcrypt` to Python requirements
2. Add new field `app_password_hash` to Employee doctype
3. Create migration script to hash existing passwords
4. Update `mobile_app_login()` function to use bcrypt verification
5. Update `reset_app_password()` function to hash new passwords
6. Update `change_app_password()` function to hash passwords
7. Remove old `app_password` field after migration

**Dependencies:** python-bcrypt or passlib library

---

### 2. Backend: Add Rate Limiting on Login Endpoint

**Issue:** No protection against brute force attacks
**Location:** `backend/backend_mobile_auth.py:5-6`
**Risk Level:** 🟠 HIGH
**Impact:** Vulnerable to credential stuffing and brute force attacks

**Current Code:**
```python
@frappe.whitelist(allow_guest=True)
def mobile_app_login(usr, app_password, device_id, device_model, device_brand):
    # No rate limiting
```

**Required Fix:**

**Option 1: Use Frappe Built-in (Simple)**
```python
from frappe.utils.limits import check_and_update_rate_limit

@frappe.whitelist(allow_guest=True)
def mobile_app_login(usr, app_password, device_id, device_model, device_brand):
    # Rate limit: 5 attempts per hour per IP
    if not check_and_update_rate_limit("mobile_login", limit=5, seconds=3600):
        return {
            "success": False,
            "message": _("Too many login attempts. Please try again in 1 hour.")
        }
    # ... rest of login logic
```

**Option 2: Custom Rate Limiting (More Control)**
```python
from frappe.utils import now_datetime, add_to_date
from datetime import timedelta

def check_login_attempts(usr, device_id):
    """Check if user has exceeded login attempts"""
    cache_key = f"login_attempts:{usr}:{device_id}"

    attempts = frappe.cache().get(cache_key) or 0

    if attempts >= 5:
        return False, "Too many failed login attempts. Try again in 15 minutes."

    return True, None

def increment_login_attempts(usr, device_id):
    """Increment failed login attempts"""
    cache_key = f"login_attempts:{usr}:{device_id}"
    attempts = frappe.cache().get(cache_key) or 0
    frappe.cache().set(cache_key, attempts + 1, expires_in_sec=900)  # 15 minutes

def clear_login_attempts(usr, device_id):
    """Clear login attempts on successful login"""
    cache_key = f"login_attempts:{usr}:{device_id}"
    frappe.cache().delete(cache_key)

# In mobile_app_login():
allowed, message = check_login_attempts(usr, device_id)
if not allowed:
    return {"success": False, "message": message}

# On failed login:
increment_login_attempts(usr, device_id)

# On successful login:
clear_login_attempts(usr, device_id)
```

**Implementation Steps:**
1. Choose rate limiting approach (Option 1 recommended for simplicity)
2. Add rate limit check at beginning of `mobile_app_login()`
3. Test with multiple failed login attempts
4. Document rate limit policy (5 attempts per hour recommended)

---

### 3. Frontend: Remove Console Logs with Sensitive Data

**Issue:** Sensitive data logged to console in production
**Location:** `src/contexts/AuthContext.tsx` (multiple lines)
**Risk Level:** 🟡 MEDIUM
**Impact:** Information disclosure through logs, debugger, or crash reporting

**Lines to Fix:**
- Line 59: `console.log('📱 Retrieved existing device ID')`
- Line 74: `console.log('Device fingerprint:', deviceFingerprint)`
- Line 91: `console.log('📱 Generated new device ID')`
- Line 190-196: Login attempt logs with App ID and Device ID
- Line 218: `console.log('Login response:', JSON.stringify(loginData, null, 2))`
- And many more throughout the file

**Required Fix:**

**Step 1: Create a Logger Utility**
```typescript
// src/utils/logger.ts
const isDevelopment = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors, but sanitize sensitive data
    console.error(...args);
  },

  // For sensitive operations - only in dev, never in production
  sensitive: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[SENSITIVE]', ...args);
    }
  }
};
```

**Step 2: Replace All console.log with logger**
```typescript
// In AuthContext.tsx
import { logger } from '@/utils/logger';

// Replace:
console.log('📱 Retrieved existing device ID for ${appId} from storage');
// With:
logger.sensitive('📱 Retrieved existing device ID for', appId);

// Replace:
console.log('Login response:', JSON.stringify(loginData, null, 2));
// With:
logger.sensitive('Login response:', loginData);
```

**Implementation Steps:**
1. Create `src/utils/logger.ts` utility
2. Export logger from `src/utils/index.ts`
3. Find and replace all `console.log` in AuthContext.tsx
4. Find and replace all `console.log` in other sensitive files
5. Test in development mode (logs should show)
6. Test in production mode (sensitive logs should NOT show)

---

### 4. Backend: Fix API Secret Regeneration Logic

**Issue:** API secret regenerated on every login, invalidating previous sessions
**Location:** `backend/backend_mobile_auth.py:138-148`
**Risk Level:** 🟠 HIGH
**Impact:** User sessions invalidated unexpectedly, poor UX

**Current Code:**
```python
def generate_api_credentials(user):
    user_doc = frappe.get_doc("User", user)
    api_key = user_doc.api_key
    api_secret = frappe.generate_hash(length=15)  # ❌ ALWAYS GENERATES NEW

    if not api_key:
        api_key = frappe.generate_hash(length=15)
        user_doc.api_key = api_key

    user_doc.api_secret = api_secret  # ❌ ALWAYS OVERWRITES
    user_doc.save(ignore_permissions=True)

    return api_key, user_doc.get_password("api_secret")
```

**Required Fix:**
```python
def generate_api_credentials(user, force_regenerate=False):
    """
    Generate or retrieve API key and secret for the user

    Args:
        user: Username/Email
        force_regenerate: If True, generate new secret (for security resets)

    Returns:
        tuple: (api_key, api_secret)
    """
    user_doc = frappe.get_doc("User", user)

    # Generate API key if not exists
    if not user_doc.api_key:
        user_doc.api_key = frappe.generate_hash(length=15)

    # Only generate new secret if:
    # 1. Secret doesn't exist, OR
    # 2. Force regenerate (password reset, security breach)
    existing_secret = user_doc.get_password("api_secret")

    if not existing_secret or force_regenerate:
        api_secret = frappe.generate_hash(length=15)
        user_doc.api_secret = api_secret
        user_doc.save(ignore_permissions=True)
        return user_doc.api_key, user_doc.get_password("api_secret")
    else:
        # Return existing credentials
        return user_doc.api_key, existing_secret
```

**Update mobile_app_login():**
```python
# Step 5: Login the user
frappe.local.login_manager.login_as(employee.user_id)

# Generate API credentials (will reuse existing secret)
api_key, api_secret = generate_api_credentials(employee.user_id, force_regenerate=False)
```

**Update reset_app_password():**
```python
# After password reset, regenerate API secret for security
api_key, api_secret = generate_api_credentials(user, force_regenerate=True)
```

**Implementation Steps:**
1. Update `generate_api_credentials()` function signature
2. Add logic to check for existing secret
3. Update all calls to specify `force_regenerate` parameter
4. Test login (should reuse existing credentials)
5. Test password reset (should generate new credentials)

---

### 5. Frontend: Enforce HTTPS Only

**Issue:** App accepts HTTP URLs, allowing unencrypted connections
**Location:** `src/contexts/AuthContext.tsx:102-112`
**Risk Level:** 🟡 MEDIUM
**Impact:** Credentials can be intercepted via MITM attacks

**Current Code:**
```typescript
const validateAndFormatUrl = (url: string): string => {
  let formattedUrl = url.trim();

  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  formattedUrl = formattedUrl.replace(/\/+$/, '');

  return formattedUrl;  // ❌ Allows http:// URLs
};
```

**Required Fix:**
```typescript
const validateAndFormatUrl = (url: string): { url: string; error?: string } => {
  let formattedUrl = url.trim();

  // Add https:// if no protocol specified
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  // ✅ REJECT HTTP connections
  if (formattedUrl.toLowerCase().startsWith('http://')) {
    return {
      url: '',
      error: 'Insecure connections are not allowed. Please use HTTPS (https://)'
    };
  }

  // Remove trailing slashes
  formattedUrl = formattedUrl.replace(/\/+$/, '');

  // Validate URL format
  try {
    const urlObj = new URL(formattedUrl);
    if (urlObj.protocol !== 'https:') {
      return {
        url: '',
        error: 'Only HTTPS connections are allowed'
      };
    }
  } catch (e) {
    return {
      url: '',
      error: 'Invalid URL format'
    };
  }

  return { url: formattedUrl };
};
```

**Update setupSiteUrl():**
```typescript
const setupSiteUrl = async (url: string): Promise<{ success: boolean; error?: string; url?: string }> => {
  try {
    const validation = validateAndFormatUrl(url);

    if (validation.error) {
      return {
        success: false,
        error: validation.error
      };
    }

    const formattedUrl = validation.url;

    console.log('Testing connection to:', formattedUrl);

    // ... rest of setup logic
  } catch (error) {
    // ... error handling
  }
};
```

**Implementation Steps:**
1. Update `validateAndFormatUrl()` to return object with error
2. Add HTTP rejection logic
3. Update `setupSiteUrl()` to handle validation errors
4. Test with http:// URL (should reject)
5. Test with https:// URL (should accept)
6. Test with domain only (should add https://)

---

### 6. Frontend: Improve Device ID Generation Security

**Issue:** Device ID can be easily spoofed
**Location:** `src/contexts/AuthContext.tsx:64-99`
**Risk Level:** 🟡 MEDIUM
**Impact:** Device binding can be bypassed

**Current Code:**
```typescript
const deviceFingerprint = [
  appId || 'unknown',
  Device.modelName || 'unknown',
  Device.brand || 'unknown',
  Device.osVersion || 'unknown',
  Device.deviceName || 'unknown',
  Constants.sessionId || Date.now().toString(),
].join('-');

// Simple base64 encoding - not secure
const deviceId = btoa(deviceFingerprint)
  .replace(/[^a-zA-Z0-9]/g, '')
  .substring(0, 40);
```

**Required Fix:**

**Step 1: Install expo-crypto**
```bash
npx expo install expo-crypto
```

**Step 2: Update Device ID Generation**
```typescript
import * as Crypto from 'expo-crypto';

const generateDeviceId = async (appId: string): Promise<string> => {
  try {
    const storageKey = `${SECURE_STORE_KEYS.DEVICE_ID_PREFIX}${appId}`;
    const storedDeviceId = await SecureStore.getItemAsync(storageKey);

    if (storedDeviceId) {
      logger.log('📱 Retrieved existing device ID from storage');
      return storedDeviceId;
    }

    // Generate a unique device ID based on device characteristics
    const deviceFingerprint = [
      appId || 'unknown',
      Device.modelName || 'unknown',
      Device.brand || 'unknown',
      Device.osVersion || 'unknown',
      Device.deviceName || 'unknown',
      Constants.sessionId || Date.now().toString(),
      // Add random component for uniqueness
      Math.random().toString(36).substring(2, 15)
    ].join('-');

    logger.log('Device fingerprint:', deviceFingerprint);

    // ✅ Use cryptographic hash instead of base64
    const deviceId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      deviceFingerprint
    );

    // Store it securely for future use
    await SecureStore.setItemAsync(storageKey, deviceId);
    logger.log('📱 Generated new device ID using cryptographic hash');

    return deviceId;
  } catch (error) {
    console.error('Error generating device ID:', error);
    // Fallback to secure random
    const fallbackId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `fallback-${Date.now()}-${Math.random()}`
    );
    return fallbackId;
  }
};
```

**Implementation Steps:**
1. Install expo-crypto package
2. Import Crypto from expo-crypto
3. Replace btoa() with Crypto.digestStringAsync()
4. Update fallback logic to use crypto
5. Test device ID generation and storage
6. Verify device binding still works

---

## 🟠 HIGH PRIORITY (Fix Soon)

### 7. Add Session/Token Expiration

**Issue:** API tokens never expire
**Risk Level:** 🟡 MEDIUM
**Impact:** Stolen tokens valid indefinitely

**Recommendation:**
- Add `expires_at` timestamp to API tokens
- Implement refresh token mechanism
- Force token refresh every 30 days
- Add logout endpoint to invalidate tokens

**Implementation:** Future enhancement - requires backend JWT implementation

---

### 8. Improve Device Binding Logic

**Issue:** Device binding too strict - user locked out on phone upgrade
**Location:** `backend/backend_mobile_auth.py:84-91`
**Risk Level:** 🟢 LOW (UX issue)

**Current Code:**
```python
if (employee.device_id != device_id or
    employee.device_model != device_model or
    employee.device_brand != device_brand):
```

**Recommendation:**
```python
# Only check device_id, not model/brand (they can change)
if employee.device_id and employee.device_id != device_id:
    return {
        "success": False,
        "message": _("Access denied. This account is registered to a different device.")
    }
```

---

### 9. Add Certificate Pinning (Advanced)

**Issue:** Vulnerable to MITM attacks even with HTTPS
**Risk Level:** 🟡 MEDIUM (for high-security environments)

**Implementation:** Requires expo-ssl-pinning or custom native module

---

## 📋 Implementation Checklist

- [ ] **Fix 1:** Hash passwords with bcrypt (backend)
- [ ] **Fix 2:** Add rate limiting on login (backend)
- [ ] **Fix 3:** Remove/sanitize console logs (frontend)
- [ ] **Fix 4:** Fix API secret regeneration (backend)
- [ ] **Fix 5:** Enforce HTTPS only (frontend)
- [ ] **Fix 6:** Improve device ID generation (frontend)
- [ ] **Fix 7:** Add token expiration (backend/frontend)
- [ ] **Fix 8:** Improve device binding UX (backend)
- [ ] **Fix 9:** Add certificate pinning (frontend)

---

## 📝 Notes

- Test each fix in development environment before production
- Create database backups before password migration
- Update API documentation after changes
- Notify users of security improvements
- Consider adding changelog/release notes

---

## 🔗 References

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Frappe Security Best Practices](https://frappeframework.com/docs/user/en/security)
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [bcrypt Best Practices](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns)

---

**Last Updated:** 2025-12-06
**Next Review:** After implementing critical fixes
