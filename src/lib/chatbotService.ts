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

### Commandes immédiates articles (exécutées instantanément)
change_status : "Change le statut de [article] en [statut]" / "Passe [article] en [statut]"
update_price : "Change le prix de [article] à [X] euros" / "Mets le prix de [article] à [X]€" / "Passe [article] à [X]€"
update_condition : "Change l'état de [article] en [état]"
update_season : "Change la saison de [article] en [saison]"
update_brand : "Change la marque de [article] en [marque]" / "La marque de [article] c'est [marque]"
update_title : "Change le titre de [article] en [nouveau titre]" / "Renomme [article] en [nouveau titre]"
update_description : "Change la description de [article]" / "Décris [article] comme [description]" / "Mets la description de [article] à [description]"
mark_sold : "Marque [article] comme vendu" / "Vendu [article] à [X] euros pour [acheteur]"
mark_reserved : "Réserve [article] pour [acheteur]" / "Marque [article] comme réservé"
schedule_article : "Programme [article] pour le [date]"
count_articles : "Combien d'articles [statut] j'ai pour [vendeur] ?" / "Montre moi mes articles [statut]"
update_publish_mode : "Change le mode de publication de [article] en brouillon/en ligne"

### Commandes immédiates lots (exécutées instantanément)
create_lot : "Crée un lot avec [article1] et [article2]" / "Fais un lot avec [article1], [article2] et [article3]" / "Regroupe [article1] et [article2] dans un lot"
update_lot_price : "Change le prix du lot [nom_lot] à [X]€" / "Mets le lot [nom_lot] à [X]€"
update_lot_status : "Passe le lot [nom_lot] en [statut]" / "Change le statut du lot [nom_lot] en [statut]"
schedule_lot : "Programme le lot [nom_lot] pour le [date]"
mark_lot_sold : "Marque le lot [nom_lot] comme vendu à [X]€"

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

## Statuts valides pour update_lot_status
draft, ready, scheduled, published, sold

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
  "article_title": "<titre ou fragment du titre de l'article principal, ou null>",
  "params": {
    "target_status": "<nouveau statut si change_status ou update_lot_status, sinon omis>",
    "publish_mode": "<draft|live si update_publish_mode, sinon omis>",
    "new_price": <nombre si update_price, sinon omis>,
    "new_condition": "<état si update_condition, sinon omis>",
    "new_season": "<saison si update_season, sinon omis>",
    "new_brand": "<marque si update_brand, sinon omis>",
    "new_title": "<nouveau titre complet si update_title, sinon omis>",
    "new_description": "<nouvelle description complète si update_description, sinon omis>",
    "sold_price": <nombre si mark_sold ou mark_lot_sold et prix mentionné, sinon omis>,
    "buyer_name": "<nom acheteur si mark_sold, mark_reserved, mark_lot_sold et nom mentionné, sinon omis>",
    "scheduled_date": "<date ISO si schedule_article ou schedule_lot, sinon omis>",
    "target_status_filter": "<statut à filtrer pour count_articles, sinon omis>",
    "lot_name": "<nom du lot si create_lot, update_lot_price, update_lot_status, schedule_lot, mark_lot_sold - génère un nom descriptif automatiquement pour create_lot>",
    "lot_article_titles": ["<titre article 1>", "<titre article 2>", ...],
    "lot_price": <nombre si create_lot et prix mentionné, sinon omis>,
    "lot_discount": <pourcentage de remise si create_lot et remise mentionnée, sinon omis>
  },
  "confidence": <0.0 à 1.0>,
  "error": "<message d'erreur si instruction incompréhensible, sinon omis>"
}

