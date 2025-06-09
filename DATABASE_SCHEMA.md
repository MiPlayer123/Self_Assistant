# Database Schema - Interview Coder

This document outlines the database schema required to run the Interview Coder application.

## Database Provider
The application uses **Supabase** (PostgreSQL) as its backend database service.

## Environment Variables Required
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anonymous_key
```

## Authentication
The application relies on Supabase's built-in authentication system with:
- Email/password authentication
- Google OAuth provider
- PKCE flow for security
- Session persistence in localStorage

## Database Tables

### 1. `subscriptions` table

This is the main custom table that stores user subscription and preference data.

```sql
CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    credits integer DEFAULT 1,
    preferred_language text DEFAULT 'python',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```

#### Fields:
- `id`: Primary key (UUID)
- `user_id`: Foreign key to Supabase auth.users table
- `credits`: Number of API credits available to the user (default: 1)
- `preferred_language`: User's preferred programming language (default: 'python')
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

#### Supported Languages:
- python
- javascript
- java
- golang
- cpp
- swift
- kotlin
- ruby
- sql
- r

## Row Level Security (RLS)

Enable RLS on the subscriptions table and create policies:

```sql
-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own data
CREATE POLICY "Users can view own subscription data" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own data
CREATE POLICY "Users can update own subscription data" ON public.subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to insert their own data
CREATE POLICY "Users can insert own subscription data" ON public.subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Realtime Subscriptions

The application uses Supabase realtime features to listen for:
- Credits updates in the `subscriptions` table
- User subscription status changes
- Language preference changes

Enable realtime on the subscriptions table:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
```

## Database Operations

The application performs the following operations:

### User Subscription Management:
- `SELECT credits, preferred_language FROM subscriptions WHERE user_id = ?`
- `UPDATE subscriptions SET preferred_language = ? WHERE user_id = ?`
- `UPDATE subscriptions SET credits = ? WHERE user_id = ?`

### Authentication:
- Uses Supabase built-in `auth.users` table
- Google OAuth integration
- Email/password authentication
- Session management

## External APIs

The application also integrates with external APIs for AI processing:
- **Development**: `http://localhost:3000`
- **Production**: `https://www.interviewcoder.co`

### API Endpoints Used:
- `/api/extract` - Extract problem information from screenshots
- `/api/generate` - Generate code solutions
- `/api/debug` - Debug code solutions

## Setup Instructions

1. Create a new Supabase project
2. Set up Google OAuth provider in Supabase Auth settings
3. Create the `subscriptions` table using the SQL above
4. Enable RLS and create the security policies
5. Enable realtime for the `subscriptions` table
6. Configure environment variables in your application
7. Set up the external API service (interviewcoder.co backend)

## Notes

- The application uses credits system to limit API usage
- Default credit allocation is 1 per new user
- The app supports both authenticated and unauthenticated users (unauthenticated users get 1 credit)
- Screenshots and processing are handled locally in the Electron app
- Database is primarily used for user management and preferences 