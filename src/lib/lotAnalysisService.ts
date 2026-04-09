import { Article } from "../types/article";
import { callGeminiProxy } from "./geminiProxy";

export interface LotAnalysisResult {
  title: string;
  description: string;
  seo_keywords: string[];
  hashtags: string[];
  search_terms: string[];
  ai_confidence_score: number;
}

export const generateLotTitleAndDescription = async (
  articles: Article[],
  writingStyle?: string
): Promise<LotAnalysisResult> => {
  if (articles.length < 2) {
    throw new Error("Un lot doit contenir au moins 2 articles");
  }

  const model = 'gemini-2.5-flash';

  const articlesData = articles.map((article, index) => `
Article ${index + 1}:
- Titre: ${article.title || 'Non défini'}
- Description: ${article.description || 'Non définie'}
- Marque: ${article.brand || 'Sans marque'}
- Taille: ${article.size || 'Non définie'}
- Saison: ${article.season || 'Non définie'}
- État: ${article.condition || 'Non défini'}
- Prix: ${article.price || 0}€
- Couleur: ${article.color || 'Non définie'}
- Matière: ${article.material || 'Non définie'}
  `).join('\n---\n');

  const totalValue = articles.reduce((sum, a) => sum + (Number(a.price) || 0), 0);

  const writingStyleInstruction = writingStyle
    ? `\n\nSTYLE DE RÉDACTION DU VENDEUR:
Lorsque tu génères le titre et la description du lot, tu DOIS impérativement utiliser ce style de rédaction spécifique :
${writingStyle}

Ce style reflète la personnalité du vendeur et doit être respecté fidèlement.`
    : '';

  const prompt = `Tu es un assistant spécialisé dans l'analyse et la rédaction d'annonces de lots Vinted.
Tu ne dois jamais analyser d'images. Tu travailles uniquement à partir des données textuelles fournies.${writingStyleInstruction}

## CONTEXTE
L'utilisateur a créé un lot composé de ${articles.length} articles.
Voici la liste complète des articles avec leurs informations :

${articlesData}

## VALEUR TOTALE DU LOT
${totalValue.toFixed(2)}€

## OBJECTIFS

### 1. ANALYSER L'ENSEMBLE DU LOT
Identifie automatiquement :
- Les marques présentes
- Les tailles
- Les saisons
- La valeur totale cumulée du lot
- Les points communs (type de vêtements, usage, saison, style)

### 2. GÉNÉRER UN TITRE DE LOT
Le titre doit :
- Refléter l'ensemble du lot, pas un article isolé
- Mentionner le nombre d'articles
- Mentionner le type principal des articles
- Être concis et accrocheur (max 60 caractères)

Exemples de bon titre :
- "Lot 3 articles – T-shirts et jean – Taille M"
- "Lot 5 pièces – Vêtements d'été femme – Taille 38"
- "Lot 4 articles – Marques Nike et Adidas – Taille S"

### 3. GÉNÉRER UNE DESCRIPTION COMPLÈTE

La description DOIT mentionner CHAQUE ARTICLE INDIVIDUELLEMENT, sans exception.

Structure OBLIGATOIRE :

#### a) Introduction (2-3 phrases)
Présentation synthétique du lot : contenu global, usage, saison.

#### b) Détail des articles
Liste CHAQUE article séparément avec :
- Type / titre
- Marque
- Taille
- État
- Prix individuel

Format : "📦 Article 1 : [Type] [Marque] taille [Taille], état [État] - [Prix]€"

## CONTRAINTES STRICTES

❌ Ne pas mentionner ni analyser les images
❌ Ne pas inventer d'informations absentes
✅ Le titre doit représenter tout le lot
✅ La description doit mentionner CHAQUE article individuellement
✅ Ton style doit être clair, vendeur et adapté à une annonce Vinted
✅ Utilise des emojis pour rendre la description plus attractive

## FORMAT DE RÉPONSE

Génère :
1. Le titre du lot
2. La description complète du lot
3. Les données SEO & Marketing :
   - seo_keywords: 8-12 mots-clés SEO optimisés (marques, types d'articles, couleurs, tailles, saisons)
   - hashtags: 5-8 hashtags tendances pour les réseaux sociaux (sans le #, ex: "vetementsfemme", "mode", "soldes")
   - search_terms: 6-10 termes de recherche courants utilisés par les acheteurs (expressions naturelles, ex: "lot vetements ete", "tshirts marque")
   - ai_confidence_score: ton niveau de confiance dans l'analyse (0-100, basé sur la qualité et complétude des données articles)

Réponds TOUJOURS en français.`;

  try {
    const response = await callGeminiProxy(
      model,
      { parts: [{ text: prompt }] },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            seo_keywords: { type: "ARRAY", items: { type: "STRING" } },
            hashtags: { type: "ARRAY", items: { type: "STRING" } },
            search_terms: { type: "ARRAY", items: { type: "STRING" } },
            ai_confidence_score: { type: "NUMBER" }
          },
          required: ["title", "description", "seo_keywords", "hashtags", "search_terms", "ai_confidence_score"]
        }
      }
    );

    if ('text' in response && response.text) {
      const parsed = JSON.parse(response.text);
      let confidenceScore = parsed.ai_confidence_score || 0;
      if (confidenceScore > 0 && confidenceScore <= 1) {
        confidenceScore = Math.round(confidenceScore * 100);
      }
      return {
        title: parsed.title || '',
        description: parsed.description || '',
        seo_keywords: parsed.seo_keywords || [],
        hashtags: parsed.hashtags || [],
        search_terms: parsed.search_terms || [],
        ai_confidence_score: confidenceScore
      };
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Lot analysis failed:", error);

    if (error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Quota Gemini dépassé pour l\'analyse. Veuillez réessayer plus tard.');
    }

    if (error?.message?.includes('API key')) {
      throw new Error('Clé API Gemini invalide ou manquante. Vérifiez VITE_GEMINI_API_KEY dans votre fichier .env');
    }

    throw error;
  }
};
