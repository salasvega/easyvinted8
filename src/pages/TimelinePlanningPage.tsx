import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Filter, Clock, Package, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { supabase } from '../lib/supabase';
import { Article, ArticleStatus } from '../types/article';
import { Lot } from '../types/lot';
import { FamilyMember } from '../services/settings';
import { AdminDetailDrawer } from '../components/admin/AdminDetailDrawer';

type ViewMode = 'week' | 'month';

type TimelineItem = {
  id: string;
  type: 'article' | 'lot';
  title: string;
  price: number;
  photo: string | null;
  scheduledFor: Date;
  sellerId: string;
  status: string;
  referenceNumber?: string;
};

export default function TimelinePlanningPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: familyMembers = [] } = useFamilyMembers(user?.id);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<TimelineItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullItemDetails, setFullItemDetails] = useState<any>(null);

  const allSellers = useMemo(() => {
    return [...familyMembers];
  }, [familyMembers]);

  useEffect(() => {
    if (allSellers.length > 0 && selectedSellers.length === 0) {
      setSelectedSellers(allSellers.map(s => s.id));
    }
  }, [allSellers, selectedSellers.length]);

  const loadItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['scheduled', 'ready'])
        .not('scheduled_for', 'is', null)
        .order('scheduled_for');

      const { data: lots } = await supabase
        .from('lots')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['scheduled', 'ready'])
        .not('scheduled_for', 'is', null)
        .order('scheduled_for');

      const timelineItems: TimelineItem[] = [];

      if (articles) {
        articles.forEach((article: Article) => {
          // Ignorer les articles sans vendeur assigné
          if (!article.seller_id) return;

          timelineItems.push({
            id: article.id,
            type: 'article',
            title: article.title,
            price: article.price,
            photo: article.photos?.[0] || null,
            scheduledFor: new Date(article.scheduled_for!),
            sellerId: article.seller_id,
            status: article.status,
            referenceNumber: article.reference_number
          });
        });
      }

      if (lots) {
        lots.forEach((lot: Lot) => {
          // Ignorer les lots sans vendeur assigné
          if (!lot.seller_id) return;

          timelineItems.push({
            id: lot.id,
            type: 'lot',
            title: lot.name,
            price: lot.price,
            photo: lot.cover_photo || lot.photos?.[0] || null,
            scheduledFor: new Date(lot.scheduled_for!),
            sellerId: lot.seller_id,
            status: lot.status,
            referenceNumber: lot.reference_number
          });
        });
      }

      timelineItems.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
      setItems(timelineItems);
    } catch (error) {
      console.error('Error loading timeline items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [user]);

  const getDateRange = () => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);

    if (viewMode === 'week') {
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(start.getDate() + diff);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    } else {
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const generateTimeSlots = () => {
    const { start, end } = getDateRange();
    const slots: Date[] = [];
    const current = new Date(start);

    if (viewMode === 'week') {
      while (current <= end) {
        slots.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    } else {
      const daysInMonth = end.getDate();
      const weeksToShow = Math.ceil(daysInMonth / 7);
      for (let week = 0; week < weeksToShow; week++) {
        const weekStart = new Date(start);
        weekStart.setDate(1 + week * 7);
        slots.push(weekStart);
      }
    }

    return slots;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (item: TimelineItem) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetDate: Date, sellerId: string) => {
    if (!draggedItem || !user) return;

    const newScheduledFor = new Date(targetDate);
    newScheduledFor.setHours(12, 0, 0, 0);

    try {
      if (draggedItem.type === 'article') {
        await supabase
          .from('articles')
          .update({
            scheduled_for: newScheduledFor.toISOString(),
            seller_id: sellerId,
            status: 'scheduled'
          })
          .eq('id', draggedItem.id);
      } else {
        await supabase
          .from('lots')
          .update({
            scheduled_for: newScheduledFor.toISOString(),
            seller_id: sellerId,
            status: 'scheduled'
          })
          .eq('id', draggedItem.id);
      }

      await loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }

    setDraggedItem(null);
  };

  const formatDateHeader = (date: Date) => {
    if (viewMode === 'week') {
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }).format(date);
    } else {
      const weekNum = Math.ceil(date.getDate() / 7);
      return `S${weekNum}`;
    }
  };

  const getItemsForDateAndSeller = (date: Date, sellerId: string) => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);

    if (viewMode === 'week') {
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      dateEnd.setDate(dateEnd.getDate() + 6);
      dateEnd.setHours(23, 59, 59, 999);
    }

    return items.filter(item => {
      const itemDate = item.scheduledFor.getTime();
      return itemDate >= dateStart.getTime() &&
             itemDate <= dateEnd.getTime() &&
             item.sellerId === sellerId;
    });
  };

  const handleItemClick = (item: TimelineItem) => {
    // Afficher seulement la modale inline
    setSelectedItem(item);
  };

  const handlePublishNow = () => {
    if (!selectedItem) return;

    // Rediriger vers la page de structure pour publication
    if (selectedItem.type === 'article') {
      navigate(`/articles/${selectedItem.id}/structure`);
    } else {
      navigate(`/lots/${selectedItem.id}/structure`);
    }
  };

  const handleViewDetails = async () => {
    if (!selectedItem) return;

    // Charger les détails complets pour le drawer
    try {
      if (selectedItem.type === 'article') {
        const { data } = await supabase
          .from('articles')
          .select('*')
          .eq('id', selectedItem.id)
          .single();

        if (data) {
          const seller = allSellers.find(s => s.id === data.seller_id);
          setFullItemDetails({
            ...data,
            type: 'article',
            seller_name: seller?.name || 'Inconnu'
          });
        }
      } else {
        const { data } = await supabase
          .from('lots')
          .select('*')
          .eq('id', selectedItem.id)
          .single();

        if (data) {
          const seller = allSellers.find(s => s.id === data.seller_id);

          // Charger les articles du lot
          const { data: lotArticles } = await supabase
            .from('articles')
            .select('id, title, brand, price, photos, size')
            .eq('lot_id', selectedItem.id);

          setFullItemDetails({
            id: data.id,
            type: 'lot',
            title: data.name,
            brand: data.brand,
            price: data.price,
            status: data.status as ArticleStatus,
            photos: data.photos || [],
            created_at: data.created_at,
            season: data.season,
            scheduled_for: data.scheduled_for,
            seller_id: data.seller_id,
            seller_name: seller?.name || 'Inconnu',
            published_at: data.published_at,
            sold_at: data.sold_at,
            sold_price: data.sold_price,
            reference_number: data.reference_number,
            lot_article_count: lotArticles?.length || 0,
            description: data.description,
            vinted_url: data.vinted_url,
            articles: lotArticles || [],
            original_total_price: data.original_total_price,
            discount_percentage: data.discount_percentage,
            seo_keywords: data.seo_keywords,
            hashtags: data.hashtags,
            search_terms: data.search_terms
          });
        }
      }

      // Fermer la modale inline et ouvrir le drawer
      setSelectedItem(null);
      setDrawerOpen(true);
    } catch (error) {
      console.error('Error loading item details:', error);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Non défini';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date(date));
  };

  const handleEdit = () => {
    if (!fullItemDetails) return;

    if (fullItemDetails.type === 'article') {
      navigate(`/articles/${fullItemDetails.id}/edit-v2`);
    } else {
      // Pour les lots, on peut rediriger vers une page d'édition de lot si elle existe
      navigate(`/lots/${fullItemDetails.id}/structure`);
    }
  };

  const handleDuplicate = async () => {
    // Implémenter la duplication si nécessaire
    console.log('Duplicate item:', fullItemDetails);
  };

  const handleSchedule = () => {
    // La modale de planification pourrait être ajoutée ici
    console.log('Schedule item:', fullItemDetails);
  };

  const handleMarkSold = () => {
    // Ouvrir la modale de vente
    console.log('Mark as sold:', fullItemDetails);
  };

  const handleDelete = async () => {
    if (!fullItemDetails) return;

    try {
      if (fullItemDetails.type === 'article') {
        await supabase
          .from('articles')
          .delete()
          .eq('id', fullItemDetails.id);
      } else {
        await supabase
          .from('lots')
          .delete()
          .eq('id', fullItemDetails.id);
      }

      setDrawerOpen(false);
      setFullItemDetails(null);
      setSelectedItem(null);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleStatusChange = () => {
    // Ouvrir la modale de changement de statut
    console.log('Change status:', fullItemDetails);
  };

  const handleLabelOpen = () => {
    // Ouvrir la modale d'étiquette
    console.log('Open label modal:', fullItemDetails);
  };

  const toggleSellerFilter = (sellerId: string) => {
    setSelectedSellers(prev =>
      prev.includes(sellerId)
        ? prev.filter(id => id !== sellerId)
        : [...prev, sellerId]
    );
  };

  const filteredSellers = allSellers.filter(s => selectedSellers.includes(s.id));
  const timeSlots = generateTimeSlots();
  const { start, end } = getDateRange();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement de la timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-600" />
                Timeline Planning
              </h1>
              <p className="text-slate-600 mt-1">
                Organisez vos publications par drag & drop
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Mois
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>

            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {viewMode === 'week'
                  ? `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(start)} - ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(end)}`
                  : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate)
                }
              </h2>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Aujourd'hui
              </button>
            </div>

            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Vendeurs:</span>
            </div>
            {allSellers.map(seller => (
              <button
                key={seller.id}
                onClick={() => toggleSellerFilter(seller.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedSellers.includes(seller.id)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                }`}
              >
                {seller.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid" style={{ gridTemplateColumns: `200px repeat(${timeSlots.length}, minmax(150px, 1fr))` }}>
                <div className="sticky left-0 bg-slate-50 border-r border-slate-200 p-4 font-semibold text-slate-700">
                  Vendeur
                </div>
                {timeSlots.map((date, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border-r border-slate-200 p-3 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {formatDateHeader(date)}
                    </div>
                    {viewMode === 'week' && (
                      <div className="text-xs text-slate-500 mt-1">
                        {date.getDate() === new Date().getDate() &&
                         date.getMonth() === new Date().getMonth() &&
                         date.getFullYear() === new Date().getFullYear() && (
                          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {filteredSellers.map((seller) => (
                  <div key={seller.id} className="contents">
                    <div className="sticky left-0 bg-white border-r border-t border-slate-200 p-4 font-medium text-slate-900">
                      {seller.name}
                    </div>
                    {timeSlots.map((date, idx) => {
                      const cellItems = getItemsForDateAndSeller(date, seller.id);
                      const isToday = viewMode === 'week' &&
                        date.getDate() === new Date().getDate() &&
                        date.getMonth() === new Date().getMonth() &&
                        date.getFullYear() === new Date().getFullYear();

                      return (
                        <div
                          key={`${seller.id}-${idx}`}
                          className={`border-r border-t border-slate-200 p-2 min-h-[120px] transition-colors ${
                            isToday ? 'bg-blue-50/30' : 'bg-white'
                          } ${draggedItem ? 'hover:bg-blue-50' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(date, seller.id);
                          }}
                        >
                          <div className="space-y-2">
                            {cellItems.map((item) => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={() => handleDragStart(item)}
                                onClick={() => handleItemClick(item)}
                                className="bg-white border border-slate-200 rounded-lg p-2 cursor-move hover:shadow-md transition-all group"
                              >
                                <div className="flex items-start gap-2">
                                  {item.photo && (
                                    <img
                                      src={item.photo}
                                      alt={item.title}
                                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                      {item.type === 'lot' ? (
                                        <Package className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                      ) : (
                                        <Tag className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-xs font-medium text-slate-900 line-clamp-2 group-hover:text-blue-600">
                                      {item.title}
                                    </p>
                                    <p className="text-sm font-bold text-emerald-600 mt-1">
                                      {item.price.toFixed(2)} €
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className="text-sm text-slate-600">Articles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-600 rounded"></div>
                <span className="text-sm text-slate-600">Lots</span>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-semibold">{items.length}</span> items planifiés
            </div>
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-slate-900">Actions rapides</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedItem.photo && (
                  <img
                    src={selectedItem.photo}
                    alt={selectedItem.title}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedItem.type === 'lot' ? (
                      <Package className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Tag className="w-5 h-5 text-blue-600" />
                    )}
                    <span className="text-sm font-medium text-slate-600">
                      {selectedItem.type === 'lot' ? 'Lot' : 'Article'}
                    </span>
                    {selectedItem.referenceNumber && (
                      <span className="text-sm text-slate-500">#{selectedItem.referenceNumber}</span>
                    )}
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">{selectedItem.title}</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Prix</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedItem.price.toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Date planifiée</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'full'
                      }).format(selectedItem.scheduledFor)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Vendeur</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {allSellers.find(s => s.id === selectedItem.sellerId)?.name || 'Inconnu'}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handlePublishNow}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="w-5 h-5" />
                    Publier maintenant
                  </button>
                  <button
                    onClick={handleViewDetails}
                    className="flex-1 bg-slate-100 text-slate-700 px-6 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Voir les détails
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminDetailDrawer
        item={fullItemDetails}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedItem(null);
        }}
        onEdit={handleEdit}
        onPublish={handlePublishNow}
        onDuplicate={handleDuplicate}
        onSchedule={handleSchedule}
        onMarkSold={handleMarkSold}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onLabelOpen={handleLabelOpen}
        formatDate={formatDate}
      />
    </div>
  );
}
