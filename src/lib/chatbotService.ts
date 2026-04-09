import { ParsedCommand } from '../types/taskQueue';
import { callOpenAIProxy } from './geminiProxy';

const SYSTEM_PROMPT = `
Tu es un assistant de commande pour l'application EasyVinted.
Tu reçois des instructions en français d'un utilisateur et tu dois les convertir
en commandes structurées JSON.

## Vendeurs connus
Les vendeurs sont membres de la famille. Les noms courants incluent "Seb" et "Tom".
Utilise le champ seller_name avec le prénom exact tel qu'indiqué par l'utilisateur.

## Commandes disponibles
Mappe chaque instruction à l'un de ces command_type:

finalise_and_draft : "Finalise et publie [article] pour [vendeur]"
finalise_and_publish : "Finalise et mets en ligne [article] pour [vendeur]"
finalise_only : "Finalise la fiche [article] pour [vendeur], ne publie pas"
publish_next_draft : "Publie le prochain article pour [vendeur]"
publish_next_live : "Mets en ligne le prochain article pour [vendeur]"
list_articles : "Est-ce que j'ai des articles à publier pour [vendeur] ?"
publish_all_ready_draft : "Publie tous les articles ready pour [vendeur]"
publish_all_ready_live : "Mets en ligne tous les articles ready pour [vendeur]"
change_status : "Change le statut de [article] en [statut]"

## Statuts valides pour change_status
draft, ready, scheduled, published, sold, vinted_draft, reserved

## Format de réponse obligatoire (JSON uniquement, aucun texte autour)
{
  "command_type": "<type>",
  "seller_name": "<prénom du vendeur ou null>",
  "article_title": "<titre ou fragment du titre de l'article, ou null>",
  "params": {
    "target_status": "<nouveau statut si change_status, sinon omis>",
    "publish_mode": "<draft|live si applicable, sinon omis>"
  },
  "confidence": <0.0 à 1.0>,
  "error": "<message d'erreur si instruction incompréhensible, sinon omis>"
}

## Règles
- Si la confiance est inférieure à 0.5, inclure un champ "error" explicatif en français.
- Ne jamais inventer de nom de vendeur. Si aucun vendeur n'est mentionné, seller_name = null.
- article_title doit reprendre les mots clés de l'article mentionné, pas une invention.
- Réponds UNIQUEMENT avec le JSON, sans markdown, sans commentaires.
`.trim();

export async function parseUserInstruction(input: string): Promise<ParsedCommand> {
  const raw = await callOpenAIProxy(
    'gpt-4o-mini',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: input },
    ],
    0.1,
    300
  );

  try {
    return JSON.parse(raw) as ParsedCommand;
  } catch {
    throw new Error(`Réponse GPT non parseable: ${raw}`);
  }
}

export function describeCommand(parsed: ParsedCommand): string {
  const seller = parsed.seller_name ? ` pour ${parsed.seller_name}` : '';
  const article = parsed.article_title ? ` "${parsed.article_title}"` : '';
  const map: Record<string, string> = {
    finalise_and_draft: `Finaliser et sauvegarder en brouillon Vinted${article}${seller}`,
    finalise_and_publish: `Finaliser et mettre en ligne${article}${seller}`,
    finalise_only: `Finaliser la fiche${article}${seller} (sans publier)`,
    publish_next_draft: `Publier le prochain article en brouillon${seller}`,
    publish_next_live: `Mettre en ligne le prochain article${seller}`,
    list_articles: `Lister les articles${seller}`,
    publish_all_ready_draft: `Publier tous les articles ready en brouillon${seller}`,
    publish_all_ready_live: `Mettre en ligne tous les articles ready${seller}`,
    change_status: `Changer le statut${article} → "${parsed.params?.target_status}"${seller}`,
  };
  return map[parsed.command_type] ?? parsed.command_type;
}

export function commandToClaudeCodeString(parsed: ParsedCommand): string {
  const seller = parsed.seller_name ?? '[vendeur]';
  const article = parsed.article_title ? ` ${parsed.article_title}` : '';
  const map: Record<string, string> = {
    finalise_and_draft: `Finalise et publie${article} pour ${seller}`,
    finalise_and_publish: `Finalise et mets en ligne${article} pour ${seller}`,
    finalise_only: `Finalise la fiche${article} pour ${seller}, ne publie pas`,
    publish_next_draft: `Publie le prochain article pour ${seller}`,
    publish_next_live: `Mets en ligne le prochain article pour ${seller}`,
    list_articles: `Est-ce que j'ai des articles à publier pour ${seller} ?`,
    publish_all_ready_draft: `Publie tous les articles ready pour ${seller}`,
    publish_all_ready_live: `Mets en ligne tous les articles ready pour ${seller}`,
    change_status: `Change le statut de${article} en ${parsed.params?.target_status ?? '[statut]'}${parsed.seller_name ? ' pour ' + seller : ''}`,
  };
  return map[parsed.command_type] ?? parsed.command_type;
}
