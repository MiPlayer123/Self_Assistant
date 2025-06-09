# Supabase Connection Temporarily Disabled

This document outlines the changes made to temporarily disable the Supabase connection and run the application with mock data.

## Changes Made

### 1. Mock Supabase Client (`src/lib/supabase.ts`)
- Replaced actual Supabase client with mock implementation
- Mock provides:
  - Fake authenticated user with ID: `mock-user-123`
  - Active subscription with 999 credits
  - Default preferred language: `python`
  - All auth methods return success responses
  - Database operations return mock subscription data
  - Realtime channels are simulated with console logs

### 2. Type Definitions Updated
- `src/env.d.ts`: Made Supabase environment variables optional
- `src/vite-env.d.ts`: Made Supabase environment variables optional  
- `env.d.ts`: Made Supabase environment variables optional
- `src/App.tsx`: Added mock User type definition
- `src/_pages/SubscribePage.tsx`: Added mock User type definition

### 3. Electron IPC Handler (`electron/ipcHandlers.ts`)
- Commented out Supabase import

## Mock Data Provided

### User Object
```javascript
{
  id: "mock-user-123",
  email: "mock@example.com",
  // ... other user properties
}
```

### Subscription Object
```javascript
{
  id: "mock-subscription-123",
  user_id: "mock-user-123",
  credits: 999,           // High credit count for testing
  preferred_language: "python",
  // ... timestamps
}
```

## Application Behavior with Mock

1. **Authentication**: All auth operations appear successful
2. **Credits**: User always has 999 credits available
3. **Language**: Default to Python, can be changed via UI
4. **Database Operations**: All return mock subscription data
5. **Realtime**: Simulated with console logging
6. **OAuth**: Google sign-in appears to work but uses mock data

## How to Re-enable Supabase

1. **Restore `src/lib/supabase.ts`**:
   - Uncomment the Supabase import
   - Replace mock client with actual `createClient()` call
   - Restore original auth state monitoring

2. **Restore Type Imports**:
   - Uncomment `import { User } from "@supabase/supabase-js"` in:
     - `src/App.tsx`
     - `src/_pages/SubscribePage.tsx`
   - Remove mock User type definitions

3. **Restore Environment Variables**:
   - Make Supabase env vars required (remove `?`) in:
     - `src/env.d.ts`
     - `src/vite-env.d.ts`
     - `env.d.ts`

4. **Restore Electron Handler**:
   - Uncomment Supabase import in `electron/ipcHandlers.ts`

5. **Set Environment Variables**:
   ```bash
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anonymous_key
   ```

## Testing Notes

- All console output will show "Mock:" prefix for Supabase operations
- Credits will always be 999 and won't actually decrement
- User will always appear as authenticated
- Database operations will return consistent mock data
- No actual network requests to Supabase will be made

## Current Status

✅ Supabase connection disabled  
✅ Mock authentication working  
✅ Mock subscription (999 credits) active  
✅ Application should run without Supabase environment variables  
✅ All auth flows return success responses  