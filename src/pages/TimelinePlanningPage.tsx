import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter, Package, Tag, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { supabase } from '../lib/supabase';
import { Article } from '../types/article';
import { Lot } from '../types/lot';
import { PublishFormModal } from '../components/PublishFormModal';

type ViewMode = 'week' | 'month' | 'year';

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
  const { data: familyMembers = [] } = useFamilyMembers(user?.id);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<TimelineItem | null>(null);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishItem, setPublishItem] = useState<{ id: string; type: 'article' | 'lot' } | null>(null);

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
    } else if (viewMode === 'month') {
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else {
      // year mode
      start.setMonth(0);
      start.setDate(1);
      const end = new Date(start.getFullYear(), 11, 31);
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
    } else if (viewMode === 'month') {
      const daysInMonth = end.getDate();
      const weeksToShow = Math.ceil(daysInMonth / 7);
      for (let week = 0; week < weeksToShow; week++) {
        const weekStart = new Date(start);
        weekStart.setDate(1 + week * 7);
        slots.push(weekStart);
      }
    } else {
      // year mode - generate 12 months
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(start.getFullYear(), month, 1);
        slots.push(monthDate);
      }
    }

    return slots;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      // year mode
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
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
    } else if (viewMode === 'month') {
      const weekNum = Math.ceil(date.getDate() / 7);
      return `S${weekNum}`;
    } else {
      // year mode - show month name
      return new Intl.DateTimeFormat('fr-FR', {
        month: 'short'
      }).format(date);
    }
  };

  const getItemsForDateAndSeller = (date: Date, sellerId: string) => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);

    if (viewMode === 'week') {
      dateEnd.setHours(23, 59, 59, 999);
    } else if (viewMode === 'month') {
      dateEnd.setDate(dateEnd.getDate() + 6);
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      // year mode - get all items for the month
      dateEnd.setMonth(dateEnd.getMonth() + 1);
      dateEnd.setDate(0);
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
    // Ouvrir directement la modale de publication
    setPublishItem({ id: item.id, type: item.type });
    setPublishModalOpen(true);
  };


  const toggleSellerFilter = (sellerId: string) => {
    setSelectedSellers(prev =>
      prev.includes(sellerId)
        ? prev.filter(id => id !== sellerId)
        : [...prev, sellerId]
    );
  };

  const handlePublishClick = (item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setPublishItem({ id: item.id, type: item.type });
    setPublishModalOpen(true);
  };

  const handlePublished = async () => {
    await loadItems();
    setPublishModalOpen(false);
    setPublishItem(null);
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
      <div className="max-w-[1800px] mx-auto p-3 sm:p-4 md:p-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
                  <Calendar className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Timeline Planning</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5 sm:mt-1 hidden sm:block">
                  Organisez vos publications par drag & drop
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="inline-flex items-center bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Mois
                </button>
                <button
                  onClick={() => setViewMode('year')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'year'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Année
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-4 mt-3 sm:mt-4">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 min-w-0 flex-1 px-2">
              <h2 className="text-xs sm:text-base md:text-lg font-semibold text-slate-900 text-center truncate max-w-full">
                {viewMode === 'week'
                  ? `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`
                  : viewMode === 'month'
                  ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate)
                  : currentDate.getFullYear().toString()
                }
              </h2>
              <button
                onClick={goToToday}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
              >
                Aujourd'hui
              </button>
            </div>

            <button
              onClick={() => navigatePeriod('next')}
              className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </button>
          </div>

          <div className="mt-3 sm:mt-4 bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg flex-shrink-0">
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-slate-900">Filtrer par vendeur</h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {allSellers.map(seller => {
                const isSelected = selectedSellers.includes(seller.id);
                return (
                  <button
                    key={seller.id}
                    onClick={() => toggleSellerFilter(seller.id)}
                    className={`group relative px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md sm:shadow-lg shadow-blue-500/30 scale-105'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:scale-102'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-white shadow-sm'
                          : 'bg-slate-300 group-hover:bg-blue-400'
                      }`} />
                      <span className="truncate max-w-[120px] sm:max-w-none">{seller.name}</span>
                      {isSelected && (
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 ml-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <div className={viewMode === 'week' ? 'inline-block min-w-full' : 'w-full'}>
              <div className="grid" style={{
                gridTemplateColumns: viewMode === 'week'
                  ? `minmax(100px, max-content) repeat(${timeSlots.length}, 140px)`
                  : `minmax(100px, 150px) repeat(${timeSlots.length}, 1fr)`
              }}>
                <div className="sticky left-0 bg-gradient-to-r from-slate-50 to-slate-100 border-r-2 border-slate-300 px-3 py-3 font-semibold text-slate-700 z-10 shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs sm:text-sm whitespace-nowrap">Vendeur</span>
                  </div>
                </div>
                {timeSlots.map((date, idx) => {
                  const isToday = date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth() &&
                    date.getFullYear() === new Date().getFullYear();

                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 px-2 py-2 text-center ${
                        isToday ? 'bg-gradient-to-b from-blue-50 to-blue-100 border-blue-300' : ''
                      }`}
                    >
                      <div className={`text-xs font-bold ${isToday ? 'text-blue-700' : 'text-slate-900'}`}>
                        {formatDateHeader(date)}
                      </div>
                      {viewMode === 'week' && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {isToday && (
                            <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                              Aujourd'hui
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredSellers.map((seller) => (
                  <div key={seller.id} className="contents">
                    <div className="sticky left-0 bg-white border-r-2 border-t border-slate-300 px-3 py-3 font-medium text-slate-900 z-10 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {seller.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold whitespace-nowrap truncate">{seller.name}</span>
                      </div>
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
                          className={`border-r border-t border-slate-200 p-1.5 min-h-[100px] transition-all duration-200 ${
                            isToday ? 'bg-blue-50/40 border-blue-200' : 'bg-white hover:bg-slate-50'
                          } ${draggedItem ? 'hover:bg-blue-100/50 hover:border-blue-300' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(date, seller.id);
                          }}
                        >
                          <div className="space-y-1.5">
                            {cellItems.length > 0 ? (
                              cellItems.map((item) => (
                                <div
                                  key={item.id}
                                  draggable
                                  onDragStart={() => handleDragStart(item)}
                                  onClick={() => handleItemClick(item)}
                                  className="bg-white border border-slate-200 rounded-lg p-1.5 cursor-move hover:shadow-lg hover:scale-[1.02] hover:border-blue-400 transition-all duration-200 group relative"
                                >
                                  {viewMode === 'year' ? (
                                    <div className="flex items-center gap-1.5">
                                      {item.photo && (
                                        <div className="relative">
                                          <img
                                            src={item.photo}
                                            alt={item.title}
                                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                                          />
                                          <button
                                            onClick={(e) => handlePublishClick(item, e)}
                                            className="absolute inset-0 bg-emerald-500/90 hover:bg-emerald-600/90 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            title="Publier"
                                          >
                                            <Play className="w-3 h-3 fill-white" />
                                          </button>
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 mb-0.5">
                                          {item.type === 'lot' ? (
                                            <Package className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                                          ) : (
                                            <Tag className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                                          )}
                                          <p className="text-[9px] font-bold text-emerald-600">
                                            {item.price.toFixed(2)}€
                                          </p>
                                        </div>
                                        <p className="text-[9px] font-medium text-slate-700 line-clamp-1 group-hover:text-blue-600">
                                          {item.title}
                                        </p>
                                      </div>
                                    </div>
                                  ) : viewMode === 'week' ? (
                                    <div className="space-y-1">
                                      {item.photo && (
                                        <div className="relative">
                                          <img
                                            src={item.photo}
                                            alt={item.title}
                                            className="w-full h-16 rounded object-cover"
                                          />
                                          <button
                                            onClick={(e) => handlePublishClick(item, e)}
                                            className="absolute top-1 right-1 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            title="Publier"
                                          >
                                            <Play className="w-3 h-3 fill-white" />
                                          </button>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1">
                                        {item.type === 'lot' ? (
                                          <div className="w-5 h-5 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                                            <Package className="w-3 h-3 text-purple-600" />
                                          </div>
                                        ) : (
                                          <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                                            <Tag className="w-3 h-3 text-blue-600" />
                                          </div>
                                        )}
                                        <p className="text-[10px] font-bold text-emerald-600 flex-shrink-0">
                                          {item.price.toFixed(2)}€
                                        </p>
                                      </div>
                                      <p className="text-[10px] font-medium text-slate-700 line-clamp-2 group-hover:text-blue-600 leading-tight">
                                        {item.title}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {item.photo && (
                                        <div className="relative">
                                          <img
                                            src={item.photo}
                                            alt={item.title}
                                            className="w-full h-20 rounded object-cover"
                                          />
                                          <button
                                            onClick={(e) => handlePublishClick(item, e)}
                                            className="absolute top-1 right-1 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            title="Publier"
                                          >
                                            <Play className="w-3 h-3 fill-white" />
                                          </button>
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          {item.type === 'lot' ? (
                                            <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                                              <Package className="w-2.5 h-2.5 text-purple-600" />
                                            </div>
                                          ) : (
                                            <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                                              <Tag className="w-2.5 h-2.5 text-blue-600" />
                                            </div>
                                          )}
                                          <p className="text-[10px] font-bold text-emerald-600">
                                            {item.price.toFixed(2)}€
                                          </p>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-700 line-clamp-2 group-hover:text-blue-600 leading-tight">
                                          {item.title}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-center text-slate-400">
                                  <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  <p className="text-[9px]">Déposer ici</p>
                                </div>
                              </div>
                            )}
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

        <div className="mt-3 sm:mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-600 rounded flex-shrink-0"></div>
                <span className="text-xs sm:text-sm text-slate-600">Articles</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-600 rounded flex-shrink-0"></div>
                <span className="text-xs sm:text-sm text-slate-600">Lots</span>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-slate-600">
              <span className="font-semibold">{items.length}</span> items planifiés
            </div>
          </div>
        </div>
      </div>


      {publishItem && (
        <PublishFormModal
          isOpen={publishModalOpen}
          onClose={() => {
            setPublishModalOpen(false);
            setPublishItem(null);
          }}
          itemId={publishItem.id}
          itemType={publishItem.type}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
