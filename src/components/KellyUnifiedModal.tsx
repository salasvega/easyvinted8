import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Euro,
  Calendar,
  RefreshCw,
  GripVertical,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  TestTube,
  Package,
  Clock,
  Check,
  AlertCircle,
  Sun,
  Loader2,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateProactiveInsights, ProactiveInsight, optimizeArticleSEO } from '../lib/geminiService';
import { getPricingInsights, dismissPricingInsight, applyPricingSuggestion, PricingInsight, PricingInsightType } from '../lib/kellyPricingService';
import { generateLotTitleAndDescription } from '../lib/lotAnalysisService';
import { Article } from '../types/article';
import { Lot } from '../types/lot';
import { LazyImage } from './ui/LazyImage';
import { Toast } from './ui/Toast';
import { ScheduleModal } from './ScheduleModal';
import { AdminDetailDrawer } from './admin/AdminDetailDrawer';
import { useNavigate } from 'react-router-dom';

interface KellyUnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToArticle?: (articleId: string) => void;
  onRefreshData?: () => void;
  onInsightsCountChange?: (count: number) => void;
}

type SectionType = 'insights' | 'pricing' | 'planner';

interface Suggestion {
  id: string;
  article_id?: string;
  lot_id?: string;
  suggested_date: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  status: 'pending' | 'accepted' | 'rejected' | 'scheduled';
  article?: Article;
  lot?: Lot;
}

