/*
  # Add on_hold field to lots table

  1. Changes
    - Add `on_hold` boolean column to lots table with default false
    - Lots with on_hold = true will be visible but not processed by the agent
    - Users can pause/resume lots to manage their publication queue

  2. Notes
    - Default is false (active) to maintain current behavior
    - No data migration needed as all existing lots will default to active
*/

-- Add on_hold column to lots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'on_hold'
  ) THEN
    ALTER TABLE lots ADD COLUMN on_hold boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for better query performance when filtering by on_hold status
CREATE INDEX IF NOT EXISTS idx_lots_on_hold ON lots(on_hold) WHERE on_hold = true;