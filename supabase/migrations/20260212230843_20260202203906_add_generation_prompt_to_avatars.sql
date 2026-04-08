/*
  # Ajout du champ generation_prompt à la table avatars

  ## Changements
  
  1. Ajout de la colonne `generation_prompt` (text) à la table `avatars`
     - Contient le prompt utilisé pour générer la photo du modèle
     - Permet de consulter les prompts après rechargement de la page
     - Nullable car les avatars existants n'ont pas ce champ

  ## Note
  
  Ce champ stocke le prompt complet utilisé lors de la génération de l'image
  par l'IA, permettant aux utilisateurs de consulter comment leur modèle
  a été créé.
*/

-- Ajout de la colonne generation_prompt
ALTER TABLE public.avatars
ADD COLUMN IF NOT EXISTS generation_prompt text;

-- Commentaire explicatif
COMMENT ON COLUMN public.avatars.generation_prompt IS 'Prompt IA utilisé pour générer la photo du modèle';