const INSIGHT_CONFIG: Record<string, { icon: typeof TrendingDown; color: string; bg: string; border: string }> = {
  ready_to_publish: { icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ready_to_list: { icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  price_drop: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  seasonal: { icon: Sun, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  stale: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  incomplete: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  opportunity: { icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  bundle: { icon: Package, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  seo_optimization: { icon: Search, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const PRICING_ICONS: Record<PricingInsightType, typeof TrendingUp> = {
  overpriced: TrendingDown,
  underpriced: TrendingUp,
  optimal_price: CheckCircle2,
  price_test: TestTube,
  bundle_opportunity: Package,
  psychological_pricing: Sparkles,
};

const PRICING_COLORS: Record<PricingInsightType, string> = {
  overpriced: 'text-orange-600 bg-orange-50 border-orange-200',
  underpriced: 'text-green-600 bg-green-50 border-green-200',
  optimal_price: 'text-blue-600 bg-blue-50 border-blue-200',
  price_test: 'text-purple-600 bg-purple-50 border-purple-200',
  bundle_opportunity: 'text-teal-600 bg-teal-50 border-teal-200',
  psychological_pricing: 'text-pink-600 bg-pink-50 border-pink-200',
};

export function KellyUnifiedModal({ isOpen, onClose, onNavigateToArticle, onRefreshData, onInsightsCountChange }: KellyUnifiedModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(new Set(['insights']));
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('kellyUnifiedPosition');
    return saved ? JSON.parse(saved) : { bottom: 16, right: 16 };
  });

  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [pricingInsights, setPricingInsights] = useState<PricingInsight[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [scheduledArticles, setScheduledArticles] = useState<Article[]>([]);
  const [scheduledLots, setScheduledLots] = useState<Lot[]>([]);

  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [loadingPlanner, setLoadingPlanner] = useState(false);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<any>(null);

  const modalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadAllData();
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !modalRef.current) return;

      const deltaX = dragStart.x - e.clientX;
      const deltaY = dragStart.y - e.clientY;

      const modalWidth = modalRef.current.offsetWidth;
      const modalHeight = modalRef.current.offsetHeight;

      const maxRight = window.innerWidth - modalWidth - 16;
      const maxBottom = window.innerHeight - modalHeight - 16;

      let newRight = position.right + deltaX;
      let newBottom = position.bottom + deltaY;

      newRight = Math.max(16, Math.min(newRight, maxRight));
      newBottom = Math.max(16, Math.min(newBottom, maxBottom));

      setPosition({ right: newRight, bottom: newBottom });
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem('kellyUnifiedPosition', JSON.stringify(position));
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, dragStart, position]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadInsights(),
      loadPricingInsights(),
      loadPlannerData()
    ]);
  };

  const loadInsights = async (forceRefresh = false) => {
    if (!user || loadingInsights) return;

    setLoadingInsights(true);
    try {
      if (!forceRefresh) {
        const cachedInsights = await loadCachedInsights();
        if (cachedInsights && cachedInsights.length > 0) {
          setInsights(cachedInsights.filter(i => !dismissed.has(i.title)));
          setLoadingInsights(false);
          return;
        }
      }

      const [articlesResult, soldResult] = await Promise.all([
        supabase.from('articles').select('*').eq('user_id', user.id).in('status', ['draft', 'ready', 'published', 'scheduled']),
        supabase.from('articles').select('*').eq('user_id', user.id).eq('status', 'sold'),
      ]);

      if (articlesResult.error) throw articlesResult.error;
      if (soldResult.error) throw soldResult.error;

      const currentMonth = new Date().getMonth() + 1;
      const generatedInsights = await generateProactiveInsights(
        articlesResult.data || [],
        soldResult.data || [],
        currentMonth
      );

      const enrichedInsights = await Promise.all(
        generatedInsights.map(async (insight) => {
          if (insight.articleIds && insight.articleIds.length > 0) {
            const { data: articles } = await supabase
              .from('articles')
              .select('title')
              .eq('user_id', user.id)
              .in('id', insight.articleIds);

            return {
              ...insight,
              articleTitles: articles?.map(a => a.title) || []
            };
          }
          return insight;
        })
      );

      await saveCachedInsights(enrichedInsights);
      setInsights(enrichedInsights.filter(i => !dismissed.has(i.title)));
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadCachedInsights = async (): Promise<ProactiveInsight[] | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('kelly_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('cache_key', 'default')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) return null;

      const lastRefreshTime = new Date(data[0].last_refresh_at);
      const now = new Date();
      const minutesSinceRefresh = (now.getTime() - lastRefreshTime.getTime()) / (1000 * 60);

      if (minutesSinceRefresh > 30) return null;

      return data.map(insight => ({
        type: insight.type as any,
        priority: insight.priority as any,
        title: insight.title,
        message: insight.message,
        actionLabel: insight.action_label,
        articleIds: insight.article_ids,
        suggestedAction: insight.suggested_action,
      }));
    } catch (error) {
      console.error('Error loading cached insights:', error);
      return null;
    }
  };

  const saveCachedInsights = async (insights: ProactiveInsight[]) => {
    if (!user || insights.length === 0) return;

    try {
      await supabase.from('kelly_insights').delete().eq('user_id', user.id).eq('cache_key', 'default');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

      const insightsToInsert = insights.map(insight => ({
        user_id: user.id,
        type: insight.type,
        priority: insight.priority,
        title: insight.title,
        message: insight.message,
        action_label: insight.actionLabel,
        article_ids: insight.articleIds || [],
        suggested_action: insight.suggestedAction || null,
        status: 'active',
        cache_key: 'default',
        last_refresh_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }));

      await supabase.from('kelly_insights').insert(insightsToInsert);
    } catch (error) {
      console.error('Error saving cached insights:', error);
    }
  };

  const loadPricingInsights = async (forceRefresh = false) => {
    if (!user || loadingPricing) return;

    setLoadingPricing(true);
    try {
      const data = await getPricingInsights(user.id, forceRefresh);
      setPricingInsights(data);
    } catch (error) {
      console.error('Error loading pricing insights:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  const loadPlannerData = async () => {
    if (!user || loadingPlanner) return;

    setLoadingPlanner(true);
    try {
      await generatePlannerSuggestions();
      await loadSuggestions();
      await loadScheduledItems();
    } catch (error) {
      console.error('Error loading planner data:', error);
    } finally {
      setLoadingPlanner(false);
    }
  };

  const generatePlannerSuggestions = async () => {
    if (!user) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-planner-suggestions`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!user) return;

    try {
      const { data: suggestionsData, error } = await supabase
        .from('selling_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('suggested_date', { ascending: true });

      if (error) throw error;

      const suggestionsWithData = await Promise.all(
        (suggestionsData || []).map(async (suggestion) => {
          if (suggestion.article_id) {
            const { data: article } = await supabase
              .from('articles')
              .select('*')
              .eq('id', suggestion.article_id)
              .maybeSingle();
            return { ...suggestion, article };
          } else if (suggestion.lot_id) {
            const { data: lot } = await supabase
              .from('lots')
              .select('*')
              .eq('id', suggestion.lot_id)
              .maybeSingle();
            return { ...suggestion, lot };
          }
          return suggestion;
        })
      );

      const filteredSuggestions = suggestionsWithData.filter(
        (suggestion) =>
          (suggestion.article && suggestion.article.status === 'ready') ||
          (suggestion.lot && suggestion.lot.status === 'ready')
      );

      setSuggestions(filteredSuggestions as Suggestion[]);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadScheduledItems = async () => {
    if (!user) return;

    try {
      const { data: scheduled } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      const { data: scheduledLotsData } = await supabase
        .from('lots')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      setScheduledArticles(scheduled || []);
      setScheduledLots(scheduledLotsData || []);
    } catch (error) {
      console.error('Error loading scheduled items:', error);
    }
  };

  const toggleSection = (section: SectionType) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleDismissInsight = (insight: ProactiveInsight) => {
    setDismissed(prev => new Set([...prev, insight.title]));
    setInsights(prev => prev.filter(i => i.title !== insight.title));
  };

  const executeInsightAction = async (insight: ProactiveInsight) => {
    if (!user || !insight.articleIds?.length) return;

    setExecutingAction(insight.title);

    try {
      let shouldReloadInsights = false;

      switch (insight.type) {
        case 'ready_to_publish':
        case 'ready_to_list': {
          for (const articleId of insight.articleIds) {
            await supabase
              .from('articles')
              .update({ status: 'ready', updated_at: new Date().toISOString() })
              .eq('id', articleId)
              .eq('user_id', user.id);
          }

          handleDismissInsight(insight);
          onRefreshData?.();
          setToast({
            type: 'success',
            text: `${insight.articleIds.length} article${insight.articleIds.length > 1 ? 's passés' : ' passé'} en statut "Prêt" !`
          });
          shouldReloadInsights = true;
          break;
        }

        case 'seo_optimization': {
          let optimizedCount = 0;

          for (const articleId of insight.articleIds) {
            const { data: article } = await supabase
              .from('articles')
              .select('*')
              .eq('id', articleId)
              .eq('user_id', user.id)
              .single();

            if (!article) continue;

            const seoData = await optimizeArticleSEO(article);

            await supabase
              .from('articles')
              .update({
                seo_keywords: seoData.seo_keywords,
                hashtags: seoData.hashtags,
                search_terms: seoData.search_terms,
                updated_at: new Date().toISOString(),
              })
              .eq('id', articleId)
              .eq('user_id', user.id);

            optimizedCount++;
          }

          if (optimizedCount > 0) {
            handleDismissInsight(insight);
            onRefreshData?.();
            setToast({
              type: 'success',
              text: `SEO optimisé pour ${optimizedCount} article${optimizedCount > 1 ? 's' : ''} !`
            });
            shouldReloadInsights = true;
          }
          break;
        }

        case 'bundle': {
          if (!insight.articleIds || insight.articleIds.length < 2) break;

          const { data: fullArticles, error: articlesError } = await supabase
            .from('articles')
            .select('*')
            .eq('user_id', user.id)
            .in('id', insight.articleIds);

          if (articlesError || !fullArticles) break;

          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('writing_style, default_seller_id')
            .eq('user_id', user.id)
            .single();

          const totalPrice = fullArticles.reduce((sum, article) => sum + (Number(article.price) || 0), 0);
          const discountPercentage = 15;
          const lotPrice = Math.round(totalPrice * (1 - discountPercentage / 100));

          const analysis = await generateLotTitleAndDescription(
            fullArticles as Article[],
            userProfile?.writing_style || undefined
          );

          const allPhotos = fullArticles.flatMap(article => article.photos || []);
          const coverPhoto = allPhotos[0] || null;

          const { data: newLot, error: lotError } = await supabase
            .from('lots')
            .insert({
              user_id: user.id,
              name: analysis.title,
              description: analysis.description,
              price: lotPrice,
              original_total_price: totalPrice,
              discount_percentage: discountPercentage,
              cover_photo: coverPhoto,
              photos: allPhotos,
              status: 'draft',
              seller_id: userProfile?.default_seller_id || null,
              seo_keywords: analysis.seo_keywords,
              hashtags: analysis.hashtags,
              search_terms: analysis.search_terms,
              ai_confidence_score: analysis.ai_confidence_score,
            })
            .select()
            .single();

          if (lotError || !newLot) break;

          const lotItems = insight.articleIds.map(articleId => ({
            lot_id: newLot.id,
            article_id: articleId,
          }));

          const { error: itemsError } = await supabase.from('lot_items').insert(lotItems);

          if (itemsError) {
            await supabase.from('lots').delete().eq('id', newLot.id);
            break;
          }

          handleDismissInsight(insight);
          onRefreshData?.();
          setToast({
            type: 'success',
            text: `Lot créé avec succès : ${analysis.title}`
          });
          shouldReloadInsights = true;
          break;
        }

        default: {
          if (insight.articleIds?.[0] && onNavigateToArticle) {
            onNavigateToArticle(insight.articleIds[0]);
          }
        }
      }

      if (shouldReloadInsights) {
        setTimeout(() => {
          loadInsights(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setToast({
        type: 'error',
        text: 'Erreur lors de l\'exécution de l\'action'
      });
    } finally {
      setExecutingAction(null);
    }
  };

  const handleApplyPrice = async (insight: PricingInsight) => {
    const { suggestedAction, articleIds } = insight;

    if (suggestedAction.type !== 'adjust_price' || !suggestedAction.suggestedPrice) return;

    setApplyingPrice(insight.id);

    try {
      for (const articleId of articleIds) {
        await applyPricingSuggestion(articleId, suggestedAction.suggestedPrice);
      }

      await dismissPricingInsight(insight.id);
      setPricingInsights(prev => prev.filter(i => i.id !== insight.id));
      setToast({
        type: 'success',
        text: `Prix mis à jour pour ${articleIds.length} article${articleIds.length > 1 ? 's' : ''} !`
      });
    } catch (err) {
      console.error('Error applying price:', err);
      setToast({
        type: 'error',
        text: 'Erreur lors de la mise à jour du prix'
      });
    } finally {
      setApplyingPrice(null);
    }
  };

  const handleDismissPricing = async (insightId: string) => {
    try {
      await dismissPricingInsight(insightId);
      setPricingInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (err) {
      console.error('Error dismissing pricing insight:', err);
    }
  };

  const acceptSuggestion = async (
    suggestionId: string,
    itemId: string,
    suggestedDate: string,
    isLot: boolean = false
  ) => {
    try {
      const scheduledFor = new Date(suggestedDate).toISOString();
      const tableName = isLot ? 'lots' : 'articles';

      await supabase
        .from(tableName)
        .update({ status: 'scheduled', scheduled_for: scheduledFor })
        .eq('id', itemId);

      await supabase
        .from('selling_suggestions')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', suggestionId);

      await loadSuggestions();
      await loadScheduledItems();
      setToast({
        type: 'success',
        text: `Suggestion acceptée et ${isLot ? 'lot' : 'article'} planifié !`
      });
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      setToast({
        type: 'error',
        text: "Erreur lors de l'acceptation"
      });
    }
  };

  const rejectSuggestion = async (suggestionId: string) => {
    try {
      await supabase
        .from('selling_suggestions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', suggestionId);

      await loadSuggestions();
      setToast({ type: 'success', text: 'Suggestion rejetée' });
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      setToast({ type: 'error', text: 'Erreur lors du rejet' });
    }
  };

  const handleOpenScheduleModal = (
    item: Article | Lot,
    suggestionId: string,
    isLot: boolean = false,
    suggestedDateTime?: string
  ) => {
    if (isLot) {
      setSelectedLot(item as Lot);
      setSelectedArticle(null);
    } else {
      setSelectedArticle(item as Article);
      setSelectedLot(null);
    }
    setSelectedSuggestionId(suggestionId);
    setSuggestedDate(suggestedDateTime || null);
    setScheduleModalOpen(true);
  };

  const handleScheduled = async () => {
    if (selectedSuggestionId) {
      try {
        await supabase
          .from('selling_suggestions')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', selectedSuggestionId);
      } catch (error) {
        console.error('Error updating suggestion:', error);
      }
    }

    await loadSuggestions();
    await loadScheduledItems();
    setToast({ type: 'success', text: 'Planifié avec succès !' });
    setScheduleModalOpen(false);
    setSelectedArticle(null);
    setSelectedLot(null);
    setSelectedSuggestionId(null);
  };

  const visibleInsights = insights.filter(i => !dismissed.has(i.title));
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const totalScheduled = scheduledArticles.length + scheduledLots.length;

  useEffect(() => {
    if (onInsightsCountChange) {
      const totalCount = visibleInsights.length + pricingInsights.length + pendingSuggestions.length;
      onInsightsCountChange(totalCount);
    }
  }, [visibleInsights.length, pricingInsights.length, pendingSuggestions.length, onInsightsCountChange]);

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={modalRef}
        className="fixed z-[60] w-full sm:w-[480px] h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col"
        style={isMobile ? {
          bottom: '0',
          left: '0',
          right: '0',
          cursor: isDragging ? 'grabbing' : 'auto'
        } : {
          bottom: `${position.bottom}px`,
          right: `${position.right}px`,
          cursor: isDragging ? 'grabbing' : 'auto'
        }}
      >
        <div className={`bg-white ${isMobile ? 'rounded-t-2xl' : 'rounded-2xl'} shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col h-full`}>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="/kelly-avatar.png"
                    alt="Kelly"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {(visibleInsights.length + pricingInsights.length + pendingSuggestions.length) > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-white shadow-sm">
                        <span className="text-[10px] font-bold text-red-600">
                          {visibleInsights.length + pricingInsights.length + pendingSuggestions.length}
                        </span>
                      </span>
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Kelly - Votre Assistante IA</h3>
                  <p className="text-xs text-white/80">
                    {visibleInsights.length + pricingInsights.length + pendingSuggestions.length} recommandations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={loadAllData}
                  disabled={loadingInsights || loadingPricing || loadingPlanner}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Actualiser tout"
                >
                  <RefreshCw className={`w-4 h-4 ${(loadingInsights || loadingPricing || loadingPlanner) ? 'animate-spin' : ''}`} />
                </button>
                {!isMobile && (
                  <button
                    onMouseDown={handleDragStart}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-grab active:cursor-grabbing"
                    title="Déplacer"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              <SectionHeader
                icon={Sparkles}
                title="Conseils & Opportunités"
                count={visibleInsights.length}
                color="emerald"
                isExpanded={expandedSections.has('insights')}
                onToggle={() => toggleSection('insights')}
                loading={loadingInsights}
              />
              {expandedSections.has('insights') && (
                <div className="p-4 space-y-3 bg-gradient-to-br from-emerald-50/30 to-teal-50/30">
                  {loadingInsights && visibleInsights.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">Kelly analyse...</p>
                      </div>
                    </div>
                  ) : visibleInsights.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 font-medium">Tout est parfait !</p>
                      <p className="text-xs text-gray-500 mt-1">Aucune suggestion pour le moment</p>
                    </div>
                  ) : (
                    visibleInsights.map((insight, idx) => {
                      const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.opportunity;
                      const Icon = config.icon;
                      const isExecuting = executingAction === insight.title;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border ${config.border} ${config.bg} hover:shadow-md transition-all`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-white/80 ${config.color} flex-shrink-0`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {insight.articleTitles && insight.articleTitles.length > 0 && (
                                <div className="mb-1">
                                  <p className="text-xs text-gray-500 font-medium">
                                    {insight.articleTitles.length === 1 ? (
                                      <span>{insight.articleTitles[0]}</span>
                                    ) : (
                                      <span>{insight.articleTitles.length} articles concernés</span>
                                    )}
                                  </p>
                                </div>
                              )}
                              <h4 className={`font-semibold text-sm ${config.color} mb-1`}>
                                {insight.title}
                              </h4>
                              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                                {insight.message}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => executeInsightAction(insight)}
                                  disabled={isExecuting}
                                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${config.bg} ${config.color} border ${config.border} hover:shadow-sm disabled:opacity-50`}
                                >
                                  {isExecuting ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      {insight.actionLabel}
                                      <ChevronRight className="w-3 h-3" />
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDismissInsight(insight)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                                >
                                  Ignorer
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <SectionHeader
                icon={Euro}
                title="Optimisation des Prix"
                count={pricingInsights.length}
                color="green"
                isExpanded={expandedSections.has('pricing')}
                onToggle={() => toggleSection('pricing')}
                loading={loadingPricing}
              />
              {expandedSections.has('pricing') && (
                <div className="p-4 space-y-3 bg-gradient-to-br from-green-50/30 to-emerald-50/30">
                  {loadingPricing ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">Analyse des prix...</p>
                      </div>
                    </div>
                  ) : pricingInsights.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 font-medium">Prix optimaux !</p>
                      <p className="text-xs text-gray-500 mt-1">Aucune opportunité détectée</p>
                    </div>
                  ) : (
                    pricingInsights.map(insight => {
                      const Icon = PRICING_ICONS[insight.type];
                      const colorClasses = PRICING_COLORS[insight.type];

                      return (
                        <div
                          key={insight.id}
                          className={`rounded-xl border ${colorClasses} p-4 hover:shadow-md transition-all relative`}
                        >
                          <button
                            onClick={() => handleDismissPricing(insight.id)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                            title="Masquer"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          <div className="flex items-start gap-3 pr-8">
                            <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm text-gray-900 mb-1">{insight.title}</h4>
                              <p className="text-xs text-gray-700 mb-3">{insight.message}</p>

                              {insight.suggestedAction.type === 'adjust_price' && (
                                <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3 text-xs">
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <span className="text-gray-600">Actuel:</span>
                                      <span className="font-bold text-gray-900 ml-2">
                                        {insight.suggestedAction.currentPrice?.toFixed(2)}€
                                      </span>
                                    </div>
                                    <div className="text-lg">→</div>
                                    <div>
                                      <span className="text-gray-600">Suggéré:</span>
                                      <span className="font-bold text-green-600 ml-2">
                                        {insight.suggestedAction.suggestedPrice?.toFixed(2)}€
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                {insight.suggestedAction.type === 'adjust_price' && (
                                  <button
                                    onClick={() => handleApplyPrice(insight)}
                                    disabled={applyingPrice === insight.id}
                                    className="bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {applyingPrice === insight.id ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        Application...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        {insight.actionLabel}
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDismissPricing(insight.id)}
                                  className="text-gray-600 hover:text-gray-700 px-2 py-1 text-xs"
                                >
                                  Plus tard
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <SectionHeader
                icon={Calendar}
                title="Planification"
                count={pendingSuggestions.length}
                secondaryCount={totalScheduled}
                secondaryLabel="programmés"
                color="blue"
                isExpanded={expandedSections.has('planner')}
                onToggle={() => toggleSection('planner')}
                loading={loadingPlanner}
              />
              {expandedSections.has('planner') && (
                <div className="p-4 bg-gradient-to-br from-blue-50/30 to-sky-50/30">
                  {loadingPlanner ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">Analyse de planification...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          Suggestions ({pendingSuggestions.length})
                        </h4>
                        {pendingSuggestions.length === 0 ? (
                          <div className="text-center py-6 bg-white rounded-lg border border-blue-100">
                            <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-600">Aucune suggestion</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pendingSuggestions.slice(0, 3).map((suggestion) => {
                              const isLot = !!suggestion.lot_id;
                              const item = suggestion.lot || suggestion.article;
                              const itemPhoto = suggestion.lot?.cover_photo || suggestion.article?.photos?.[0];
                              const itemTitle = suggestion.lot?.name || suggestion.article?.title || 'Élément';
                              const itemId = suggestion.lot?.id || suggestion.article?.id;

                              return (
                                <div
                                  key={suggestion.id}
                                  className="bg-white rounded-lg p-3 border border-blue-100 hover:shadow-sm transition-all"
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    {itemPhoto ? (
                                      <LazyImage
                                        src={itemPhoto}
                                        alt={itemTitle}
                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                        fallback={
                                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                            <Package className="w-5 h-5 text-slate-400" />
                                          </div>
                                        }
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-slate-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-slate-900 truncate">{itemTitle}</p>
                                      <p className="text-[11px] text-slate-600 line-clamp-1">{suggestion.reason}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3 text-blue-600" />
                                        <span className="text-[11px] font-medium text-blue-700">
                                          {new Date(suggestion.suggested_date).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'short',
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => rejectSuggestion(suggestion.id)}
                                      className="flex-1 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 text-[10px] font-medium"
                                    >
                                      <X className="w-3 h-3 inline mr-1" />
                                      Refuser
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item && itemId) {
                                          acceptSuggestion(suggestion.id, itemId, suggestion.suggested_date, isLot);
                                        }
                                      }}
                                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-semibold"
                                    >
                                      <Check className="w-3 h-3 inline mr-1" />
                                      Accepter
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item && itemId) {
                                          handleOpenScheduleModal(item, suggestion.id, isLot, suggestion.suggested_date);
                                        }
                                      }}
                                      className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-[10px] font-semibold"
                                    >
                                      <Calendar className="w-3 h-3 inline mr-1" />
                                      Modifier
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Programmés ({totalScheduled})
                        </h4>
                        {totalScheduled === 0 ? (
                          <div className="text-center py-6 bg-white rounded-lg border border-emerald-100">
                            <Calendar className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-600">Aucune publication planifiée</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {scheduledArticles.slice(0, 3).map((article) => (
                              <div
                                key={`article-${article.id}`}
                                className="flex items-center gap-3 bg-white rounded-lg p-2 border border-emerald-100"
                              >
                                {article.photos?.[0] ? (
                                  <LazyImage
                                    src={article.photos[0]}
                                    alt={article.title}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                    fallback={
                                      <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-slate-400" />
                                      </div>
                                    }
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-900 truncate">{article.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Clock className="w-3 h-3 text-emerald-600" />
                                    <span className="text-xs text-emerald-700">
                                      {article.scheduled_for
                                        ? new Date(article.scheduled_for).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'short',
                                          })
                                        : 'Bientôt'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(selectedArticle || selectedLot) && (
        <ScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setSelectedArticle(null);
            setSelectedLot(null);
            setSelectedSuggestionId(null);
            setSuggestedDate(null);
          }}
          article={(selectedArticle || selectedLot) as any}
          onScheduled={handleScheduled}
          initialDate={suggestedDate || undefined}
        />
      )}

      {toast && (
        <Toast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  count: number;
  secondaryCount?: number;
  secondaryLabel?: string;
  color: 'emerald' | 'green' | 'blue';
  isExpanded: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  secondaryCount,
  secondaryLabel,
  color,
  isExpanded,
  onToggle,
  loading = false,
}: SectionHeaderProps) {
  const gradientClasses = {
    emerald: 'from-emerald-400 to-teal-500',
    green: 'from-green-400 to-emerald-500',
    blue: 'from-blue-400 to-sky-500',
  };

  const badgeClasses = {
    emerald: 'bg-emerald-100 text-emerald-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <button
      onClick={onToggle}
      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${gradientClasses[color]} rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClasses[color]}`}>
              {count} {count === 1 ? 'nouveau' : 'nouveaux'}
            </span>
            {secondaryCount !== undefined && (
              <span className="text-xs text-gray-500">
                • {secondaryCount} {secondaryLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {loading && (
          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
        )}
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
        )}
      </div>
    </button>
  );
}
