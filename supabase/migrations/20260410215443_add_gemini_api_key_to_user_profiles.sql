/*
  # Add Gemini API Key to user_profiles

  ## Summary
  Adds a `gemini_api_key` column to the `user_profiles` table so each user can
  store their own Google Gemini API key. The application will use this key instead
  of the global server secret when calling AI features, so each user is billed
  directly on their own Google AI account.

  ## Changes
  - `user_profiles`: new nullable column `gemini_api_key` (text)

  ## Security
  - Column is accessible only through existing RLS policies on `user_profiles`
  - Users can only read/write their own row (existing policies enforce this)
  - The key is stored as plain text server-side but is never returned to other users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN gemini_api_key text DEFAULT NULL;
  END IF;
END $$;
