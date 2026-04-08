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

function getOptimizationThreshold(price: number): number {
  if (price < 10) {
    return 0.20;
  } else if (price <= 50) {
    return 0.15;
  } else {
    return 0.10;
  }
}

function getAI() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

interface MarketStats {
  brand: string;
  category: string;
  condition: string;
  avgSoldPrice: number;
  minSoldPrice: number;
  maxSoldPrice: number;
  totalSales: number;
}

function buildPricingAnalysisPrompt(
  articles: Article[],
  userSoldArticles: Article[],
  marketStats: MarketStats[]
): string {
  const articlesData = articles.map(a => {
    const threshold = getOptimizationThreshold(a.price);
    const thresholdPercent = Math.round(threshold * 100);

    return {
      id: a.id,
      title: a.title,
      brand: a.brand,
      category: a.title.split(' ')[0],
      condition: a.condition,
      price: a.price,
      optimizationThreshold: thresholdPercent,
      status: a.status,
      season: a.season,
      color: a.color,
      material: a.material,
      suggestedMin: a.suggested_price_min,
      suggestedMax: a.suggested_price_max,
    };
  });

  const userSoldData = userSoldArticles.map(a => ({
    brand: a.brand,
    condition: a.condition,
    soldPrice: a.sold_price,
    originalPrice: a.price,
  }));

  return `Tu es Kelly, experte en pricing pour Vinted. Analyse les prix de ces articles avec des données RÉELLES du marché.

📊 ARTICLES ACTIFS (${articles.length}):
${JSON.stringify(articlesData, null, 2)}

💰 TON HISTORIQUE DE VENTES (${userSoldArticles.length} dernières):
${JSON.stringify(userSoldData, null, 2)}

🌍 DONNÉES RÉELLES DU MARCHÉ (${marketStats.length} segments):
${JSON.stringify(marketStats, null, 2)}

🎯 MISSION:
Identifie 3-5 insights de prix CONCRETS basés sur les DONNÉES RÉELLES DU MARCHÉ:

1. **Sous-évalués** (underpriced): Articles avec un écart significatif sous avgSoldPrice du marché
2. **Sur-évalués** (overpriced): Articles avec un écart significatif au-dessus de avgSoldPrice du marché
3. **Prix optimal** (optimal_price): Prix dans la fourchette min-max du marché
4. **Opportunités de lot** (bundle_opportunity): 3+ articles similaires à grouper
5. **Prix psychologiques** (psychological_pricing): Ajuster vers prix psychologiques (X9€)

⚠️ RÈGLES STRICTES:
- UTILISE OBLIGATOIREMENT les marketStats (avgSoldPrice, minSoldPrice, maxSoldPrice)
- Compare chaque article à son segment de marché (brand + condition + category)
- Si pas de données marché pour un article, utilise les suggested_price_min/max
- Sois PRÉCIS sur les montants (ex: "18€ au lieu de 15€")
- **SEUIL D'OPTIMISATION SEGMENTÉ** (optimizationThreshold dans chaque article):
  * Articles < 10€: suggère une optimisation UNIQUEMENT si l'écart est ≥ 20%
  * Articles 10-50€: suggère une optimisation UNIQUEMENT si l'écart est ≥ 15%
  * Articles > 50€: suggère une optimisation UNIQUEMENT si l'écart est ≥ 10%
- NE suggère PAS d'optimisation si l'écart est inférieur au seuil de l'article
- Priorité HIGH = opportunité >10€ de gain OU >30% d'écart au marché
- Priorité MEDIUM = opportunité 5-10€ OU écart entre seuil et 30%
- Priorité LOW = optimisations <5€ OU écart proche du seuil minimum
- CITE les données de marché dans ton reasoning (ex: "Marché: 27€ moyenne sur 15 ventes")

💡 EXEMPLES DE SEUILS:
- Article à 8€ avec marché à 9€: écart de 12.5% → PAS de suggestion (< 20%)
- Article à 8€ avec marché à 11€: écart de 37.5% → Suggestion (≥ 20%)
- Article à 25€ avec marché à 27€: écart de 8% → PAS de suggestion (< 15%)
- Article à 25€ avec marché à 30€: écart de 20% → Suggestion (≥ 15%)
- Article à 60€ avec marché à 65€: écart de 8% → PAS de suggestion (< 10%)
- Article à 60€ avec marché à 70€: écart de 16.7% → Suggestion (≥ 10%)

📝 FORMAT DE RÉPONSE (JSON strict):
{
  "insights": [
    {
      "type": "underpriced",
      "priority": "high",
      "title": "Nike Air Max sous-évaluée",
      "message": "Ta paire de Nike Air Max est à 15€ alors que le marché réel est à 27€ en moyenne (23 ventes recensées). Tu perds 12€ !",
      "actionLabel": "Ajuster à 25€",
      "articleIds": ["article-id"],
      "suggestedAction": {
        "type": "adjust_price",
        "currentPrice": 15,
        "suggestedPrice": 25,
        "minPrice": 22,
        "maxPrice": 30,
        "reasoning": "Données marché réelles: 27€ moyenne sur 23 ventes (min: 22€, max: 32€). Ton prix actuel est 44% sous le marché.",
        "confidence": 0.92,
        "marketData": {
          "avgPrice": 27,
          "minPrice": 22,
          "maxPrice": 32,
          "salesLast30d": 23
        }
      }
    }
  ]
}

GÉNÈRE MAINTENANT 3-5 INSIGHTS CONCRETS (en respectant les seuils d'optimisation):`;
}

