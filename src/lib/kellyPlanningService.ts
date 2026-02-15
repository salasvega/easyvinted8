import { supabase } from './supabase';
import { Article } from '../types/article';
import { Lot } from '../types/lot';
import { GoogleGenAI } from '@google/genai';

export type PlanningInsightType =
  | 'seasonal_peak'        // Période de saison idéale
  | 'market_gap'           // Peu de concurrence détectée
  | 'demand_spike'         // Forte demande prévue
  | 'stale_inventory'      // Article qui dort trop longtemps
  | 'bundle_opportunity'   // Moment idéal pour un lot
  | 'weekend_boost'        // Publier ce weekend
  | 'price_optimize';      // Ajuster prix avant publication

export type PlanningPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface MarketContext {
  currentDemand: 'low' | 'medium' | 'high';
  competitionLevel: 'low' | 'medium' | 'high';
  priceOpportunity: number;
  timeWindowDays: number;
  seasonalTrend: 'rising' | 'peak' | 'declining' | 'off-season';
}

export interface SuggestedAction {
  type: 'publish_now' | 'schedule' | 'bundle_first' | 'wait' | 'adjust_price';
  scheduledDate?: string;
  reasoning: string;
  confidence: number;
  marketContext: MarketContext;
  priceAdjustment?: {
    current: number;
    suggested: number;
    change: number;
  };
}

export interface PlanningInsight {
  id: string;
  type: PlanningInsightType;
  priority: PlanningPriority;

  title: string;
  message: string;

  articleIds: string[];
  lotIds?: string[];

  suggestedAction: SuggestedAction;

  status: 'active' | 'dismissed' | 'completed';
  createdAt: string;
  expiresAt: string;
}

interface MarketTrend {
  category: string;
  season: string;
  avgPrice: number;
  recentSales: number;
  competition: number;
  demandScore: number;
}

interface UserHistory {
  bestDays: string[];
  avgSaleDuration: number;
  seasonalConversion: Record<string, number>;
  categoryPerformance: Record<string, number>;
}

const CACHE_DURATION_HOURS = 6;
const CACHE_KEY = 'planning_insights';

function getAI() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

function calculateDaysInInventory(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function getBestSalesDays(soldArticles: Article[]): string[] {
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  soldArticles.forEach(article => {
    if (article.sold_at) {
      const dayIndex = new Date(article.sold_at).getDay();
      const dayName = dayNames[dayIndex];
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    }
  });

  return Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);
}

function getSeasonalConversion(soldArticles: Article[]): Record<string, number> {
  const seasonCounts: Record<string, { sold: number; total: number }> = {};

  soldArticles.forEach(article => {
    const season = article.season || 'Toutes saisons';
    if (!seasonCounts[season]) {
      seasonCounts[season] = { sold: 0, total: 0 };
    }
    seasonCounts[season].total++;
    if (article.sold) {
      seasonCounts[season].sold++;
    }
  });

  const result: Record<string, number> = {};
  Object.entries(seasonCounts).forEach(([season, counts]) => {
    result[season] = counts.total > 0 ? Math.round((counts.sold / counts.total) * 100) : 0;
  });

  return result;
}