## Règles importantes
- IMPORTANT : Réponds UNIQUEMENT avec le JSON brut, sans aucun bloc markdown, sans \`\`\`json, sans aucun texte avant ou après.
- Si la confiance est inférieure à 0.5, inclure un champ "error" explicatif en français.
- Ne jamais inventer de nom de vendeur. Si aucun vendeur n'est mentionné, seller_name = null.
- article_title doit reprendre les mots clés de l'article mentionné, pas une invention.
- Pour count_articles et create_lot, article_title = null (utilise lot_article_titles à la place pour create_lot).
- Pour schedule_article et schedule_lot, convertir la date en format ISO 8601 (YYYY-MM-DDTHH:mm:ss).
- "Passe [article] en Prêt" ou "en Pret" signifie change_status avec target_status = "ready".
- "ready", "Prêt", "Pret", "prêt", "pret" → target_status = "ready".
- "draft", "Brouillon", "brouillon" → target_status = "draft".
- "published", "En ligne", "en ligne" → target_status = "published".
- "sold", "Vendu", "vendu" → target_status = "sold".
- Pour create_lot : liste tous les titres d'articles dans lot_article_titles. Génère automatiquement un lot_name descriptif basé sur les articles (ex: "Lot robes été", "Lot vêtements enfant").
- Pour update_lot_price, update_lot_status, schedule_lot, mark_lot_sold : article_title = null, utilise le nom du lot dans params.lot_name.
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
  const lotName = parsed.params?.lot_name ? ` "${parsed.params.lot_name}"` : '';
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
    update_brand: `Mettre à jour la marque${article} → "${parsed.params?.new_brand}"${seller}`,
    update_title: `Renommer${article} → "${parsed.params?.new_title}"${seller}`,
    update_description: `Mettre à jour la description${article}${seller}`,
    mark_sold: `Marquer comme vendu${article}${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}${parsed.params?.buyer_name ? ` (${parsed.params.buyer_name})` : ''}${seller}`,
    mark_reserved: `Réserver${article}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}${seller}`,
    schedule_article: `Programmer${article} pour le ${parsed.params?.scheduled_date ? new Date(parsed.params.scheduled_date).toLocaleDateString('fr-FR') : '?'}${seller}`,
    count_articles: `Compter les articles${parsed.params?.target_status_filter ? ` "${parsed.params.target_status_filter}"` : ''}${seller}`,
    update_publish_mode: `Changer le mode de publication${article} → "${parsed.params?.publish_mode}"${seller}`,
    create_lot: `Créer le lot${lotName} avec ${(parsed.params?.lot_article_titles ?? []).length} article(s)${seller}`,
    update_lot_price: `Mettre à jour le prix du lot${lotName} → ${parsed.params?.lot_price}€${seller}`,
    update_lot_status: `Changer le statut du lot${lotName} → "${parsed.params?.target_status}"${seller}`,
    schedule_lot: `Programmer le lot${lotName} pour le ${parsed.params?.scheduled_date ? new Date(parsed.params.scheduled_date).toLocaleDateString('fr-FR') : '?'}${seller}`,
    mark_lot_sold: `Marquer le lot${lotName} comme vendu${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}${seller}`,
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
    update_brand: `Change la marque de${article} en ${parsed.params?.new_brand ?? '[marque]'}${parsed.seller_name ? ' pour ' + seller : ''}`,
    update_title: `Renomme${article} en ${parsed.params?.new_title ?? '[titre]'}${parsed.seller_name ? ' pour ' + seller : ''}`,
    update_description: `Change la description de${article}${parsed.seller_name ? ' pour ' + seller : ''}`,
    mark_sold: `Marque${article} comme vendu${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}`,
    mark_reserved: `Réserve${article}${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}`,
    schedule_article: `Programme${article} pour le ${parsed.params?.scheduled_date ?? '[date]'}`,
    count_articles: `Combien d'articles ${parsed.params?.target_status_filter ?? ''}${parsed.seller_name ? ' pour ' + seller : ''} ?`,
    update_publish_mode: `Change le mode de publication de${article} en ${parsed.params?.publish_mode ?? '[mode]'}`,
    create_lot: `Crée un lot "${parsed.params?.lot_name ?? '[nom]'}" avec ${(parsed.params?.lot_article_titles ?? []).join(', ')}`,
    update_lot_price: `Change le prix du lot "${parsed.params?.lot_name ?? '[lot]'}" à ${parsed.params?.lot_price ?? '[prix]'}€`,
    update_lot_status: `Change le statut du lot "${parsed.params?.lot_name ?? '[lot]'}" en ${parsed.params?.target_status ?? '[statut]'}`,
    schedule_lot: `Programme le lot "${parsed.params?.lot_name ?? '[lot]'}" pour le ${parsed.params?.scheduled_date ?? '[date]'}`,
    mark_lot_sold: `Marque le lot "${parsed.params?.lot_name ?? '[lot]'}" comme vendu${parsed.params?.sold_price != null ? ` à ${parsed.params.sold_price}€` : ''}`,
  };
  return map[parsed.command_type] ?? parsed.command_type;
}

export const IMMEDIATE_COMMAND_TYPES = new Set<string>([
  'change_status',
  'update_price',
  'update_condition',
  'update_season',
  'update_brand',
  'update_title',
  'update_description',
  'mark_sold',
  'mark_reserved',
  'schedule_article',
  'count_articles',
  'update_publish_mode',
  'create_lot',
  'update_lot_price',
  'update_lot_status',
  'schedule_lot',
  'mark_lot_sold',
]);
