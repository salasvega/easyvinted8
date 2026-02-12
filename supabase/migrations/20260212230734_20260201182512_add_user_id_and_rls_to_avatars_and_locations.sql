/*
  # Add user ownership and RLS to avatars and locations

  1. Changes to `avatars` table
    - Add `user_id` column (uuid, required)
    - Add foreign key constraint to auth.users
    - Add index on user_id for performance
    - Enable RLS
    - Add policies for authenticated users to manage their own avatars

  2. Changes to `locations` table
    - Add `user_id` column (uuid, required)
    - Add foreign key constraint to auth.users
    - Add index on user_id for performance
    - Enable RLS
    - Add policies for authenticated users to manage their own locations

  3. Security
    - Users can only see, create, update, and delete their own avatars and locations
    - All operations require authentication
*/

-- Add user_id to avatars table
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS user_id uuid;

-- For existing avatars without user_id, we'll need to handle them
-- Option 1: Delete them (if they're test data)
-- Option 2: Assign them to a specific user
-- For now, let's make user_id NOT NULL after handling existing data

-- Update existing avatars to have a user_id (you may want to adjust this based on your needs)
-- This is a placeholder - you might want to assign them to a specific user or delete them
DO $$
BEGIN
  -- Only update if there are avatars without user_id
  IF EXISTS (SELECT 1 FROM avatars WHERE user_id IS NULL LIMIT 1) THEN
    -- Get the first user from auth.users (if any exists)
    UPDATE avatars 
    SET user_id = (SELECT id FROM auth.users LIMIT 1)
    WHERE user_id IS NULL;
  END IF;
END $$;

-- Now make user_id NOT NULL
ALTER TABLE avatars ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE avatars 
  ADD CONSTRAINT avatars_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS avatars_user_id_idx ON avatars(user_id);

-- Enable RLS on avatars
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own avatars" ON avatars;
DROP POLICY IF EXISTS "Users can insert own avatars" ON avatars;
DROP POLICY IF EXISTS "Users can update own avatars" ON avatars;
DROP POLICY IF EXISTS "Users can delete own avatars" ON avatars;

-- Create RLS policies for avatars
CREATE POLICY "Users can view own avatars"
  ON avatars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatars"
  ON avatars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own avatars"
  ON avatars FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own avatars"
  ON avatars FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add user_id to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS user_id uuid;

-- Update existing locations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM locations WHERE user_id IS NULL LIMIT 1) THEN
    UPDATE locations 
    SET user_id = (SELECT id FROM auth.users LIMIT 1)
    WHERE user_id IS NULL;
  END IF;
END $$;

-- Make user_id NOT NULL
ALTER TABLE locations ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE locations 
  ADD CONSTRAINT locations_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS locations_user_id_idx ON locations(user_id);

-- Enable RLS on locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own locations" ON locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON locations;
DROP POLICY IF EXISTS "Users can update own locations" ON locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON locations;

-- Create RLS policies for locations
CREATE POLICY "Users can view own locations"
  ON locations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own locations"
  ON locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);