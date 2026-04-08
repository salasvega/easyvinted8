/*
  # Remove cascade delete from avatars parent-child relationship

  1. Changes
    - Remove CASCADE DELETE constraint on `parent_avatar_id` in `avatars` table
    - Replace with SET NULL behavior

  2. Behavior After Migration
    - When a parent avatar is deleted, child avatars remain in database
    - The `parent_avatar_id` field of children is set to NULL
    - When a child avatar is deleted, the parent avatar is unaffected

  3. Security
    - No RLS changes needed (existing policies apply)
*/

-- Drop the existing foreign key constraint with CASCADE DELETE
DO $$
BEGIN
  -- First, find the constraint name
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'avatars'
    AND constraint_name LIKE '%parent_avatar_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Drop the existing foreign key constraint
    ALTER TABLE avatars
    DROP CONSTRAINT IF EXISTS avatars_parent_avatar_id_fkey;
  END IF;
END $$;

-- Add the new foreign key constraint with SET NULL
ALTER TABLE avatars
ADD CONSTRAINT avatars_parent_avatar_id_fkey
FOREIGN KEY (parent_avatar_id)
REFERENCES avatars(id)
ON DELETE SET NULL;

-- Update comment to reflect the new behavior
COMMENT ON COLUMN avatars.parent_avatar_id IS 'References the parent avatar if this is a version/variation. NULL for original avatars. Set to NULL if parent is deleted.';