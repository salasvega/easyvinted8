/*
  # Rendre le bucket virtual-stylist public pour l'affichage des images

  ## Problème identifié
  Le bucket 'virtual-stylist' était configuré comme privé (public = false), 
  ce qui empêche l'affichage des images même avec getPublicUrl().
  
  ## Solution
  1. Mettre le bucket en mode public pour permettre l'affichage des avatars, locations et photos
  2. Les politiques RLS existantes continuent de protéger l'upload/modification/suppression
  3. Seule la lecture devient publique, ce qui est approprié pour un stylist virtuel
  
  ## Sécurité
  - Upload: Toujours restreint aux utilisateurs authentifiés (leurs propres fichiers)
  - Update/Delete: Toujours restreint aux propriétaires
  - Read: Maintenant public pour permettre l'affichage des images générées
*/

-- Mettre le bucket virtual-stylist en mode public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'virtual-stylist';
