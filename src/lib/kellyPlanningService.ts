import { supabase } from './supabase';
import { Article } from '../types/article';
import { Lot } from '../types/lot';
import { callGeminiProxy } from './geminiProxy';

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
  type: 'publish_now' | 'schedule' | 'bundle_first' | 'wait' | 'adjust_price' | 'publish_later' | 'edit_and_publish' | 'hold_for_season';
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

const STALE_INVENTORY_THRESHOLD_DAYS = 45;
const MIN_PRICE_ADJUSTMENT_THRESHOLD = 0.15;
const MIN_GAIN_FOR_SUGGESTION_EUR = 3;
const MIN_TIME_WINDOW_FOR_URGENCY_DAYS = 7;
const MIN_ARTICLES_FOR_BUNDLE = 3;


function shouldSuggestPriceAdjustment(currentPrice: number, suggestedPrice: number): boolean {
  const diff = Math.abs(suggestedPrice - currentPrice);
  const percentChange = diff / currentPrice;

  if (diff < MIN_GAIN_FOR_SUGGESTION_EUR) {
    return false;
  }

  if (currentPrice < 10 && percentChange < 0.20) {
    return false;
  } else if (currentPrice <= 50 && percentChange < 0.15) {
    return false;
  } else if (currentPrice > 50 && percentChange < 0.10) {
    return false;
  }

  return true;
}

function getSeasonalUrgency(season: string | undefined): number {
  const currentMonth = new Date().getMonth();

  const seasonalMonths: Record<string, number[]> = {
    'Printemps': [2, 3, 4],
    'Été': [5, 6, 7],
    'Automne': [8, 9, 10],
    'Hiver': [11, 0, 1],
  };

  if (!season || season === 'Toutes saisons') return 50;

  const months = seasonalMonths[season] || [];

  if (months.includes(currentMonth)) {
    return 90;
  }

  const nextMonthMatch = months.includes((currentMonth + 1) % 12);
  if (nextMonthMatch) {
    return 70;
  }

  const prevMonthMatch = months.includes((currentMonth - 1 + 12) % 12);
  if (prevMonthMatch) {
    return 40;
  }

  return 20;
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
  const articlesData = readyArticles.map(a => {
    const daysInInventory = calculateDaysInInventory(a.created_at);
    const seasonalUrgency = getSeasonalUrgency(a.season);

    return {
      id: a.id,
      title: a.title,
      brand: a.brand,
      category: a.category,
      season: a.season,
      price: a.price,
      color: a.color,
      material: a.material,
      condition: a.condition,
      daysInInventory,
      seasonalUrgency,
      isStale: daysInInventory >= STALE_INVENTORY_THRESHOLD_DAYS,
      hasPhotos: a.photos && a.photos.length > 0,
      minPriceAdjustmentThreshold: MIN_PRICE_ADJUSTMENT_THRESHOLD * 100,
    };
  });

  const lotsData = readyLots.map(l => ({
    id: l.id,
    title: l.title,
    articleCount: l.article_ids?.length || 0,
    price: l.price,
    category: l.category,
    season: l.season,
    daysInInventory: calculateDaysInInventory(l.created_at),
    seasonalUrgency: getSeasonalUrgency(l.season),
  }));

  return `Tu es Kelly, stratège de vente Vinted. Analyse le timing optimal de publication avec des critères de HAUTE PERTINENCE.

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

🎯 CRITÈRES DE PERTINENCE (OBLIGATOIRES):

1. **SEUILS D'IMPACT MINIMUM**:
   - NE suggère un ajustement de prix QUE si le gain est ≥ 3€
   - NE suggère un ajustement QUE si l'écart est ≥ 15% du prix actuel
   - Articles < 10€: ajustement UNIQUEMENT si écart ≥ 20%
   - Articles 10-50€: ajustement UNIQUEMENT si écart ≥ 15%
   - Articles > 50€: ajustement UNIQUEMENT si écart ≥ 10%

2. **URGENCE SAISONNIÈRE** (utilise le champ seasonalUrgency de chaque article):
   - 90+: Saison en cours, opportunité CRITIQUE
   - 70-89: Saison proche (sous 1 mois), URGENT
   - 40-69: Fin de saison, publication RAPIDE conseillée
   - 20-39: Hors saison, ATTENDRE la bonne période
   - ÉVITE les suggestions "publie dans 3 mois" - préfère "attends la saison"

3. **ARTICLES DORMANTS** (isStale = true, ≥ ${STALE_INVENTORY_THRESHOLD_DAYS} jours):
   - Suggère UNIQUEMENT si ajustement significatif (≥ 3€ ET ≥ 15%)
   - OU si opportunité de lot avec ≥ ${MIN_ARTICLES_FOR_BUNDLE} articles similaires
   - Sinon, NE PAS suggérer (évite fatigue décisionnelle)

4. **SUGGESTIONS DE LOTS**:
   - MINIMUM ${MIN_ARTICLES_FOR_BUNDLE} articles similaires requis
   - Économie pour l'acheteur ≥ 15% vs achat séparé
   - Articles complémentaires (même taille, saison, style)

5. **FENÊTRES TEMPORELLES RÉALISTES**:
   - timeWindowDays ≤ ${MIN_TIME_WINDOW_FOR_URGENCY_DAYS} = priorité "urgent"
   - timeWindowDays 8-14 = priorité "high"
   - timeWindowDays 15-30 = priorité "medium"
   - timeWindowDays > 30 = attendre, pas de suggestion OU "hold_for_season"

6. **PRIORISATION INTELLIGENTE**:
   urgent: Opportunité critique dans les 48h (pic saisonnier, événement imminent)
   high: Publier cette semaine (bonne période, historique positif)
   medium: Publier dans 2-3 semaines (période acceptable mais pas optimale)
   low: ÉVITER ce niveau - suggère plutôt d'attendre avec "hold_for_season"

⚠️ RÈGLES DE FILTRAGE STRICTES:

- **NE suggère PAS** d'ajustement de prix < 3€ de gain
- **NE suggère PAS** de publier des articles hors saison (seasonalUrgency < 40)
- **NE suggère PAS** de lots avec < ${MIN_ARTICLES_FOR_BUNDLE} articles
- **NE suggère PAS** d'actions vagues ("optimise", "révise") sans montant précis
- **LIMITE à 5-7 insights maximum** (les plus impactants uniquement)
- **Chaque insight doit avoir un impact ≥ 5€ de gain potentiel OU une urgence temporelle ≤ 7 jours**

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

💡 EXEMPLES DE SUGGESTIONS VALIDES:

✅ VALIDE: "Robe d'été à 25€ alors que le marché est à 32€ (+7€, +28%). Saison en cours (seasonalUrgency: 90). Publie MAINTENANT."
✅ VALIDE: "3 t-shirts Nike identiques (tailles M/L/XL) = opportunité de lot à 35€ au lieu de 45€ séparés. Économie de 22%."
✅ VALIDE: "Manteau d'hiver dort depuis 60 jours à 45€. Baisse à 35€ (-22%, -10€) pour débloquer la vente."

❌ INVALIDE: "Optimise le prix" (trop vague, pas de montant)
❌ INVALIDE: "T-shirt à 8€ → 9€" (gain de 1€ seulement, < 3€)
❌ INVALIDE: "Publie cette doudoune en juillet" (hors saison, seasonalUrgency < 40)
❌ INVALIDE: "Crée un lot avec 2 articles" (< ${MIN_ARTICLES_FOR_BUNDLE} articles requis)

IMPORTANT:
- Sois ULTRA-SPÉCIFIQUE et actionnable avec montants exacts
- Base-toi sur la date actuelle ET seasonalUrgency pour la pertinence
- Priorise UNIQUEMENT les opportunités à fort impact (≥ 5€ OU urgence ≤ 7j)
- LIMITE à 5-7 insights maximum (qualité > quantité)
- Chaque insight doit justifier son existence avec des chiffres concrets

⚠️ TYPES D'ACTION AUTORISÉS (utilise UNIQUEMENT ces types):
- "publish_now": publication immédiate (48h) - UNIQUEMENT si seasonalUrgency ≥ 70 OU timeWindow ≤ 3j
- "schedule": planifier à une date précise dans les 14 jours
- "publish_later": publication dans 2-4 semaines (seasonalUrgency 40-69)
- "bundle_first": créer un lot (≥ ${MIN_ARTICLES_FOR_BUNDLE} articles, économie ≥ 15%)
- "adjust_price": ajuster le prix (gain ≥ 3€ ET écart ≥ 15%)
- "edit_and_publish": modifier puis planifier (problème de qualité photo/description)
- "hold_for_season": attendre la bonne saison (seasonalUrgency < 40)
- "wait": pas d'action recommandée (article optimal, attente normale)

N'UTILISE AUCUN AUTRE TYPE D'ACTION!

GÉNÈRE MAINTENANT 3-7 INSIGHTS ULTRA-PERTINENTS au format JSON (filtre agressivement):`;
}

