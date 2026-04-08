/*
  # Création des tables pour le Styliste Virtuel

  ## Tables créées
  
  ### 1. `avatars` (Modèles générés par IA)
  - `id` (uuid, primary key) - Identifiant unique du modèle
  - `created_at` (timestamptz) - Date de création
  - `name` (text) - Nom du projet/modèle
  - `gender` (text) - Genre (feminine/masculine)
  - `age_group` (text) - Groupe d'âge (baby/child/teen/adult/senior)
  - `origin` (text) - Origine ethnique (african/east_asian/south_asian/caucasian/hispanic/middle_eastern)
  - `skin_tone` (text) - Carnation (porcelain, fair, medium, tan, dark, deep, etc.)
  - `hair_color` (text) - Couleur de cheveux (platinum, blonde, brown, black, etc.)
  - `hair_cut` (text) - Coupe de cheveux (bald/short/medium/long)
  - `hair_texture` (text) - Texture des cheveux (straight/wavy/curly/coily)
  - `eye_color` (text) - Couleur des yeux (blue, green, brown, grey, honey, black)
  - `build` (text) - Silhouette (slim/average/athletic/curvy)
  - `additional_features` (text) - Caractéristiques additionnelles
  - `photo_base64` (text) - Image du modèle en base64
  
  ### 2. `locations` (Décors/Lieux de shooting)
  - `id` (uuid, primary key) - Identifiant unique du lieu
  - `created_at` (timestamptz) - Date de création
  - `name` (text) - Nom du lieu
  - `description` (text) - Description du lieu
  - `photo_base64` (text) - Image du décor en base64

  ## Sécurité
  - RLS activé sur les deux tables
  - Politiques publiques pour permettre lecture/création/suppression
  - Pas d'authentification requise (application standalone)
*/

-- Création de la table avatars
CREATE TABLE IF NOT EXISTS public.avatars (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL,
  gender text,
  age_group text,
  origin text,
  skin_tone text,
  hair_color text,
  hair_cut text,
  hair_texture text,
  eye_color text,
  build text,
  additional_features text,
  photo_base64 text
);

-- Création de la table locations
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL,
  description text,
  photo_base64 text
);

-- Activation de RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Politiques pour avatars (accès public complet)
CREATE POLICY "Lecture publique des avatars"
  ON public.avatars
  FOR SELECT
  USING (true);

CREATE POLICY "Création publique des avatars"
  ON public.avatars
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Suppression publique des avatars"
  ON public.avatars
  FOR DELETE
  USING (true);

-- Politiques pour locations (accès public complet)
CREATE POLICY "Lecture publique des lieux"
  ON public.locations
  FOR SELECT
  USING (true);

CREATE POLICY "Création publique des lieux"
  ON public.locations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Suppression publique des lieux"
  ON public.locations
  FOR DELETE
  USING (true);

-- Création d'index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_avatars_created_at ON public.avatars(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON public.locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avatars_name ON public.avatars(name);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);