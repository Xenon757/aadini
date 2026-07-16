/*
  # Fix Critical RLS Security Issues

  ## Overview
  This migration fixes critical security vulnerabilities where RLS policies were allowing unrestricted access using `USING (true)` and `WITH CHECK (true)`.

  ## Changes Made

  ### 1. user_finances Table
  - **Dropped insecure policies**: Removed policies with unrestricted access
  - **New secure policies**: 
    - SELECT: Users can only view their own financial data
    - INSERT: Users can only create records for themselves
    - UPDATE: Users can only update their own financial data
    - DELETE: Users can only delete their own financial data
  - All policies check `auth.uid()` to ensure users can only access their own data

  ### 2. user_settings Table
  - **Dropped insecure policies**: Removed policies with unrestricted access
  - **New secure policies**:
    - SELECT: Users can only view their own settings
    - INSERT: Users can only create settings for themselves
    - UPDATE: Users can only update their own settings
    - DELETE: Users can only delete their own settings
  - All policies check `auth.uid()` to ensure users can only access their own data

  ## Security Notes
  - All policies now restrict access to authenticated users only
  - Users can ONLY access data where `user_id` matches their authenticated user ID
  - This prevents unauthorized access to other users' financial data and settings
*/

-- Drop insecure policies for user_finances
DROP POLICY IF EXISTS "Allow public delete access to user_finances" ON public.user_finances;
DROP POLICY IF EXISTS "Allow public insert access to user_finances" ON public.user_finances;
DROP POLICY IF EXISTS "Allow public update access to user_finances" ON public.user_finances;
DROP POLICY IF EXISTS "Allow public select access to user_finances" ON public.user_finances;

-- Drop insecure policies for user_settings
DROP POLICY IF EXISTS "Allow public delete access to user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow public insert access to user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow public update access to user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow public select access to user_settings" ON public.user_settings;

-- Create secure RLS policies for user_finances
CREATE POLICY "Users can view own finances"
  ON public.user_finances
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own finances"
  ON public.user_finances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own finances"
  ON public.user_finances
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own finances"
  ON public.user_finances
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Create secure RLS policies for user_settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);