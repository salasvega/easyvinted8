/*
  # Add Image Analysis Cache to Articles

  1. Purpose
    - Cache AI image analysis results to avoid regenerating them on every open
    - Store raw analysis data, analyzed photos URLs, and analysis timestamp
    - Massive cost savings: only re-analyze if photos have changed

  2. New Columns
    - `image_analysis_raw` (jsonb) - Full AI analysis result (title, description, brand, attributes, SEO, etc.)
    - `image_analyzed_at` (timestamptz) - When the analysis was performed
    - `image_analysis_photo_urls` (text[]) - Array of photo URLs that were analyzed
    - `image_analysis_confidence` (numeric) - Confidence score from AI (0-1)

  3. Benefits
    - If photos haven't changed, reuse cached analysis instantly
    - No API calls = no costs for repeated opens
    - Users can see analysis history (when it was done)
    - Can track which photos were analyzed for invalidation logic

  4. Invalidation Strategy
    - If current photo URLs != cached photo URLs → re-analyze
    - Manual "Re-analyze" button → force re-analyze
    - Otherwise → use cache
*/

-- Add image analysis cache columns
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_analysis_raw jsonb;

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_analyzed_at timestamptz;

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_analysis_photo_urls text[];

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_analysis_confidence numeric(3, 2);

-- Create index for querying articles by analysis date
CREATE INDEX IF NOT EXISTS idx_articles_image_analyzed_at
ON articles(image_analyzed_at)
WHERE image_analyzed_at IS NOT NULL;

-- Create index for checking if analysis is up-to-date
CREATE INDEX IF NOT EXISTS idx_articles_with_analysis
ON articles(id, image_analyzed_at)
WHERE image_analysis_raw IS NOT NULL;
