import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getPlanningInsights,
  dismissInsight,
  completeInsight,
  formatTimeWindow,
  getPriorityColor,
  getPriorityBgColor,
  getPriorityIcon,
  getTypeIcon,
  PlanningInsight,
} from '../lib/kellyPlanningService';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  Package,
  X,
  Check,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KellyPlannerPanelProps {
  onScheduleArticle?: (articleIds: string[], scheduledDate?: string) => void;
  onCreateBundle?: (articleIds: string[]) => void;
}

export function KellyPlannerPanel({ onScheduleArticle, onCreateBundle }: KellyPlannerPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [insights, setInsights] = useState<PlanningInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const activeInsights = insights.filter(i => i.status === 'active');
  const urgentCount = activeInsights.filter(i => i.priority === 'urgent').length;
  const highCount = activeInsights.filter(i => i.priority === 'high').length;

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      loadInsights();
    }
  }, [isOpen]);

  async function loadInsights(forceRefresh = false) {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getPlanningInsights(user.id, forceRefresh);
      setInsights(data);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error loading planning insights:', err);
      setError('Impossible de charger les recommandations. Vérifiez votre clé API Gemini.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss(insightId: string) {
    if (!user) return;
    await dismissInsight(user.id, insightId);
    setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: 'dismissed' as const } : i));
  }

  async function handleComplete(insightId: string) {
    if (!user) return;
    await completeInsight(user.id, insightId);
    setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: 'completed' as const } : i));
  }

  function handleAction(insight: PlanningInsight) {
    const action = insight.suggestedAction;

    switch (action.type) {
      case 'publish_now':
      case 'schedule':
        if (onScheduleArticle && insight.articleIds.length > 0) {
          const scheduledDate = action.scheduledDate || calculateOptimalDate(insight);
          onScheduleArticle(insight.articleIds, scheduledDate);
        }
        handleComplete(insight.id);
        break;

      case 'bundle_first':
        if (onCreateBundle && insight.articleIds.length > 0) {
          onCreateBundle(insight.articleIds);
        }
        handleComplete(insight.id);
        break;

      case 'adjust_price':
        if (insight.articleIds.length === 1) {
          navigate(`/mon-dressing?edit=${insight.articleIds[0]}`);
        }
        break;

      case 'wait':
        handleDismiss(insight.id);
        break;

      default:
        console.warn('Unknown action type:', action.type);
        handleDismiss(insight.id);
        break;
    }
  }

  function calculateOptimalDate(insight: PlanningInsight): string {
    const now = new Date();
    const timeWindowDays = insight.suggestedAction.marketContext.timeWindowDays;

    if (insight.priority === 'urgent') {
      now.setDate(now.getDate() + 1);
    } else if (timeWindowDays <= 3) {
      now.setDate(now.getDate() + 2);
    } else if (timeWindowDays <= 7) {
      now.setDate(now.getDate() + 4);
    } else {
      now.setDate(now.getDate() + 7);
    }

    now.setHours(10, 0, 0, 0);

    return now.toISOString();
  }

  function getActionLabel(insight: PlanningInsight): string {
    const actionType = insight.suggestedAction.type;
    const timeWindow = insight.suggestedAction.marketContext.timeWindowDays;

    switch (actionType) {
      case 'publish_now':
        return 'Planifier maintenant';
      case 'schedule':
        if (timeWindow <= 3) {
          return 'Planifier sous 3 jours';
        } else if (timeWindow <= 7) {
          return 'Planifier cette semaine';
        } else {
          return 'Planifier';
        }
      case 'bundle_first':
        return 'Créer le lot';
      case 'adjust_price':
        return 'Ajuster le prix';
      case 'wait':
        return 'Compris';
      default:
        console.warn('Unknown action type:', actionType);
        return 'Planifier';
    }
  }

  function getActionIcon(type: string) {
    switch (type) {
      case 'publish_now': return <Sparkles className="w-4 h-4" />;
      case 'schedule': return <Calendar className="w-4 h-4" />;
      case 'bundle_first': return <Package className="w-4 h-4" />;
      case 'adjust_price': return <TrendingUp className="w-4 h-4" />;
      case 'wait': return <Clock className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  }

  if (!user) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Kelly Planner
              {urgentCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500">
              {loading ? 'Analyse en cours...' : hasLoaded ? `${activeInsights.length} recommandation${activeInsights.length > 1 ? 's' : ''}` : 'Planificateur intelligent'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasLoaded && !loading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadInsights(true);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {loading && (
            <div className="p-6">
              <div className="flex items-center justify-center gap-3 py-8">
                <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
                <span className="text-gray-600">Kelly analyse vos articles...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Erreur</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && activeInsights.length === 0 && hasLoaded && (
            <div className="p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Tout est optimal !</h4>
                <p className="text-sm text-gray-600">
                  Aucune recommandation pour le moment. Kelly reviendra vers vous quand une opportunité se présentera.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && activeInsights.length > 0 && (
            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {activeInsights
                .sort((a, b) => {
                  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                  return priorityOrder[a.priority] - priorityOrder[b.priority];
                })
                .map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onAction={() => handleAction(insight)}
                    onDismiss={() => handleDismiss(insight.id)}
                    getActionLabel={getActionLabel}
                    getActionIcon={getActionIcon}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InsightCardProps {
  insight: PlanningInsight;
  onAction: () => void;
  onDismiss: () => void;
  getActionLabel: (insight: PlanningInsight) => string;
  getActionIcon: (type: string) => React.ReactNode;
}

function InsightCard({ insight, onAction, onDismiss, getActionLabel, getActionIcon }: InsightCardProps) {
  const priorityBg = getPriorityBgColor(insight.priority);
  const priorityColor = getPriorityColor(insight.priority);
  const priorityIcon = getPriorityIcon(insight.priority);
  const typeIcon = getTypeIcon(insight.type);

  const actionLabel = getActionLabel(insight);
  const actionIcon = getActionIcon(insight.suggestedAction.type);

  const demandColor = {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-green-600 bg-green-100',
  }[insight.suggestedAction.marketContext.currentDemand];

  const competitionColor = {
    low: 'text-green-600 bg-green-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-red-600 bg-red-100',
  }[insight.suggestedAction.marketContext.competitionLevel];

  return (
    <div className={`rounded-xl border-2 p-4 ${priorityBg} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2 flex-1">
          <div className="text-2xl">{typeIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{priorityIcon}</span>
              <h4 className={`font-semibold ${priorityColor} text-sm uppercase tracking-wide`}>
                {insight.priority === 'urgent' ? 'URGENT' :
                 insight.priority === 'high' ? 'PRIORITÉ HAUTE' :
                 insight.priority === 'medium' ? 'RECOMMANDATION' : 'À NOTER'}
              </h4>
            </div>
            <h5 className="font-bold text-gray-900 mb-2">{insight.title}</h5>
            <p className="text-sm text-gray-700 leading-relaxed">{insight.message}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/50 rounded-lg transition-colors flex-shrink-0"
          title="Ignorer"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
        <div className={`px-2 py-1 rounded-full font-medium ${demandColor}`}>
          Demande: {insight.suggestedAction.marketContext.currentDemand === 'high' ? 'Forte' :
                    insight.suggestedAction.marketContext.currentDemand === 'medium' ? 'Moyenne' : 'Faible'}
        </div>
        <div className={`px-2 py-1 rounded-full font-medium ${competitionColor}`}>
          Concurrence: {insight.suggestedAction.marketContext.competitionLevel === 'low' ? 'Faible' :
                        insight.suggestedAction.marketContext.competitionLevel === 'medium' ? 'Moyenne' : 'Forte'}
        </div>
        <div className="px-2 py-1 rounded-full font-medium text-purple-600 bg-purple-100">
          Fenêtre: {formatTimeWindow(insight.suggestedAction.marketContext.timeWindowDays)}
        </div>
        <div className="px-2 py-1 rounded-full font-medium text-gray-600 bg-gray-100">
          Confiance: {insight.suggestedAction.confidence}%
        </div>
      </div>

      <div className="bg-white/60 rounded-lg p-3 mb-3">
        <p className="text-xs font-medium text-gray-700 mb-1">Raisonnement:</p>
        <p className="text-xs text-gray-600 leading-relaxed">{insight.suggestedAction.reasoning}</p>
      </div>

      {insight.suggestedAction.priceAdjustment && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">Prix actuel:</span>
            <span className="font-bold text-gray-900 line-through">
              {Number(insight.suggestedAction.priceAdjustment.current).toFixed(2)} €
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-700">Prix suggéré:</span>
            <span className="font-bold text-orange-600">
              {Number(insight.suggestedAction.priceAdjustment.suggested).toFixed(2)} €
              <span className="text-xs ml-1">
                ({Number(insight.suggestedAction.priceAdjustment.change) > 0 ? '+' : ''}
                {Number(insight.suggestedAction.priceAdjustment.change)}%)
              </span>
            </span>
          </div>
        </div>
      )}

      {(insight.suggestedAction.type === 'publish_now' || insight.suggestedAction.type === 'schedule') && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-purple-600" />
            <p className="text-xs font-semibold text-purple-900">Date recommandée par Kelly</p>
          </div>
          <p className="text-sm font-bold text-purple-700">
            {formatTimeWindow(insight.suggestedAction.marketContext.timeWindowDays)}
          </p>
          <p className="text-xs text-purple-600 mt-1">
            La date sera pré-remplie automatiquement dans le calendrier
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAction}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
        >
          {actionIcon}
          {actionLabel}
        </button>
      </div>

      {insight.articleIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/50">
          <p className="text-xs text-gray-600">
            {insight.articleIds.length} article{insight.articleIds.length > 1 ? 's' : ''} concerné{insight.articleIds.length > 1 ? 's' : ''}
            {insight.lotIds && insight.lotIds.length > 0 && ` • ${insight.lotIds.length} lot${insight.lotIds.length > 1 ? 's' : ''}`}
          </p>
        </div>
      )}
    </div>
  );
}