function getAvgSaleDuration(soldArticles: Article[]): number {
  const durations = soldArticles
    .filter(a => a.sold_at && a.created_at)
    .map(a => {
      const created = new Date(a.created_at);
      const sold = new Date(a.sold_at!);
      return Math.floor((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });

  if (durations.length === 0) return 14;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function buildPlanningAnalysisPrompt(
  readyArticles: Article[],
  readyLots: Lot[],
  userHistory: UserHistory,
  currentDate: string
): string {
  const articlesData = readyArticles.map(a => ({
    id: a.id,
    title: a.title,
    brand: a.brand,
    category: a.category,
    season: a.season,
    price: a.price,
    color: a.color,
    material: a.material,
    condition: a.condition,
    daysInInventory: calculateDaysInInventory(a.created_at),
    hasPhotos: a.photos && a.photos.length > 0,
  }));

  const lotsData = readyLots.map(l => ({
    id: l.id,
    title: l.title,
    articleCount: l.article_ids?.length || 0,
    price: l.price,
    category: l.category,
    season: l.season,
    daysInInventory: calculateDaysInInventory(l.created_at),
  }));

  return `Tu es Kelly, stratège de vente Vinted. Analyse le timing optimal de publication.

📅 DATE ACTUELLE: ${currentDate}

📦 ARTICLES PRÊTS À PUBLIER (${readyArticles.length}):
${JSON.stringify(articlesData, null, 2)}

📦 LOTS PRÊTS À PUBLIER (${readyLots.length}):
${JSON.stringify(lotsData, null, 2)}

📈 HISTORIQUE UTILISATEUR:
- Meilleurs jours de vente: ${userHistory.bestDays.join(', ')}
- Délai moyen de vente: ${userHistory.avgSaleDuration} jours
- Taux de conversion par saison: ${JSON.stringify(userHistory.seasonalConversion)}
- Performance par catégorie: ${JSON.stringify(userHistory.categoryPerformance)}

🎯 ANALYSE DEMANDÉE:

1. **OPPORTUNITÉS URGENTES** (fenêtre < 7 jours):
   - Pics saisonniers immédiats
   - Événements à venir (rentrée, fêtes, vacances)
   - Articles qui correspondent à une demande actuelle forte

2. **ARTICLES DORMANTS** (> 30 jours):
   - Suggérer ajustement prix ou bundling
   - Identifier pourquoi ils ne se vendent pas

3. **TIMING OPTIMAL**:
   - Meilleur jour de la semaine selon historique
   - Meilleure saison pour chaque article
   - Fenêtres d'opportunité par catégorie

4. **SUGGESTIONS DE LOTS**:
   - Regrouper articles complémentaires
   - Créer valeur ajoutée

5. **PRIORISATION**:
   urgent: publier dans les 48h
   high: publier cette semaine
   medium: publier dans 2-3 semaines
   low: attendre meilleure période

📝 FORMAT DE RÉPONSE (JSON strict):

{
  "insights": [
    {
      "type": "seasonal_peak",
      "priority": "urgent",
      "articleIds": ["id1", "id2"],
      "lotIds": [],
      "title": "Publie ces robes d'été MAINTENANT",
      "message": "La demande de robes d'été explose en ce moment. Les 3 prochains jours sont critiques avant saturation du marché.",
      "suggestedAction": {
        "type": "publish_now",
        "scheduledDate": "2024-06-15",
        "confidence": 92,
        "reasoning": "Pic saisonnier + faible concurrence + historique positif",
        "marketContext": {
          "currentDemand": "high",
          "competitionLevel": "low",
          "priceOpportunity": 15,
          "timeWindowDays": 3,
          "seasonalTrend": "peak"
        }
      },
      "expiresAt": "2024-06-18T23:59:59Z"
    },
    {
      "type": "stale_inventory",
      "priority": "high",
      "articleIds": ["id3"],
      "title": "Cet article dort depuis 45 jours",
      "message": "Jean Levi's: aucune vue récente. Baisse le prix de 20% ou crée un lot avec d'autres jeans.",
      "suggestedAction": {
        "type": "adjust_price",
        "confidence": 85,
        "reasoning": "Article stagnant, ajustement nécessaire",
        "marketContext": {
          "currentDemand": "medium",
          "competitionLevel": "high",
          "priceOpportunity": -20,
          "timeWindowDays": 14,
          "seasonalTrend": "rising"
        },
        "priceAdjustment": {
          "current": 25,
          "suggested": 20,
          "change": -20
        }
      },
      "expiresAt": "2024-06-30T23:59:59Z"
    }
  ]
}

IMPORTANT:
- Sois spécifique et actionnable
- Base-toi sur la date actuelle pour la saisonnalité
- Priorise les opportunités à fort impact
- Limite à 10 insights maximum
- Chaque insight doit avoir une action claire

GÉNÈRE MAINTENANT 3-10 INSIGHTS CONCRETS au format JSON:`;
}

async function generateInsightsWithAI(
  readyArticles: Article[],
  readyLots: Lot[],
  userHistory: UserHistory
): Promise<PlanningInsight[]> {
  try {
    const ai = getAI();
    const currentDate = new Date().toISOString();
    const prompt = buildPlanningAnalysisPrompt(readyArticles, readyLots, userHistory, currentDate);

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

    return parsed.insights.map((insight: any) => ({
      id: crypto.randomUUID(),
      ...insight,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error generating planning insights:', error);
    throw new Error('Impossible de générer les recommandations. Réessaie dans quelques instants.');
  }
}

async function getUserHistory(userId: string): Promise<UserHistory> {
  const { data: soldArticles } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false })
    .limit(50);

  const articles = soldArticles || [];

  const bestDays = getBestSalesDays(articles);
  const avgSaleDuration = getAvgSaleDuration(articles);
  const seasonalConversion = getSeasonalConversion(articles);

  const categoryPerformance: Record<string, number> = {};
  articles.forEach(a => {
    if (a.category) {
      categoryPerformance[a.category] = (categoryPerformance[a.category] || 0) + 1;
    }
  });

  return {
    bestDays,
    avgSaleDuration,
    seasonalConversion,
    categoryPerformance,
  };
}

async function getCachedInsights(userId: string): Promise<PlanningInsight[] | null> {
  try {
    const { data, error } = await supabase
      .from('kelly_planning_cache')
      .select('insights, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      return null;
    }

    return data.insights as PlanningInsight[];
  } catch (error) {
    console.error('Error getting cached insights:', error);
    return null;
  }
}

async function saveCacheToDatabase(
  userId: string,
  insights: PlanningInsight[],
  articleCount: number
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);

    const priorityCounts = {
      urgent: insights.filter(i => i.priority === 'urgent').length,
      high: insights.filter(i => i.priority === 'high').length,
      medium: insights.filter(i => i.priority === 'medium').length,
      low: insights.filter(i => i.priority === 'low').length,
    };

    const { error } = await supabase
      .from('kelly_planning_cache')
      .upsert({
        user_id: userId,
        insights: insights as any,
        market_data: {},
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        article_count: articleCount,
        priority_count: priorityCounts,
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('Error saving cache:', error);
    }
  } catch (error) {
    console.error('Error in saveCacheToDatabase:', error);
  }
}

export async function getPlanningInsights(
  userId: string,
  forceRefresh = false
): Promise<PlanningInsight[]> {
  if (!forceRefresh) {
    const cached = await getCachedInsights(userId);
    if (cached) {
      return cached;
    }
  }

  const { data: readyArticles } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  const { data: readyLots } = await supabase
    .from('lots')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (!readyArticles?.length && !readyLots?.length) {
    return [];
  }

  const userHistory = await getUserHistory(userId);

  const insights = await generateInsightsWithAI(
    readyArticles || [],
    readyLots || [],
    userHistory
  );

  await saveCacheToDatabase(userId, insights, (readyArticles?.length || 0) + (readyLots?.length || 0));

  return insights;
}

export async function dismissInsight(userId: string, insightId: string): Promise<void> {
  const cached = await getCachedInsights(userId);
  if (!cached) return;

  const updated = cached.map(insight =>
    insight.id === insightId
      ? { ...insight, status: 'dismissed' as const }
      : insight
  );

  const { data: cacheData } = await supabase
    .from('kelly_planning_cache')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (cacheData) {
    await supabase
      .from('kelly_planning_cache')
      .update({ insights: updated as any })
      .eq('user_id', userId);
  }
}

export async function completeInsight(userId: string, insightId: string): Promise<void> {
  const cached = await getCachedInsights(userId);
  if (!cached) return;

  const updated = cached.map(insight =>
    insight.id === insightId
      ? { ...insight, status: 'completed' as const }
      : insight
  );

  const { data: cacheData } = await supabase
    .from('kelly_planning_cache')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (cacheData) {
    await supabase
      .from('kelly_planning_cache')
      .update({ insights: updated as any })
      .eq('user_id', userId);
  }
}

export function formatTimeWindow(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days <= 3) return `${days} jours`;
  if (days <= 7) return "Cette semaine";
  if (days <= 14) return "Dans 2 semaines";
  return `Dans ${Math.ceil(days / 7)} semaines`;
}

export function getPriorityColor(priority: PlanningPriority): string {
  switch (priority) {
    case 'urgent': return 'text-red-600';
    case 'high': return 'text-orange-600';
    case 'medium': return 'text-blue-600';
    case 'low': return 'text-gray-600';
  }
}

export function getPriorityBgColor(priority: PlanningPriority): string {
  switch (priority) {
    case 'urgent': return 'bg-red-50 border-red-200';
    case 'high': return 'bg-orange-50 border-orange-200';
    case 'medium': return 'bg-blue-50 border-blue-200';
    case 'low': return 'bg-gray-50 border-gray-200';
  }
}

export function getPriorityIcon(priority: PlanningPriority): string {
  switch (priority) {
    case 'urgent': return '🔥';
    case 'high': return '⚡';
    case 'medium': return '💡';
    case 'low': return '📌';
  }
}

export function getTypeIcon(type: PlanningInsightType): string {
  switch (type) {
    case 'seasonal_peak': return '🌟';
    case 'market_gap': return '🎯';
    case 'demand_spike': return '📈';
    case 'stale_inventory': return '⏰';
    case 'bundle_opportunity': return '📦';
    case 'weekend_boost': return '🎉';
    case 'price_optimize': return '💰';
  }
}
