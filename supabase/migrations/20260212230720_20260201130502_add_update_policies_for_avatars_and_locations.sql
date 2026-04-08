/*
  # Add UPDATE policies for avatars and locations tables

  1. Changes
    - Add UPDATE policy for `avatars` table to allow public updates
    - Add UPDATE policy for `locations` table to allow public updates

  2. Security
    - These tables are used for the Virtual Stylist feature which operates without authentication
    - Policies allow public access consistent with existing INSERT, SELECT, DELETE policies
*/

CREATE POLICY "Modification publique des avatars"
  ON avatars
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Modification publique des lieux"
  ON locations
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);