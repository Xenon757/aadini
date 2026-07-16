/*
  # Create User Financial Data Tables

  ## Overview
  This migration creates tables to store user financial information, including finances and settings,
  enabling data persistence across sessions and devices for authenticated users.

  ## New Tables

  ### `user_finances`
  Stores all financial data for each user including income, expenses, and loans.
  - `id` (uuid, primary key) - Unique identifier for the record
  - `user_id` (uuid, foreign key) - References auth.users
  - `income_type` (text) - Either 'gross' or 'net'
  - `monthly_gross_income` (numeric) - User's monthly gross income
  - `monthly_net_income` (numeric) - User's monthly net income
  - `filing_status` (text) - Tax filing status
  - `state` (text) - US state for tax calculation
  - `city` (text) - City for tax calculation
  - `expenses` (jsonb) - Array of expense objects
  - `loans` (jsonb) - Array of loan objects
  - `has_401k` (boolean) - Whether user has 401k
  - `monthly_401k_contribution` (numeric) - Monthly 401k contribution amount
  - `monthly_other_deductions` (numeric) - Other monthly deductions
  - `has_social_security` (boolean) - Whether social security applies
  - `has_medicare` (boolean) - Whether medicare applies
  - `created_at` (timestamptz) - When record was created
  - `updated_at` (timestamptz) - When record was last updated

  ### `user_settings`
  Stores user preferences and settings.
  - `id` (uuid, primary key) - Unique identifier for the record
  - `user_id` (uuid, foreign key) - References auth.users
  - `risk_profile` (text) - User's risk profile (Low, Average, High)
  - `created_at` (timestamptz) - When record was created
  - `updated_at` (timestamptz) - When record was last updated

  ## Security
  - Enable RLS on both tables
  - Users can only read their own financial data
  - Users can only insert their own financial data
  - Users can only update their own financial data
  - Users can only delete their own financial data

  ## Indexes
  - Index on user_id for fast lookups
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own financial data" ON user_finances;
DROP POLICY IF EXISTS "Users can insert own financial data" ON user_finances;
DROP POLICY IF EXISTS "Users can update own financial data" ON user_finances;
DROP POLICY IF EXISTS "Users can delete own financial data" ON user_finances;
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- Create user_finances table
CREATE TABLE IF NOT EXISTS user_finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  income_type text NOT NULL DEFAULT 'net',
  monthly_gross_income numeric NOT NULL DEFAULT 0,
  monthly_net_income numeric NOT NULL DEFAULT 0,
  filing_status text NOT NULL DEFAULT 'single',
  state text NOT NULL DEFAULT 'CA',
  city text NOT NULL DEFAULT 'none',
  expenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  loans jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_401k boolean NOT NULL DEFAULT false,
  monthly_401k_contribution numeric NOT NULL DEFAULT 0,
  monthly_other_deductions numeric NOT NULL DEFAULT 0,
  has_social_security boolean NOT NULL DEFAULT true,
  has_medicare boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  risk_profile text NOT NULL DEFAULT 'Average',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_finances_user_id ON user_finances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_finances

CREATE POLICY "Users can view own financial data"
  ON user_finances FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can insert own financial data"
  ON user_finances FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can update own financial data"
  ON user_finances FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text)
  WITH CHECK ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can delete own financial data"
  ON user_finances FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text);

-- RLS Policies for user_settings

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text)
  WITH CHECK ((auth.uid())::text = (user_id)::text);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = (user_id)::text);
