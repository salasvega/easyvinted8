import { ParsedCommand } from '../types/taskQueue';
import { callGeminiProxy } from './geminiProxy';

const SYSTEM_PROMPT = `
Tu es un assistant de commande pour l'application EasyVinted.
Tu reçois des instructions en français d'un utilisateur et tu dois les convertir
en commandes structurées JSON.

## Vendeurs connus
Les vendeurs sont membres de la famille. Les noms courants incluent "Seb" et "Tom".
Utilise le champ seller_name avec le prénom exact tel qu'indiqué par l'utilisateur.

## Commandes disponibles
Mappe chaque instruction à l'un de ces command_type:

### Commandes immédiates (exécutées instantanément, sans intervention externe)
change_status : "Change le statut de [article] en [statut]"
update_price : "Change le prix de [article] à [X] euros" / "Mets le prix de [article] à [X]€" / "Passe [article] à [X]€"
update_condition : "Change l'état de [article] en [état]"
update_season : "Change la saison de [article] en [saison]"
mark_sold : "Marque [article] comme vendu" / "Vendu [article] à [X] euros pour [acheteur]"
mark_reserved : "Réserve [article] pour [acheteur]" / "Marque [article] comme réservé"
schedule_article : "Programme [article] pour le [date]"
count_articles : "Combien d'articles [statut] j'ai pour [vendeur] ?" / "Montre moi mes articles [statut]"
update_publish_mode : "Change le mode de publication de [article] en brouillon/en ligne"

### Commandes avec file d'attente (nécessitent Claude Code ou Vinted)
finalise_and_draft : "Finalise et publie [article] pour [vendeur]"
finalise_and_publish : "Finalise et mets en ligne [article] pour [vendeur]"
finalise_only : "Finalise la fiche [article] pour [vendeur], ne publie pas"
publish_next_draft : "Publie le prochain article pour [vendeur]"
publish_next_live : "Mets en ligne le prochain article pour [vendeur]"
list_articles : "Est-ce que j'ai des articles à publier pour [vendeur] ?"
publish_all_ready_draft : "Publie tous les articles ready pour [vendeur]"
publish_all_ready_live : "Mets en ligne tous les articles ready pour [vendeur]"

## Statuts valides pour change_status et count_articles
draft, ready, scheduled, published, sold, vinted_draft, reserved

## États valides pour update_condition
new_with_tags, new_without_tags, very_good, good, satisfactory

## Saisons valides pour update_season
spring, summer, autumn, winter, all-seasons

## Modes de publication valides pour update_publish_mode
draft, live

## Format de réponse obligatoire (JSON uniquement, aucun texte autour, aucun markdown)
{
  "command_type": "<type>",
  "seller_name": "<prénom du vendeur ou null>",
  "article_title": "<titre ou fragment du titre de l'article, ou null>",
  "params": {
    "target_status": "<nouveau statut si change_status, sinon omis>",
    "publish_mode": "<draft|live si update_publish_mode, sinon omis>",
    "new_price": <nombre si update_price, sinon omis>,
    "new_condition": "<état si update_condition, sinon omis>",
    "new_season": "<saison si update_season, sinon omis>",
    "sold_price": <nombre si mark_sold et prix mentionné, sinon omis>,
    "buyer_name": "<nom acheteur si mark_sold ou mark_reserved et nom mentionné, sinon omis>",
    "scheduled_date": "<date ISO si schedule_article, sinon omis>",
    "target_status_filter": "<statut à filtrer pour count_articles, sinon omis>"
  },
  "confidence": <0.0 à 1.0>,
  "error": "<message d'erreur si instruction incompréhensible, sinon omis>"
}

## Règles
- IMPORTANT : Réponds UNIQUEMENT avec le JSON brut, sans aucun bloc markdown, sans \`\`\`json, sans aucun texte avant ou après.
- Si la confiance est inférieure à 0.5, inclure un champ "error" explicatif en français.
- Ne jamais inventer de nom de vendeur. Si aucun vendeur n'est mentionné, seller_name = null.
- article_title doit reprendre les mots clés de l'article mentionné, pas une invention.
- Pour count_articles, article_title = null.
- Pour schedule_article, convertir la date en format ISO 8601 (YYYY-MM-DDTHH:mm:ss).
- "Passe [article] en Prêt" signifie change_status avec target_status = "ready".
- "Passe [article] à [X]€" signifie update_price avec new_price = X.
- Si l'instruction contient à la fois un changement de statut ET un changement de prix, privilégie update_price pour le prix et génère une commande change_status séparée — mais puisque tu ne peux retourner qu'une seule commande, retourne update_price ET note dans article_title le contexte complet.
`.trim();

