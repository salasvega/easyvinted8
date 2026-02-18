/*
  # Add family_member_id to Virtual Stylist tables

  1. Changes
    - Add `family_member_id` column to `avatars` table
    - Add `family_member_id` column to `locations` table
    - Add `family_member_id` column to `stylist_photos` table
    - Add foreign key constraints linking to `family_members` table
    - Add indexes for better query performance

  2. Security
    - Update RLS policies to ensure users can only access their own family members' data
    - Policies will check both user_id and family_member ownership

  3. Notes
    - This allows each family member (seller) to have their own avatars and locations
    - Existing data will have NULL family_member_id (can be migrated later)
    - When creating new avatars/locations, the current default_seller_id will be used
*/

-- Add family_member_id to avatars table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'avatars' AND column_name = 'family_member_id'
  ) THEN
    ALTER TABLE avatars ADD COLUMN family_member_id uuid REFERENCES family_members(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_avatars_family_member ON avatars(family_member_id);
  END IF;
END $$;

-- Add family_member_id to locations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'family_member_id'
  ) THEN
    ALTER TABLE locations ADD COLUMN family_member_id uuid REFERENCES family_members(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_locations_family_member ON locations(family_member_id);
  END IF;
END $$;

-- Add family_member_id to stylist_photos table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stylist_photos' AND column_name = 'family_member_id'
  ) THEN
    ALTER TABLE stylist_photos ADD COLUMN family_member_id uuid REFERENCES family_members(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_stylist_photos_family_member ON stylist_photos(family_member_id);
  END IF;
END $$;

-- Update RLS policies for avatars to consider family_member_id
DROP POLICY IF EXISTS "Users can view own avatars" ON avatars;
CREATE POLICY "Users can view own avatars"
  ON avatars FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own avatars" ON avatars;
CREATE POLICY "Users can insert own avatars"
  ON avatars FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (family_member_id IS NULL OR family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can update own avatars" ON avatars;
CREATE POLICY "Users can update own avatars"
  ON avatars FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() AND
    (family_member_id IS NULL OR family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can delete own avatars" ON avatars;
CREATE POLICY "Users can delete own avatars"
  ON avatars FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Update RLS policies for locations to consider family_member_id
DROP POLICY IF EXISTS "Users can view own locations" ON locations;
CREATE POLICY "Users can view own locations"
  ON locations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own locations" ON locations;
CREATE POLICY "Users can insert own locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (family_member_id IS NULL OR family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can update own locations" ON locations;
CREATE POLICY "Users can update own locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() AND
    (family_member_id IS NULL OR family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can delete own locations" ON locations;
CREATE POLICY "Users can delete own locations"
  ON locations FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Update RLS policies for stylist_photos to consider family_member_id
DROP POLICY IF EXISTS "Users can view own photos" ON stylist_photos;
CREATE POLICY "Users can view own photos"
  ON stylist_photos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own photos" ON stylist_photos;
CREATE POLICY "Users can insert own photos"
  ON stylist_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (family_member_id IS NULL OR family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can delete own photos" ON stylist_photos;
CREATE POLICY "Users can delete own photos"
  ON stylist_photos FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );