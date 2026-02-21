import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Calendar, Package, ShoppingBag, Clock, Sparkles, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PublishFormModal } from '../components/PublishFormModal';
import { ToPublishPageSkeleton } from '../components/ui/ToPublishPageSkeleton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Article } from '../types/article';
import type { Lot } from '../types/lot';

interface PublishableItem {
  id: string;
  type: 'article' | 'lot';
  title: string;
  photo: string;
  status: string;
  scheduledDate: string | null;
  price?: number;
  brand?: string;
  size?: string;
  data: Article | Lot;
}

type SortField = 'date' | 'title' | 'price' | 'status';
type SortOrder = 'asc' | 'desc';

export function ToPublishPageV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<PublishableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(7);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<'article' | 'lot' | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'article' | 'lot'>('all');

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user, daysFilter]);

  async function loadItems() {
    if (!user) return;

    try {
      setLoading(true);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysFilter);

      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['ready', 'scheduled'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${targetDate.toISOString()}`)
        .order('scheduled_for', { ascending: true, nullsFirst: false });

      if (articlesError) throw articlesError;

      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select(`
          *,
          lot_items (
            articles (
              id,
              title,
              brand,
              price,
              photos,
              size,
              description
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['ready', 'scheduled'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${targetDate.toISOString()}`)
        .order('scheduled_for', { ascending: true, nullsFirst: false });

      if (lotsError) throw lotsError;

      const articleItems: PublishableItem[] = (articles || []).map(article => ({
        id: article.id,
        type: 'article' as const,
        title: article.title,
        photo: article.photos?.[0] || '',
        status: article.status,
        scheduledDate: article.scheduled_for,
        price: article.price,
        brand: article.brand,
        size: article.size,
        data: article,
      }));

      const lotItems: PublishableItem[] = (lots || []).map((lot: any) => {
        const lotArticles = lot.lot_items?.map((item: any) => item.articles).filter(Boolean) || [];
        const firstPhoto = lotArticles[0]?.photos?.[0] || '';

        return {
          id: lot.id,
          type: 'lot' as const,
          title: lot.name,
          photo: firstPhoto,
          status: lot.status,
          scheduledDate: lot.scheduled_for,
          price: lot.price,
          data: {
            ...lot,
            articles: lotArticles,
          },
        };
      });

      const allItems = [...articleItems, ...lotItems].sort((a, b) => {
        if (!a.scheduledDate && !b.scheduledDate) return 0;
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });

      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  }

  const handlePublish = (item: PublishableItem) => {
    setSelectedItemId(item.id);
    setSelectedItemType(item.type);
    setShowPublishModal(true);
  };

  const handleModalClose = () => {
    setShowPublishModal(false);
    setSelectedItemId(null);
    setSelectedItemType(null);
    loadItems();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Non planifié';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays === -1) return 'Hier';
    if (diffDays < 0) return `Il y a ${Math.abs(diffDays)} jours`;
    if (diffDays <= 7) return `Dans ${diffDays} jours`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedItems = items
    .filter(item => typeFilter === 'all' || item.type === typeFilter)
    .sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          if (!a.scheduledDate && !b.scheduledDate) comparison = 0;
          else if (!a.scheduledDate) comparison = 1;
          else if (!b.scheduledDate) comparison = -1;
          else comparison = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return <ToPublishPageSkeleton />;
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prêt à Publier</h1>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              {filteredAndSortedItems.length} élément{filteredAndSortedItems.length > 1 ? 's' : ''} prêt{filteredAndSortedItems.length > 1 ? 's' : ''} à publier
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === 'all'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setTypeFilter('article')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  typeFilter === 'article'
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Articles
              </button>
              <button
                onClick={() => setTypeFilter('lot')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  typeFilter === 'lot'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Package className="w-4 h-4" />
                Lots
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-semibold text-gray-900">
                Période de planification
              </label>
            </div>
            <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30">
              {daysFilter === 1 ? 'Demain' : `+${daysFilter} jours`}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={daysFilter}
            onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-3">
            <span className="font-medium">1 jour</span>
            <span className="font-medium">7 jours</span>
            <span className="font-medium">15 jours</span>
            <span className="font-medium">30 jours</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Play className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Aucun élément à publier
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Créez des articles ou ajustez le filtre de dates pour voir plus d'éléments planifiés.
            </p>
            <Button
              onClick={() => navigate('/article_form')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Créer un article
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-4 px-6 py-4">
                <div className="col-span-5 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                  >
                    Article
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                  >
                    Statut
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                  >
                    Planification
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="col-span-1 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
                  >
                    Prix
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">
                  Action
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {filteredAndSortedItems.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-teal-50/30 transition-all group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Article Info */}
                  <div className="col-span-5 flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shadow-sm ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-all">
                        {item.photo ? (
                          <img
                            src={item.photo}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {item.type === 'article' ? (
                              <ShoppingBag className="w-7 h-7 text-gray-300" />
                            ) : (
                              <Package className="w-7 h-7 text-gray-300" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1">
                        {item.type === 'lot' ? (
                          <div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/40">
                            <Package className="w-3.5 h-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/40">
                            <ShoppingBag className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm group-hover:text-emerald-700 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {item.brand && (
                          <span className="font-medium">{item.brand}</span>
                        )}
                        {item.brand && item.size && (
                          <span className="text-gray-300">•</span>
                        )}
                        {item.size && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 font-medium">
                            {item.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center">
                    {item.status === 'ready' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Prêt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 shadow-sm">
                        <Clock className="w-3 h-3" />
                        Planifié
                      </span>
                    )}
                  </div>

                  {/* Schedule */}
                  <div className="col-span-2 flex items-center">
                    {item.scheduledDate ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-700">
                          {formatDate(item.scheduledDate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Non planifié</span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="col-span-1 flex items-center">
                    {item.price ? (
                      <span className="text-sm font-bold text-gray-900">
                        {item.price}€
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="col-span-2 flex items-center justify-end">
                    <Button
                      onClick={() => handlePublish(item)}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/30 transition-all px-6 py-2.5 text-sm font-semibold"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Publier
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPublishModal && selectedItemId && selectedItemType && (
        <PublishFormModal
          isOpen={showPublishModal}
          itemId={selectedItemId}
          itemType={selectedItemType}
          onClose={handleModalClose}
          onPublished={handleModalClose}
        />
      )}
    </div>
  );
}
