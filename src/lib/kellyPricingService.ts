import { supabase } from './supabase';
import { Article } from '../types/article';
import { GoogleGenAI } from '@google/genai';

export type PricingInsightType =
  | 'overpriced'
  | 'underpriced'
  | 'optimal_price'
  | 'price_test'
  | 'bundle_opportunity'
  | 'psychological_pricing';

export interface PricingInsight {
  id: string;
  type: PricingInsightType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionLabel: string;
  articleIds: string[];
  suggestedAction: {
    type: 'adjust_price' | 'create_bundle' | 'test_price';
    currentPrice?: number;
    suggestedPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    reasoning?: string;
    confidence?: number;
    marketData?: {
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      salesLast30d?: number;
    };
  };
  status: 'active' | 'dismissed' | 'completed';
  createdAt: string;
  expiresAt: string;
}

const CACHE_DURATION_MINUTES = 30;
const CACHE_KEY = 'pricing_insights';

function getAI() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

function buildPricingAnalysisPrompt(articles: Article[], soldArticles: Article[]): string {
  const articlesData = articles.map(a => ({
    id: a.id,
    title: a.title,
    brand: a.brand,
    category: a.title.split(' ')[0],
    condition: a.condition,
    price: a.price,
    status: a.status,
    season: a.season,
    color: a.color,
    material: a.material,
    suggestedMin: a.suggested_price_min,
    suggestedMax: a.suggested_price_max,
  }));

  const soldData = soldArticles.map(a => ({
    brand: a.brand,
    condition: a.condition,
    soldPrice: a.sold_price,
    originalPrice: a.price,
  }));

  return `Tu es Kelly, experte en pricing pour Vinted. Analyse les prix de ces articles et génère des insights actionables.

📊 ARTICLES ACTIFS (${articles.length}):
${JSON.stringify(articlesData, null, 2)}

💰 HISTORIQUE VENTES (${soldArticles.length} dernières):
${JSON.stringify(soldData, null, 2)}

🎯 MISSION:
Identifie 3-5 insights de prix CONCRETS et ACTIONNABLES:

1. **Sous-évalués** (underpriced): Articles dont le prix est 20%+ sous le marché
2. **Sur-évalués** (overpriced): Articles 20%+ au-dessus du marché (à baisser)
3. **Prix optimal** (optimal_price): Prix parfait, félicite l'utilisateur
4. **Opportunités de lot** (bundle_opportunity): 3+ articles similaires à grouper
5. **Prix psychologiques** (psychological_pricing): 20€→19€ ou 45€→49€

⚠️ RÈGLES STRICTES:
- Sois PRÉCIS sur les montants (ex: "18€ au lieu de 15€")
- Base-toi sur brand, condition, marché Vinted réel
- Priorité HIGH = opportunité >10€ de gain
- Priorité MEDIUM = opportunité 5-10€
- Priorité LOW = optimisations <5€
- IMPORTANT: Ne suggère que des prix réalistes pour Vinted (généralement entre 5€ et 50€)

📝 FORMAT DE RÉPONSE (JSON strict):
{
  "insights": [
    {
      "type": "underpriced",
      "priority": "high",
      "title": "Nike Air Max sous-évaluée",
      "message": "Ta paire de Nike Air Max est à 15€ alors que le marché est à 25-30€ pour ce modèle en bon état. Tu perds 10-15€ !",
      "actionLabel": "Ajuster à 25€",
      "articleIds": ["article-id"],
      "suggestedAction": {
        "type": "adjust_price",
        "currentPrice": 15,
        "suggestedPrice": 25,
        "minPrice": 22,
        "maxPrice": 30,
        "reasoning": "Marché Nike Air Max en bon état: 25-30€. Ton prix actuel est 40% sous le marché.",
        "confidence": 0.85,
        "marketData": {
          "avgPrice": 27,
          "minPrice": 22,
          "maxPrice": 32
        }
      }
    }
  ]
}

GÉNÈRE MAINTENANT 3-5 INSIGHTS CONCRETS:`;
}

