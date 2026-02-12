/*
  # Add Reference Photo to Locations

  1. Changes
    - Add `reference_photo_url` column to `locations` table
    - This column stores a reference photo of a real background/scene that the AI will reproduce exactly

  2. Purpose
    - Allow users to upload a photo of their actual space or preferred background
    - The AI will use this photo to reproduce the exact same environment/setting
    - Provides more authentic and recognizable backgrounds for product photos
*/

-- Add reference_photo_url column to locations table
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS reference_photo_url text;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN locations.reference_photo_url IS 'URL or base64 data of a reference photo. When provided, the AI will reproduce this exact background/environment for maximum authenticity and recognizability.';