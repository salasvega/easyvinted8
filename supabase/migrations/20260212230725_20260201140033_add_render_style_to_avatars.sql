/*
  # Add render_style column to avatars table

  1. Changes
    - Add `render_style` column to `avatars` table
    - Set default value to 'studio' for existing records
    - Column stores the artistic direction/style for the avatar photo

  2. Notes
    - Existing avatars will default to 'studio' style
    - Valid values: 'studio', 'casual', 'classic'
*/

-- Add render_style column to avatars table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'render_style'
  ) THEN
    ALTER TABLE avatars ADD COLUMN render_style text DEFAULT 'studio' NOT NULL;
  END IF;
END $$;