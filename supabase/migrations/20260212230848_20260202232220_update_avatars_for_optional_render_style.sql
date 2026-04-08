/*
  # Mise à jour de la table avatars pour render_style optionnel et model_signature

  1. Modifications
    - Rendre la colonne `render_style` nullable (permettre NULL)
    - Ajouter la colonne `model_signature` (text, nullable)
    - Ajouter la colonne `parent_avatar_id` (uuid, nullable) si elle n'existe pas
    - Ajouter la colonne `generation_prompt` (text, nullable) si elle n'existe pas

  2. Raisons des changements
    - `render_style` nullable: permet aux utilisateurs de ne pas appliquer de style de transformation
    - `model_signature`: permet de définir des détails spécifiques (accessoires, tenue, pose)
    - `parent_avatar_id`: pour tracer les versions dérivées d'un modèle
    - `generation_prompt`: pour stocker le prompt complet utilisé pour la génération

  3. Notes
    - Les avatars existants conservent leur render_style actuel
    - Les nouvelles valeurs NULL sont maintenant acceptées
    - model_signature est optionnel (NULL par défaut)
*/

-- Rendre render_style nullable
ALTER TABLE public.avatars ALTER COLUMN render_style DROP NOT NULL;

-- Ajouter model_signature si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'model_signature'
  ) THEN
    ALTER TABLE public.avatars ADD COLUMN model_signature text;
  END IF;
END $$;

-- Ajouter parent_avatar_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'parent_avatar_id'
  ) THEN
    ALTER TABLE public.avatars ADD COLUMN parent_avatar_id uuid REFERENCES public.avatars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ajouter generation_prompt si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'generation_prompt'
  ) THEN
    ALTER TABLE public.avatars ADD COLUMN generation_prompt text;
  END IF;
END $$;

-- Ajouter un index pour parent_avatar_id si la colonne existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'avatars' AND column_name = 'parent_avatar_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_avatars_parent_avatar_id ON public.avatars(parent_avatar_id);
  END IF;
END $$;

-- Ajouter une politique de mise à jour pour les avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatars' AND policyname = 'Mise à jour publique des avatars'
  ) THEN
    CREATE POLICY "Mise à jour publique des avatars"
      ON public.avatars
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;