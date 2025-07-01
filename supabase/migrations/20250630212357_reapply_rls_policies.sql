-- This script re-applies Row Level Security (RLS) for the application's tables.
-- It ensures that RLS is enabled and enforced, drops any potentially conflicting old policies,
-- and then creates the correct policies to ensure users can only access their own data.

-- == PROFILES TABLE ==
-- 1. Enable and enforce RLS on the profiles table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 2. Drop old policies on profiles to prevent conflicts.
DROP POLICY IF EXISTS "Select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to delete their own profile" ON public.profiles;

-- 3. Create policies for the 'profiles' table.
CREATE POLICY "Allow users to read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Allow users to insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Allow users to delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);


-- == USAGE_TRACKING TABLE ==
-- 1. Enable and enforce RLS on the usage_tracking table.
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking FORCE ROW LEVEL SECURITY;

-- 2. Drop old policies on usage_tracking to prevent conflicts.
DROP POLICY IF EXISTS "Allow users to read their own usage data" ON public.usage_tracking;
DROP POLICY IF EXISTS "Allow users to create their own usage records" ON public.usage_tracking;
DROP POLICY IF EXISTS "Allow users to update their own usage records" ON public.usage_tracking;

-- 3. Create policies for the 'usage_tracking' table.
CREATE POLICY "Allow users to read their own usage data"
  ON public.usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to create their own usage records"
  ON public.usage_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own usage records"
  ON public.usage_tracking FOR UPDATE
  USING (auth.uid() = user_id); 