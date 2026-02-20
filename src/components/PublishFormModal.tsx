import { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, ShoppingBag, Package } from 'lucide-react';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { VINTED_CATEGORIES } from '../constants/categories';
import { Article } from '../types/article';

interface Lot {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_percentage: number;
  original_total_price: number;
  reference_number?: string;
  status: string;
  seo_keywords?: string[];
}

interface PublishFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'article' | 'lot';
  onPublished?: () => void;
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tag: 'Neuf avec étiquette',
  new_without_tag: 'Neuf sans étiquette',
  new_with_tags: 'Neuf avec étiquettes',
  new_without_tags: 'Neuf sans étiquettes',
  very_good: 'Très bon état',
  good: 'Bon état',
  satisfactory: 'Satisfaisant',
};

export function PublishFormModal({ isOpen, onClose, itemId, itemType, onPublished }: PublishFormModalProps) {
  const { user } = useAuth();
  const [item, setItem] = useState<any | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [markingAsPublished, setMarkingAsPublished] = useState(false);

  useEffect(() => {
    if (isOpen && itemId) {
      loadItem();
    }
  }, [isOpen, itemId, itemType]);

  async function loadItem() {
    if (!itemId || !user) return;

    setLoading(true);
    try {
      if (itemType === 'article') {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setItem(data);
      } else {
        const { data: lotData, error: lotError } = await supabase
          .from('lots')
          .select('*')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .single();

        if (lotError) throw lotError;

        const { data: itemsData, error: itemsError } = await supabase
          .from('lot_items')
          .select(`
            articles (
              id,
              title,
              brand,
              price,
              photos,
              size,
              description
            )
          `)
          .eq('lot_id', itemId);

        if (itemsError) throw itemsError;

        const articlesList = itemsData.map((i: any) => i.articles).filter(Boolean);

        setItem(lotData);
        setArticles(articlesList as Article[]);
      }
    } catch (error) {
      console.error('Error loading item:', error);
      setToast({ message: 'Erreur lors du chargement', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setToast({ message: `${fieldName} copié !`, type: 'success' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const markAsPublished = async () => {
    if (!itemId || !user) return;

    setMarkingAsPublished(true);
    try {
      const tableName = itemType === 'article' ? 'articles' : 'lots';
      const { error } = await supabase
        .from(tableName)
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) throw error;

      setToast({
        message: `${itemType === 'article' ? 'Article' : 'Lot'} marqué comme publié !`,
        type: 'success'
      });

      setTimeout(() => {
        onPublished?.();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error marking as published:', error);
      setToast({ message: 'Erreur lors de la mise à jour', type: 'error' });
    } finally {
      setMarkingAsPublished(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {itemType === 'article' ? (
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            ) : (
              <Package className="w-6 h-6 text-purple-600" />
            )}
            <h2 className="text-2xl font-bold text-slate-900">
              Formulaire de publication Vinted
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Copiez les informations ci-dessous et collez-les dans le formulaire Vinted.
              Une fois publié sur Vinted, cliquez sur "Marquer comme publié" en bas de page.
            </p>
          </div>

          {itemType === 'article' ? (
            // Article Form
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Titre
                  </label>
                  <button
                    onClick={() => copyToClipboard(item.title, 'Titre')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {copiedField === 'Titre' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <p className="text-slate-900 font-medium">{item.title}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Description
                  </label>
                  <button
                    onClick={() => copyToClipboard(item.description, 'Description')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {copiedField === 'Description' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{item.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prix
                  </label>
                  <p className="text-2xl font-bold text-emerald-600">{item.price} €</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    État
                  </label>
                  <p className="text-slate-900 font-medium">
                    {CONDITION_LABELS[item.condition] || item.condition}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Marque
                    </label>
                    <button
                      onClick={() => copyToClipboard(item.brand, 'Marque')}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {copiedField === 'Marque' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copier
                    </button>
                  </div>
                  <p className="text-slate-900 font-medium">{item.brand}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Taille
                  </label>
                  <p className="text-slate-900 font-medium">{item.size}</p>
                </div>
              </div>

              {item.color && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Couleur
                  </label>
                  <p className="text-slate-900 font-medium">{item.color}</p>
                </div>
              )}

              {item.material && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Matière
                  </label>
                  <p className="text-slate-900 font-medium">{item.material}</p>
                </div>
              )}

              {item.seo_keywords && item.seo_keywords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Mots-clés SEO
                    </label>
                    <button
                      onClick={() => copyToClipboard(item.seo_keywords.join(', '), 'Mots-clés')}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {copiedField === 'Mots-clés' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copier
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.seo_keywords.map((keyword: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.photos && item.photos.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Photos ({item.photos.length})
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {item.photos.map((photo: string, index: number) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {index === 0 && (
                          <div className="absolute top-1 left-1 px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded">
                            Principale
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Lot Form
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Titre du lot
                  </label>
                  <button
                    onClick={() => copyToClipboard(item.name, 'Titre')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {copiedField === 'Titre' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <p className="text-slate-900 font-medium">{item.name}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Description du lot
                  </label>
                  <button
                    onClick={() => copyToClipboard(item.description, 'Description')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {copiedField === 'Description' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{item.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prix du lot
                  </label>
                  <p className="text-2xl font-bold text-emerald-600">{item.price} €</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prix d'origine
                  </label>
                  <p className="text-lg font-medium text-slate-600 line-through">
                    {item.original_total_price} €
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Réduction
                  </label>
                  <p className="text-lg font-bold text-orange-600">
                    -{item.discount_percentage}%
                  </p>
                </div>
              </div>

              {item.seo_keywords && item.seo_keywords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Mots-clés SEO
                    </label>
                    <button
                      onClick={() => copyToClipboard(item.seo_keywords.join(', '), 'Mots-clés')}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {copiedField === 'Mots-clés' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copier
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.seo_keywords.map((keyword: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {articles.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Articles inclus ({articles.length})
                  </label>
                  <div className="space-y-3">
                    {articles.map((article: any, index: number) => (
                      <div
                        key={article.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        {article.photos && article.photos[0] && (
                          <img
                            src={article.photos[0]}
                            alt={article.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{article.title}</p>
                          <p className="text-sm text-slate-600">
                            {article.brand} - Taille {article.size}
                          </p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {article.price} €
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Annuler
            </button>
            <Button
              onClick={markAsPublished}
              disabled={markingAsPublished}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {markingAsPublished ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Marquage en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Marquer comme publié
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
