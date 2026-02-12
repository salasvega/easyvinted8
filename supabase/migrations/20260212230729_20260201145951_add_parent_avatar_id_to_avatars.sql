/*
  # Add parent-child relationship to avatars

  1. Changes
    - Add `parent_avatar_id` column to `avatars` table
      - UUID field referencing another avatar (self-reference)
      - Nullable (original avatars have no parent)
      - Foreign key constraint with CASCADE delete
    
  2. Purpose
    - Track avatar versions/variations
    - Allow grouping related avatars (same person, different styles)
    - Enable version history and management
    
  3. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add parent_avatar_id column to avatars table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'parent_avatar_id'
  ) THEN
    ALTER TABLE avatars 
    ADD COLUMN parent_avatar_id uuid REFERENCES avatars(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for performance when querying avatar families
CREATE INDEX IF NOT EXISTS idx_avatars_parent_avatar_id 
ON avatars(parent_avatar_id);

-- Add comment for documentation
COMMENT ON COLUMN avatars.parent_avatar_id IS 'References the parent avatar if this is a version/variation. NULL for original avatars.';