async function generatePricingInsightsWithAI(
  articles: Article[],
  userSoldArticles: Article[],
  marketStats: MarketStats[]
): Promise<PricingInsight[]> {
  try {
    const ai = getAI();
    const prompt = buildPricingAnalysisPrompt(articles, userSoldArticles, marketStats);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

async function getMarketStatistics(): Promise<MarketStats[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: soldArticles, error } = await supabase
    .from('articles')
    .select('brand, condition, sold_price, title')
    .eq('status', 'sold')
    .not('sold_price', 'is', null)
    .not('brand', 'is', null)
    .gte('sold_at', thirtyDaysAgo.toISOString())
    .order('sold_at', { ascending: false })
    .limit(500);

  if (error || !soldArticles || soldArticles.length === 0) {
    return [];
  }

  const statsMap = new Map<string, {
    prices: number[];
    brand: string;
    category: string;
    condition: string;
  }>();

  soldArticles.forEach(article => {
    if (!article.sold_price || article.sold_price <= 0) return;

    const category = article.title?.split(' ')[0] || 'Autre';
    const key = `${article.brand}|${category}|${article.condition}`;

    if (!statsMap.has(key)) {
      statsMap.set(key, {
        prices: [],
        brand: article.brand,
        category,
        condition: article.condition,
      });
    }

    statsMap.get(key)!.prices.push(article.sold_price);
  });

  const marketStats: MarketStats[] = [];

  statsMap.forEach(({ prices, brand, category, condition }) => {
    if (prices.length < 3) return;

    prices.sort((a, b) => a - b);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avg = sum / prices.length;

    marketStats.push({
      brand,
      category,
      condition,
      avgSoldPrice: Math.round(avg * 100) / 100,
      minSoldPrice: prices[0],
      maxSoldPrice: prices[prices.length - 1],
      totalSales: prices.length,
    });
  });

  return marketStats.sort((a, b) => b.totalSales - a.totalSales);
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

  const [articlesResult, userSoldResult, marketStatsResult] = await Promise.all([
    supabase
      .from('articles')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['draft', 'ready', 'scheduled', 'published'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('articles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'sold')
      .not('sold_price', 'is', null)
      .order('sold_at', { ascending: false })
      .limit(20),
    getMarketStatistics(),
  ]);

  const { data: articles, error: articlesError } = articlesResult;

  if (articlesError || !articles) {
    throw new Error('Impossible de charger les articles');
  }

  if (articles.length === 0) {
    return [];
  }

  const userSoldArticles = userSoldResult.data || [];
  const marketStats = marketStatsResult;

  console.log(`📊 Kelly Pricing - Données de marché: ${marketStats.length} segments sur ${marketStats.reduce((sum, s) => sum + s.totalSales, 0)} ventes`);

  const insights = await generatePricingInsightsWithAI(articles, userSoldArticles, marketStats);

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

export function calculateOptimizationThreshold(price: number): {
  threshold: number;
  thresholdPercent: number;
  description: string;
} {
  const threshold = getOptimizationThreshold(price);
  const thresholdPercent = Math.round(threshold * 100);

  let description = '';
  if (price < 10) {
    description = 'Article < 10€: optimisation suggérée si écart ≥ 20%';
  } else if (price <= 50) {
    description = 'Article 10-50€: optimisation suggérée si écart ≥ 15%';
  } else {
    description = 'Article > 50€: optimisation suggérée si écart ≥ 10%';
  }

  return {
    threshold,
    thresholdPercent,
    description,
  };
}
