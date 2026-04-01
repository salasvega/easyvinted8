/*
  # Add on_hold field to articles table

  1. Changes
    - Add `on_hold` boolean column to articles table with default false
    - Articles with on_hold = true will be visible but not processed by the agent
    - Users can pause/resume articles to manage their publication queue

  2. Notes
    - Default is false (active) to maintain current behavior
    - No data migration needed as all existing articles will default to active
*/

-- Add on_hold column to articles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'on_hold'
  ) THEN
    ALTER TABLE articles ADD COLUMN on_hold boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for better query performance when filtering by on_hold status
CREATE INDEX IF NOT EXISTS idx_articles_on_hold ON articles(on_hold) WHERE on_hold = true;