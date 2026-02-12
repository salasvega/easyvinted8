/*
  # Add Avatar and Location to Family Members
  
  1. Changes
    - Add `default_avatar_id` column to family_members table
    - Add `default_location_id` column to family_members table
    - These fields allow each family member to have their own default avatar and location for Virtual Stylist
  
  2. Purpose
    - When a family member is set as default seller, their avatar and location are used in ImageEditor
    - Enables per-seller customization of photo editing parameters
*/

-- Add default_avatar_id column to family_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_members' AND column_name = 'default_avatar_id'
  ) THEN
    ALTER TABLE family_members ADD COLUMN default_avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add default_location_id column to family_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_members' AND column_name = 'default_location_id'
  ) THEN
    ALTER TABLE family_members ADD COLUMN default_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_family_members_default_avatar_id ON family_members(default_avatar_id);
CREATE INDEX IF NOT EXISTS idx_family_members_default_location_id ON family_members(default_location_id);