function extractJson(raw: string): string {
  const cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export async function parseUserInstruction(input: string): Promise<ParsedCommand> {
  const result = await callGeminiProxy(
    'gemini-2.5-flash',
    [
      { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nInstruction utilisateur: ${input}` }] },
    ],
    {
      temperature: 0.1,
      maxOutputTokens: 512,
    }
  );

  if ('text' in result && result.text) {
    const json = extractJson(result.text);
    try {
      return JSON.parse(json) as ParsedCommand;
    } catch {
      throw new Error(`Réponse Gemini non parseable: ${result.text.substring(0, 200)}`);
    }
  }

  throw new Error('Réponse Gemini invalide ou vide');
}

export function describeCommand(parsed: ParsedCommand): string {
  const seller = parsed.seller_name ? ` pour ${parsed.seller_name}` : '';
  const article = parsed.article_title ? ` "${parsed.article_title}"` : '';
  const conditionLabels: Record<string, string> = {
    new_with_tags: 'Neuf avec étiquettes',
    new_without_tags: 'Neuf sans étiquettes',
    very_good: 'Très bon état',
    good: 'Bon état',
    satisfactory: 'État satisfaisant',
  };
  const seasonLabels: Record<string, string> = {
    spring: 'Printemps',
    summer: 'Été',
    autumn: 'Automne',
    winter: 'Hiver',
    'all-seasons': 'Toutes saisons',
  };
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
    update_price: `Mettre à jour le prix${article} → ${parsed.params?.new_price}€${seller}`,
    update_condition: `Mettre à jour l'état${article} → "${conditionLabels[parsed.params?.new_condition ?? ''] ?? parsed.params?.new_condition}"${seller}`,
    update_season: `Mettre à jour la saison${article} → "${seasonLabels[parsed.params?.new_season ?? ''] ?? parsed.params?.new_season}"${seller}`,
    mark_sold: `Marquer comme vendu${article}${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}${parsed.params?.buyer_name ? ` (${parsed.params.buyer_name})` : ''}${seller}`,
    mark_reserved: `Réserver${article}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}${seller}`,
    schedule_article: `Programmer${article} pour le ${parsed.params?.scheduled_date ? new Date(parsed.params.scheduled_date).toLocaleDateString('fr-FR') : '?'}${seller}`,
    count_articles: `Compter les articles${parsed.params?.target_status_filter ? ` "${parsed.params.target_status_filter}"` : ''}${seller}`,
    update_publish_mode: `Changer le mode de publication${article} → "${parsed.params?.publish_mode}"${seller}`,
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
    update_price: `Change le prix de${article} à ${parsed.params?.new_price ?? '[prix]'}€${parsed.seller_name ? ' pour ' + seller : ''}`,
    update_condition: `Change l'état de${article} en ${parsed.params?.new_condition ?? '[état]'}${parsed.seller_name ? ' pour ' + seller : ''}`,
    update_season: `Change la saison de${article} en ${parsed.params?.new_season ?? '[saison]'}${parsed.seller_name ? ' pour ' + seller : ''}`,
    mark_sold: `Marque${article} comme vendu${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}`,
    mark_reserved: `Réserve${article}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}`,
    schedule_article: `Programme${article} pour le ${parsed.params?.scheduled_date ?? '[date]'}`,
    count_articles: `Combien d'articles ${parsed.params?.target_status_filter ?? ''}${parsed.seller_name ? ' pour ' + seller : ''} ?`,
    update_publish_mode: `Change le mode de publication de${article} en ${parsed.params?.publish_mode ?? '[mode]'}`,
  };
  return map[parsed.command_type] ?? parsed.command_type;
}

export const IMMEDIATE_COMMAND_TYPES = new Set<string>([
  'change_status',
  'update_price',
  'update_condition',
  'update_season',
  'mark_sold',
  'mark_reserved',
  'schedule_article',
  'count_articles',
  'update_publish_mode',
]);
