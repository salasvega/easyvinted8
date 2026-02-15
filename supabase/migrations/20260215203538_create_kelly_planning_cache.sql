/*
  # Create Kelly Planning Cache Table

  1. New Tables
    - `kelly_planning_cache`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `insights` (jsonb) - Array of planning insights
      - `market_data` (jsonb) - Market trends snapshot
      - `generated_at` (timestamptz) - When analysis was generated
      - `expires_at` (timestamptz) - When cache expires
      - `article_count` (integer) - Number of articles analyzed
      - `priority_count` (jsonb) - Count by priority level

  2. Security
    - Enable RLS on `kelly_planning_cache` table
    - Add policy for authenticated users to read their own cache
    - Add policy for authenticated users to insert/update their own cache

  3. Performance
    - Add unique constraint on user_id
    - Add index on expires_at for cleanup queries
*/

-- Create kelly_planning_cache table
CREATE TABLE IF NOT EXISTS kelly_planning_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  market_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  article_count integer DEFAULT 0,
  priority_count jsonb DEFAULT '{"urgent": 0, "high": 0, "medium": 0, "low": 0}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE kelly_planning_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own cache
CREATE POLICY "Users can read own planning cache"
  ON kelly_planning_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own cache
CREATE POLICY "Users can insert own planning cache"
  ON kelly_planning_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own cache
CREATE POLICY "Users can update own planning cache"
  ON kelly_planning_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own cache
CREATE POLICY "Users can delete own planning cache"
  ON kelly_planning_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_kelly_planning_cache_expires_at
  ON kelly_planning_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_kelly_planning_cache_user_id
  ON kelly_planning_cache(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_kelly_planning_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-update
DROP TRIGGER IF EXISTS trigger_update_kelly_planning_cache_updated_at ON kelly_planning_cache;
CREATE TRIGGER trigger_update_kelly_planning_cache_updated_at
  BEFORE UPDATE ON kelly_planning_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_kelly_planning_cache_updated_at();
