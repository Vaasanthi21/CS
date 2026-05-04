-- Run this SQL in your Supabase SQL Editor to set up the content_history table
-- Go to: https://app.supabase.com/project/enftsuaywxyeawkdgnut/sql

CREATE TABLE IF NOT EXISTS content_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  persona TEXT NOT NULL,
  persona_label TEXT NOT NULL,
  content_type TEXT NOT NULL,
  tone INTEGER,
  length INTEGER,
  keywords TEXT,
  variants JSONB NOT NULL,
  status TEXT DEFAULT 'completed',
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT
);

ALTER TABLE content_history ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE content_history ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  plan_id UUID,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC DEFAULT 0,
  credits_limit INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO plans (name, price_monthly, credits_limit, status)
VALUES
  ('Free', 0, 25, 'active'),
  ('Pro', 29, 500, 'active'),
  ('Enterprise', 199, 5000, 'active')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_content_history_created_date ON content_history(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_history_user_id ON content_history(user_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE content_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write their own data
CREATE POLICY "Users can view own history" ON content_history
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own history" ON content_history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own history" ON content_history
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Cleanup helpers for test users.
-- Replace the email value before running.
-- This removes app-side rows, but Supabase Auth users must still be deleted from Authentication > Users
-- or via the admin API/service role before the same email can sign up again.

-- DELETE FROM profiles
-- WHERE email = 'testing@testing.com';

-- DELETE FROM content_history
-- WHERE user_email = 'testing@testing.com'
--    OR user_id IN (
--      SELECT id FROM profiles WHERE email = 'testing@testing.com'
--    );
