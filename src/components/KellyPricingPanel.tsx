import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  TestTube,
  Package,
  Sparkles,
  X,
  RefreshCw,
  Euro,
  AlertCircle,
} from 'lucide-react';
import {
  getPricingInsights,
  dismissPricingInsight,
  applyPricingSuggestion,
  PricingInsight,
  PricingInsightType,
} from '../lib/kellyPricingService';
import { useAuth } from '../contexts/AuthContext';

interface KellyPricingPanelProps {
  onApplyPrice?: (articleId: string, newPrice: number) => void;
  compact?: boolean;
}

const INSIGHT_ICONS: Record<PricingInsightType, typeof TrendingUp> = {
  overpriced: TrendingDown,
  underpriced: TrendingUp,
  optimal_price: CheckCircle2,
  price_test: TestTube,
  bundle_opportunity: Package,
  psychological_pricing: Sparkles,
};

const INSIGHT_COLORS: Record<PricingInsightType, string> = {
  overpriced: 'text-orange-600 bg-orange-50 border-orange-200',
  underpriced: 'text-green-600 bg-green-50 border-green-200',
  optimal_price: 'text-blue-600 bg-blue-50 border-blue-200',
  price_test: 'text-purple-600 bg-purple-50 border-purple-200',
  bundle_opportunity: 'text-teal-600 bg-teal-50 border-teal-200',
  psychological_pricing: 'text-pink-600 bg-pink-50 border-pink-200',
};

const PRIORITY_LABELS: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: 'Priorité haute', color: 'bg-red-500' },
  medium: { label: 'Priorité moyenne', color: 'bg-yellow-500' },
  low: { label: 'Priorité basse', color: 'bg-gray-400' },
};

export default function KellyPricingPanel({ onApplyPrice, compact = false }: KellyPricingPanelProps) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PricingInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null);

  const loadInsights = async (forceRefresh = false) => {
    if (!user) return;

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await getPricingInsights(user.id, forceRefresh);
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, [user]);

  const handleDismiss = async (insightId: string) => {
    try {
      await dismissPricingInsight(insightId);
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  };

  const handleApplyPrice = async (insight: PricingInsight) => {
    const { suggestedAction, articleIds } = insight;

    if (suggestedAction.type !== 'adjust_price' || !suggestedAction.suggestedPrice) {
      return;
    }

    setApplyingPrice(insight.id);

    try {
      for (const articleId of articleIds) {
        await applyPricingSuggestion(articleId, suggestedAction.suggestedPrice);
        if (onApplyPrice) {
          onApplyPrice(articleId, suggestedAction.suggestedPrice);
        }
      }

      await dismissPricingInsight(insight.id);
      setInsights(prev => prev.filter(i => i.id !== insight.id));
    } catch (err) {
      console.error('Error applying price:', err);
      alert('Erreur lors de la mise à jour du prix');
    } finally {
      setApplyingPrice(null);
    }
  };

  const handleRefresh = () => {
    loadInsights(true);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
            <Euro className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Kelly Pricing</h3>
            <p className="text-sm text-gray-500">Analyse en cours...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 rounded-xl border border-red-100 ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Erreur</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tes prix sont optimaux!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Aucune opportunité d'optimisation détectée pour le moment.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
            <Euro className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Kelly Pricing</h3>
            <p className="text-sm text-gray-500">{insights.length} recommandation{insights.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Actualiser"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {insights.map(insight => {
          const Icon = INSIGHT_ICONS[insight.type];
          const colorClasses = INSIGHT_COLORS[insight.type];
          const priorityInfo = PRIORITY_LABELS[insight.priority];

          return (
            <div
              key={insight.id}
              className={`rounded-xl border ${colorClasses} ${compact ? 'p-4' : 'p-5'} relative`}
            >
              <button
                onClick={() => handleDismiss(insight.id)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                title="Masquer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3 pr-8">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full text-white ${priorityInfo.color}`}
                      title={priorityInfo.label}
                    >
                      {insight.priority === 'high' && '🔥'}
                      {insight.priority === 'medium' && '⚡'}
                      {insight.priority === 'low' && '💡'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mb-3">{insight.message}</p>

                  {insight.suggestedAction.type === 'adjust_price' && (
                    <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-gray-600">Prix actuel:</span>
                          <span className="font-bold text-gray-900 ml-2">
                            {insight.suggestedAction.currentPrice?.toFixed(2)}€
                          </span>
                        </div>
                        <div className="text-2xl">→</div>
                        <div>
                          <span className="text-gray-600">Prix suggéré:</span>
                          <span className="font-bold text-green-600 ml-2">
                            {insight.suggestedAction.suggestedPrice?.toFixed(2)}€
                          </span>
                        </div>
                      </div>
                      {insight.suggestedAction.marketData && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                          Marché: {insight.suggestedAction.marketData.minPrice}€ - {insight.suggestedAction.marketData.maxPrice}€
                          (moy. {insight.suggestedAction.marketData.avgPrice}€)
                        </div>
                      )}
                      {insight.suggestedAction.confidence && (
                        <div className="mt-1 text-xs text-gray-500">
                          Confiance: {Math.round(insight.suggestedAction.confidence * 100)}%
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {insight.suggestedAction.type === 'adjust_price' && (
                      <button
                        onClick={() => handleApplyPrice(insight)}
                        disabled={applyingPrice === insight.id}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {applyingPrice === insight.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Application...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            {insight.actionLabel}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(insight.id)}
                      className="text-gray-600 hover:text-gray-700 px-4 py-2 text-sm font-medium"
                    >
                      Plus tard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
