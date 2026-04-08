/*
  # Add Reference Photo to Avatars

  1. Changes
    - Add `reference_photo_url` column to `avatars` table
    - This column stores a reference photo of a real person that the AI will reproduce exactly in all try-ons

  2. Purpose
    - Allow users to upload a photo of themselves or someone else
    - The AI will use this photo to reproduce the exact same person in all generated images
    - Provides more accurate virtual try-ons with recognizable individuals
*/

-- Add reference_photo_url column to avatars table
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS reference_photo_url text;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN avatars.reference_photo_url IS 'URL or base64 data of a reference photo. When provided, the AI will reproduce this exact person in all try-ons for maximum accuracy and recognizability.';