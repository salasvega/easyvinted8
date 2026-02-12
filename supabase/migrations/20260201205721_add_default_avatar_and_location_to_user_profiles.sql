/*
  # Add Default Avatar and Location to User Profiles

  1. Changes
    - Add `default_avatar_id` column to `user_profiles` table
      - References `avatars` table
      - Nullable (user may not have set a default yet)
      - Set to NULL on avatar deletion
    - Add `default_location_id` column to `user_profiles` table
      - References `locations` table
      - Nullable (user may not have set a default yet)
      - Set to NULL on location deletion

  2. Purpose
    - Allow users to set a default avatar and location
    - These defaults will be used automatically in the Image Editor for Try On and Background features
    - Provides consistency across all photos for a user's articles

  3. Security
    - Foreign key constraints ensure referential integrity
    - ON DELETE SET NULL ensures profile remains valid when avatar/location is deleted
*/

-- Add default_avatar_id column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'default_avatar_id'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN default_avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add default_location_id column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'default_location_id'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN default_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_default_avatar 
  ON user_profiles(default_avatar_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_default_location 
  ON user_profiles(default_location_id);
