/*
  # Add Optimal Price to Articles

  1. Changes
    - Add `suggested_price_optimal` column to store Kelly's optimal price suggestion
    - Add `price_analysis_reasoning` column to store the reasoning behind the price suggestion
    - Add `price_analysis_confidence` column to store confidence score (0-1)
    - Add `price_analyzed_at` timestamp to track when the price was last analyzed

  2. Purpose
    - Cache Kelly's price analysis to avoid regenerating it on every drawer open
    - Store the optimal price separately from min/max range
    - Keep historical data about when prices were analyzed
*/

-- Add optimal price column
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS suggested_price_optimal numeric(10, 2);

-- Add pricing analysis metadata
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS price_analysis_reasoning text;

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS price_analysis_confidence numeric(3, 2);

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS price_analyzed_at timestamptz;

-- Create index for querying articles by price analysis date
CREATE INDEX IF NOT EXISTS idx_articles_price_analyzed_at
ON articles(price_analyzed_at)
WHERE price_analyzed_at IS NOT NULL;
