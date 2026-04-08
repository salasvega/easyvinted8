/*
  # Create stylist_photos table for Virtual Stylist montages

  1. New Tables
    - `stylist_photos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, name of the montage)
      - `photo_base64` (text, the montage image in base64)
      - `avatar_id` (uuid, nullable, reference to the avatar used)
      - `location_id` (uuid, nullable, reference to the location/background used)
      - `article_id` (uuid, nullable, reference to the dressing article used)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `stylist_photos` table
    - Add policy for authenticated users to read their own photos
    - Add policy for authenticated users to insert their own photos
    - Add policy for authenticated users to update their own photos
    - Add policy for authenticated users to delete their own photos
*/

CREATE TABLE IF NOT EXISTS stylist_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_base64 text NOT NULL,
  avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stylist_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stylist photos"
  ON stylist_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stylist photos"
  ON stylist_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stylist photos"
  ON stylist_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stylist photos"
  ON stylist_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stylist_photos_user_id ON stylist_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_stylist_photos_created_at ON stylist_photos(created_at DESC);