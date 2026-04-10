/*
  # Add publish_mode to articles and lots

  ## Summary
  Adds a `publish_mode` column to both `articles` and `lots` tables to persist
  the user's preferred publication mode per item between sessions.

  ## New Columns

  ### articles
  - `publish_mode` (text, nullable): The preferred publication mode for this article.
    - `'live'` — Mettre en vente directement sur Vinted
    - `'draft'` — Sauvegarder en brouillon Vinted
    - NULL — Not set (defaults to 'draft' in the UI)

  ### lots
  - `publish_mode` (text, nullable): Same as articles.

  ## Notes
  - Column is nullable so existing rows are unaffected
  - Default value of NULL means "not explicitly set" (UI falls back to 'draft')
  - No RLS changes needed — existing policies on articles/lots already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'publish_mode'
  ) THEN
    ALTER TABLE articles ADD COLUMN publish_mode text
      CHECK (publish_mode IN ('live', 'draft'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'publish_mode'
  ) THEN
    ALTER TABLE lots ADD COLUMN publish_mode text
      CHECK (publish_mode IN ('live', 'draft'));
  END IF;
END $$;
