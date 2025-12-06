# Project Structure

This project follows React Native + Expo + TypeScript best practices for 2025.

## Directory Structure

```
AshidaESS/
├── app/                          # Expo Router - File-based navigation
│   ├── (auth)/                   # Authentication group
│   │   ├── LoginScreen.tsx       # Login screen
│   │   ├── ResetPasswordScreen.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Tab navigation group
│   │   ├── index.tsx
│   │   ├── profile.tsx
│   │   └── _layout.tsx
│   ├── index.tsx                 # Root redirect
│   └── _layout.tsx               # Root layout with auth logic
│
├── src/                          # Source code
│   ├── components/               # Reusable UI components
│   │   ├── common/              # Common components (buttons, inputs, etc.)
│   │   ├── forms/               # Form components
│   │   └── layout/              # Layout components
│   │
│   ├── contexts/                 # React Context providers
│   │   └── AuthContext.tsx      # Authentication context
│   │
│   ├── services/                 # API services and business logic
│   │   └── frappeService.ts     # Frappe API service hook
│   │
│   ├── hooks/                    # Custom React hooks
│   │   └── README.md
│   │
│   ├── utils/                    # Utility functions
│   │   └── index.ts
│   │
│   ├── constants/                # App constants and configuration
│   │   └── index.ts             # Colors, sizes, etc.
│   │
│   └── types/                    # TypeScript type definitions
│       └── index.ts             # Shared types and interfaces
│
├── assets/                       # Static assets
│   └── images/
│
├── backend/                      # Backend code (if applicable)
├── docs/                         # Documentation
└── ...                          # Config files
```

## Naming Conventions

### Files and Folders
- **Screens**: PascalCase with "Screen" suffix
  - Example: `LoginScreen.tsx`, `HomeScreen.tsx`

- **Components**: PascalCase
  - Example: `Button.tsx`, `UserCard.tsx`

- **Utilities/Hooks/Services**: camelCase
  - Example: `frappeService.ts`, `useDebounce.ts`

- **Folders**: lowercase or kebab-case
  - Example: `components/`, `utils/`, `user-profile/`

### Code
- **Component Names**: PascalCase
  - `const LoginScreen = () => { ... }`

- **Functions**: camelCase
  - `const handleLogin = () => { ... }`

- **Constants**: UPPER_SNAKE_CASE or camelCase
  - `const API_URL = '...'` or `const colors = { ... }`

## Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
// Instead of:
import { useAuth } from '../../../contexts/AuthContext';

// Use:
import { useAuth } from '@/contexts/AuthContext';
```

### Available Aliases

- `@/*` - Root directory
- `@/components/*` - Components directory
- `@/hooks/*` - Hooks directory
- `@/contexts/*` - Contexts directory
- `@/services/*` - Services directory
- `@/utils/*` - Utils directory
- `@/constants/*` - Constants directory
- `@/types/*` - Types directory

## Best Practices

### 1. Component Organization
```tsx
// src/components/common/Button.tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
};
```

### 2. Screen Organization
```tsx
// app/(tabs)/HomeScreen.tsx
import { View, Text } from 'react-native';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <View>
      <Text>Welcome {user?.employee_name}</Text>
      <Button title="Click Me" onPress={() => {}} />
    </View>
  );
}
```

### 3. Custom Hooks
```tsx
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  // ... implementation
  return debouncedValue;
}

// Usage
import { useDebounce } from '@/hooks/useDebounce';
```

### 4. Type Definitions
```tsx
// src/types/index.ts
export interface User {
  employee_name: string;
  require_password_reset?: boolean;
}

export interface ApiResponse<T> {
  message?: T;
  data?: T;
}

// Usage
import type { User, ApiResponse } from '@/types';
```

### 5. Constants
```tsx
// src/constants/index.ts
export const COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
} as const;

// Usage
import { COLORS } from '@/constants';
```

## Key Features

1. **Expo Router**: File-based routing in the `app/` directory
2. **TypeScript**: Full type safety throughout the project
3. **Path Aliases**: Clean imports using `@/` prefix
4. **Organized Structure**: Clear separation of concerns
5. **Scalable**: Easy to add new features and components

## Adding New Features

### Adding a New Screen
1. Create a new file in `app/` with the route name
   - Example: `app/(tabs)/SettingsScreen.tsx`
2. Import and use components from `@/components`

### Adding a New Component
1. Create in appropriate folder under `src/components/`
2. Export the component
3. Import using path alias: `@/components/...`

### Adding a New Hook
1. Create in `src/hooks/`
2. Name with `use` prefix
3. Export and import using `@/hooks/...`

### Adding a New Service
1. Create in `src/services/`
2. Export functions or hooks
3. Import using `@/services/...`

## References

This structure follows best practices from:
- [React Native Project Structure](https://medium.com/@mar.cardona.96/react-native-project-structure-using-expo-and-typescript-552b4a42b8b5)
- [Expo Router Documentation](https://docs.expo.dev/routing/introduction/)
- [TypeScript Best Practices](https://docs.expo.dev/guides/typescript/)
- [Starting React Native Project in 2025](https://dev.to/vladimirvovk/starting-react-native-project-in-2025-4n25)