async function generatePricingInsightsWithAI(articles: Article[], soldArticles: Article[]): Promise<PricingInsight[]> {
  try {
    const ai = getAI();
    const prompt = buildPricingAnalysisPrompt(articles, soldArticles);

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const result = response.text;
    const parsed = JSON.parse(result);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_MINUTES * 60 * 1000);

    return parsed.insights.map((insight: any) => ({
      id: crypto.randomUUID(),
      ...insight,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error generating pricing insights:', error);
    throw new Error('Impossible de générer les insights de prix. Réessaie dans quelques instants.');
  }
}

async function savePricingInsightsToDatabase(userId: string, insights: PricingInsight[]): Promise<void> {
  await supabase.from('kelly_insights').delete().match({
    user_id: userId,
    cache_key: CACHE_KEY,
  });

  const records = insights.map(insight => ({
    user_id: userId,
    type: insight.type,
    priority: insight.priority,
    title: insight.title,
    message: insight.message,
    action_label: insight.actionLabel,
    article_ids: insight.articleIds,
    suggested_action: insight.suggestedAction,
    status: insight.status,
    cache_key: CACHE_KEY,
    expires_at: insight.expiresAt,
  }));

  const { error } = await supabase.from('kelly_insights').insert(records);

  if (error) {
    console.error('Error saving pricing insights:', error);
    throw new Error('Impossible de sauvegarder les insights');
  }
}

async function loadPricingInsightsFromDatabase(userId: string): Promise<PricingInsight[] | null> {
  const { data, error } = await supabase
    .from('kelly_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('cache_key', CACHE_KEY)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error loading pricing insights:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data.map(record => ({
    id: record.id,
    type: record.type as PricingInsightType,
    priority: record.priority as 'high' | 'medium' | 'low',
    title: record.title,
    message: record.message,
    actionLabel: record.action_label,
    articleIds: record.article_ids || [],
    suggestedAction: record.suggested_action,
    status: record.status as 'active' | 'dismissed' | 'completed',
    createdAt: record.created_at,
    expiresAt: record.expires_at,
  }));
}

export async function getPricingInsights(
  userId: string,
  forceRefresh = false
): Promise<PricingInsight[]> {
  if (!forceRefresh) {
    const cached = await loadPricingInsightsFromDatabase(userId);
    if (cached) {
      return cached;
    }
  }

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['draft', 'ready', 'scheduled', 'published'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (articlesError || !articles) {
    throw new Error('Impossible de charger les articles');
  }

  const { data: soldArticles } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'sold')
    .not('sold_price', 'is', null)
    .order('sold_at', { ascending: false })
    .limit(20);

  if (articles.length === 0) {
    return [];
  }

  const insights = await generatePricingInsightsWithAI(articles, soldArticles || []);

  await savePricingInsightsToDatabase(userId, insights);

  return insights;
}

export async function dismissPricingInsight(insightId: string): Promise<void> {
  const { error } = await supabase
    .from('kelly_insights')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
    })
    .eq('id', insightId);

  if (error) {
    throw new Error('Impossible de masquer cet insight');
  }
}

export async function completePricingAction(
  insightId: string,
  articleIds: string[],
  newPrice: number
): Promise<void> {
  const updates = articleIds.map(articleId =>
    supabase.from('articles').update({ price: newPrice }).eq('id', articleId)
  );

  await Promise.all(updates);

  await supabase
    .from('kelly_insights')
    .update({
      status: 'completed',
    })
    .eq('id', insightId);
}

export async function applyPricingSuggestion(
  articleId: string,
  newPrice: number
): Promise<void> {
  const { error } = await supabase
    .from('articles')
    .update({ price: newPrice })
    .eq('id', articleId);

  if (error) {
    throw new Error('Impossible de mettre à jour le prix');
  }
}
