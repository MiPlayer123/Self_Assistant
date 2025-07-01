-- This migration creates a trigger to automatically create a user profile
-- when a new user signs up in the auth.users table.

-- 1. Create the function to be called by the trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- 2. Create the trigger that fires after a new user is inserted.
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Secure the profiles table for inserts.
--    We can now remove the general INSERT policy for authenticated users,
--    as the trigger handles profile creation. This is more secure.
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;

--    Optionally, you can add a more restrictive policy if needed,
--    but for now, relying on the trigger is standard practice.
--    No new INSERT policy is added, effectively blocking client-side inserts
--    to the profiles table, which is the desired behavior. 