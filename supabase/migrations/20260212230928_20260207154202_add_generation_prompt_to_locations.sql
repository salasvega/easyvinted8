/*
  # Ajout du champ generation_prompt à la table locations

  1. Modifications
    - Ajout de la colonne `generation_prompt` (text) à la table `locations`
    - Ce champ stocke le prompt IA optimisé utilisé pour générer le fond
    - Permet de conserver une trace du prompt exact utilisé pour la génération

  2. Objectif
    - Aligner la gestion des fonds avec celle des avatars
    - Permettre l'optimisation automatique des descriptions fournies par l'utilisateur
    - Faciliter la reproduction et l'amélioration des générations futures
*/

-- Ajout de la colonne generation_prompt
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS generation_prompt text;

COMMENT ON COLUMN public.locations.generation_prompt IS 'Prompt IA optimisé utilisé pour générer le fond';