function filterLowImpactInsights(insights: PlanningInsight[], articles: Article[]): PlanningInsight[] {
  return insights.filter(insight => {
    if (insight.suggestedAction.type === 'adjust_price' && insight.suggestedAction.priceAdjustment) {
      const { current, suggested } = insight.suggestedAction.priceAdjustment;

      if (!shouldSuggestPriceAdjustment(current, suggested)) {
        console.log(`🚫 Insight filtré: ajustement de prix trop faible (${current}€ → ${suggested}€)`);
        return false;
      }
    }

    if (insight.suggestedAction.type === 'bundle_first') {
      const articleCount = insight.articleIds?.length || 0;
      if (articleCount < MIN_ARTICLES_FOR_BUNDLE) {
        console.log(`🚫 Insight filtré: lot avec seulement ${articleCount} articles (min: ${MIN_ARTICLES_FOR_BUNDLE})`);
        return false;
      }
    }

    if (insight.suggestedAction.type === 'publish_now' || insight.suggestedAction.type === 'schedule') {
      const relevantArticles = articles.filter(a => insight.articleIds?.includes(a.id));
      const avgSeasonalUrgency = relevantArticles.reduce((sum, a) =>
        sum + getSeasonalUrgency(a.season), 0) / relevantArticles.length;

      if (avgSeasonalUrgency < 40) {
        console.log(`🚫 Insight filtré: articles hors saison (urgence: ${Math.round(avgSeasonalUrgency)})`);
        return false;
      }
    }

    if (insight.priority === 'low') {
      console.log(`🚫 Insight filtré: priorité "low" (pas assez impactant)`);
      return false;
    }

    return true;
  });
}

async function generateInsightsWithAI(
  readyArticles: Article[],
  readyLots: Lot[],
  userHistory: UserHistory
): Promise<PlanningInsight[]> {
  try {
    const currentDate = new Date().toISOString();
    const prompt = buildPlanningAnalysisPrompt(readyArticles, readyLots, userHistory, currentDate);

    const response = await callGeminiProxy('gemini-2.5-flash', prompt, {
      responseMimeType: 'application/json',
      temperature: 0.7,
    });

    if (!('text' in response) || !response.text) {
      throw new Error('No text response from model');
    }
    const parsed = JSON.parse(response.text);

    const rawInsights = parsed.insights.map((insight: any) => {
      const normalizedInsight = {
        id: crypto.randomUUID(),
        ...insight,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };

      if (normalizedInsight.suggestedAction?.priceAdjustment) {
        normalizedInsight.suggestedAction.priceAdjustment = {
          current: Number(normalizedInsight.suggestedAction.priceAdjustment.current),
          suggested: Number(normalizedInsight.suggestedAction.priceAdjustment.suggested),
          change: Number(normalizedInsight.suggestedAction.priceAdjustment.change),
        };
      }

      return normalizedInsight;
    });

    const filteredInsights = filterLowImpactInsights(rawInsights, readyArticles);

    console.log(`✅ Kelly Planning: ${rawInsights.length} insights générés, ${filteredInsights.length} retenus après filtrage`);

    return filteredInsights;
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

    const insights = data.insights as PlanningInsight[];

    return insights.map(insight => {
      if (insight.suggestedAction?.priceAdjustment) {
        return {
          ...insight,
          suggestedAction: {
            ...insight.suggestedAction,
            priceAdjustment: {
              current: Number(insight.suggestedAction.priceAdjustment.current),
              suggested: Number(insight.suggestedAction.priceAdjustment.suggested),
              change: Number(insight.suggestedAction.priceAdjustment.change),
            },
          },
        };
      }
      return insight;
    });
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

export async function clearCache(userId: string): Promise<void> {
  try {
    await supabase
      .from('kelly_planning_cache')
      .delete()
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export async function getPlanningInsights(
  userId: string,
  forceRefresh = false
): Promise<PlanningInsight[]> {
  if (!forceRefresh) {
    try {
      const cached = await getCachedInsights(userId);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.error('Error loading cached insights, clearing cache:', error);
      await clearCache(userId);
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

export function calculateSeasonalUrgencyScore(season: string | undefined): number {
  return getSeasonalUrgency(season);
}

export function isPriceAdjustmentWorthwhile(currentPrice: number, suggestedPrice: number): boolean {
  return shouldSuggestPriceAdjustment(currentPrice, suggestedPrice);
}

export const PLANNING_THRESHOLDS = {
  STALE_INVENTORY_DAYS: STALE_INVENTORY_THRESHOLD_DAYS,
  MIN_PRICE_ADJUSTMENT_PERCENT: MIN_PRICE_ADJUSTMENT_THRESHOLD,
  MIN_GAIN_EUR: MIN_GAIN_FOR_SUGGESTION_EUR,
  MIN_TIME_WINDOW_URGENCY_DAYS: MIN_TIME_WINDOW_FOR_URGENCY_DAYS,
  MIN_BUNDLE_ARTICLES: MIN_ARTICLES_FOR_BUNDLE,
};
