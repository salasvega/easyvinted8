/*
  # Remove 'classic' render style option

  1. Changes
    - Update constraint validation for render_style column to remove 'classic' option
    - Valid values remain: 'studio', 'casual', '3d_hyperrealistic'
    - Update any existing avatars using 'classic' to 'casual' instead

  2. Notes
    - Classic style was too similar to casual, so it's being consolidated
    - Existing avatars with 'classic' style will be converted to 'casual'
*/

-- Update existing avatars that use 'classic' style to 'casual'
UPDATE avatars
SET render_style = 'casual'
WHERE render_style = 'classic';

-- Drop and recreate the constraint without 'classic'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'avatars_render_style_check'
    AND table_name = 'avatars'
  ) THEN
    ALTER TABLE avatars DROP CONSTRAINT avatars_render_style_check;
  END IF;

  -- Add new constraint with valid values excluding 'classic'
  ALTER TABLE avatars ADD CONSTRAINT avatars_render_style_check
    CHECK (render_style IN ('studio', 'casual', '3d_hyperrealistic'));
END $$;