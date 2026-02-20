import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Calendar, Package, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PublishFormModal } from '../components/PublishFormModal';
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
  data: Article | Lot;
}

export function ToPublishPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<PublishableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(7);
  const [selectedItem, setSelectedItem] = useState<PublishableItem | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

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

      // Load articles
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['ready', 'scheduled'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${targetDate.toISOString()}`)
        .order('scheduled_for', { ascending: true, nullsFirst: false });

      if (articlesError) throw articlesError;

      // Load lots with their articles
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

      // Transform articles
      const articleItems: PublishableItem[] = (articles || []).map(article => ({
        id: article.id,
        type: 'article' as const,
        title: article.title,
        photo: article.photos?.[0] || '',
        status: article.status,
        scheduledDate: article.scheduled_for,
        data: article,
      }));

      // Transform lots
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
          data: {
            ...lot,
            articles: lotArticles,
          },
        };
      });

      // Combine and sort by scheduled date
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
    setSelectedItem(item);
    setShowPublishModal(true);
  };

  const handleModalClose = () => {
    setShowPublishModal(false);
    setSelectedItem(null);
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
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Prêt
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Planifié
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
            <Play className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">À Publier</h1>
            <p className="text-gray-600">
              {items.length} article{items.length > 1 ? 's' : ''} et lot{items.length > 1 ? 's' : ''} prêt{items.length > 1 ? 's' : ''} à publier
            </p>
          </div>
        </div>

        {/* Filter Slider */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-700">
              Afficher les articles planifiés jusqu'à
            </label>
            <span className="text-lg font-bold text-teal-600">
              {daysFilter === 1 ? 'demain' : `+${daysFilter} jours`}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={daysFilter}
            onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1 jour</span>
            <span>7 jours</span>
            <span>15 jours</span>
            <span>30 jours</span>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucun article à publier
          </h3>
          <p className="text-gray-600 mb-6">
            Créez des articles ou ajustez le filtre de dates pour voir plus d'articles planifiés.
          </p>
          <Button onClick={() => navigate('/article_form')}>
            Créer un article
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Photo */}
              <div className="relative aspect-square bg-gray-100">
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.type === 'article' ? (
                      <ShoppingBag className="w-16 h-16 text-gray-300" />
                    ) : (
                      <Package className="w-16 h-16 text-gray-300" />
                    )}
                  </div>
                )}

                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  {item.type === 'lot' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-purple-500 text-white shadow-lg">
                      <Package className="w-3 h-3" />
                      Lot
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-teal-500 text-white shadow-lg">
                      <ShoppingBag className="w-3 h-3" />
                      Article
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]">
                  {item.title}
                </h3>

                <div className="flex items-center justify-between mb-3">
                  {getStatusBadge(item.status)}
                  {item.scheduledDate && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.scheduledDate)}
                    </div>
                  )}
                </div>

                {/* Publish Button */}
                <Button
                  onClick={() => handlePublish(item)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Publier
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && selectedItem && (
        <PublishFormModal
          item={selectedItem.data}
          itemType={selectedItem.type}
          onClose={handleModalClose}
          articles={selectedItem.type === 'lot' ? (selectedItem.data as any).articles : undefined}
        />
      )}
    </div>
  );
}
