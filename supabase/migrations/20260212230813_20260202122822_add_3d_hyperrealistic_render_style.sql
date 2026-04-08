/*
  # Add 3D Hyperrealistic render style option

  1. Changes
    - Add constraint validation for render_style column to include new '3d_hyperrealistic' option
    - Existing values 'studio', 'casual', 'classic' remain valid
    - New value '3d_hyperrealistic' enables ultra-realistic multi-view avatar generation

  2. Notes
    - This style produces character reference sheets with multiple views (front, 3/4, back)
    - Renders in minimal clothing to show natural body proportions
    - Optimized for virtual try-on applications
    - Features realistic skin texture, natural imperfections, and photographic quality
*/

-- Add check constraint to validate render_style values
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

  -- Add new constraint with all valid values including 3d_hyperrealistic
  ALTER TABLE avatars ADD CONSTRAINT avatars_render_style_check
    CHECK (render_style IN ('studio', 'casual', 'classic', '3d_hyperrealistic'));
END $$;