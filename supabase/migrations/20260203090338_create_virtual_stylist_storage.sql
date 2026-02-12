/*
  # Migration du Virtual Stylist vers Supabase Storage

  ## Changements
  
  1. Création du bucket storage 'virtual-stylist'
  2. Ajout de colonnes photo_url pour remplacer photo_base64
  3. Politiques RLS pour le storage
  
  ## Tables modifiées
  - `avatars` : ajout de photo_url
  - `locations` : ajout de photo_url
  - `stylist_photos` : ajout de photo_url
  
  ## Sécurité
  - Les utilisateurs peuvent uploader leurs propres images
  - Les utilisateurs ne peuvent voir que leurs propres images
*/

-- Créer le bucket storage s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('virtual-stylist', 'virtual-stylist', false)
ON CONFLICT (id) DO NOTHING;

-- Ajouter les colonnes photo_url
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE stylist_photos ADD COLUMN IF NOT EXISTS photo_url text;

-- Politiques de storage pour virtual-stylist
CREATE POLICY "Users can upload their own avatar images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'virtual-stylist' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'virtual-stylist' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'virtual-stylist' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'virtual-stylist' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
