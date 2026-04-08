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
              {/* 1. Photos */}
              {item.photos && item.photos.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Photos ({item.photos.length})
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Téléchargez vos photos dans l'ordre</p>
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

              {/* 2. Titre */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700">
                      Titre
                    </label>
                    <p className="text-xs text-slate-500">Le titre de votre article</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.title, 'Titre')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors ml-4"
                  >
                    {copiedField === 'Titre' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.title}</p>
                </div>
              </div>

              {/* 3. Description */}
              <div className={`rounded-lg border p-4 ${
                item.seo_keywords && item.seo_keywords.length > 0
                  ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <label className={`block text-sm font-semibold ${
                      item.seo_keywords && item.seo_keywords.length > 0 ? 'text-teal-900' : 'text-slate-700'
                    }`}>
                      {item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description'}
                    </label>
                    <p className={`text-xs ${
                      item.seo_keywords && item.seo_keywords.length > 0 ? 'text-teal-600' : 'text-slate-500'
                    }`}>
                      {item.seo_keywords && item.seo_keywords.length > 0
                        ? 'Description avec mots-clés SEO automatiquement ajoutés'
                        : 'Description détaillée de l\'article'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const descWithSeo = item.seo_keywords && item.seo_keywords.length > 0
                        ? item.description + (item.description && !item.description.endsWith('\n') ? '\n\n' : '') + item.seo_keywords.join(' • ')
                        : item.description;
                      copyToClipboard(descWithSeo, item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ml-4 ${
                      item.seo_keywords && item.seo_keywords.length > 0
                        ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border border-teal-300'
                        : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    {copiedField === (item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description') ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm whitespace-pre-wrap">
                    {item.seo_keywords && item.seo_keywords.length > 0
                      ? item.description + (item.description && !item.description.endsWith('\n') ? '\n\n' : '') + item.seo_keywords.join(' • ')
                      : item.description}
                  </p>
                </div>
              </div>

              {/* 4. Marque */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700">
                      Marque
                    </label>
                    <p className="text-xs text-slate-500">La marque du produit</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.brand, 'Marque')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors ml-4"
                  >
                    {copiedField === 'Marque' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.brand}</p>
                </div>
              </div>

              {/* 5. Taille */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Taille
                </label>
                <p className="text-xs text-slate-500 mb-2">La taille de l'article</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.size}</p>
                </div>
              </div>

              {/* 6. État */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  État
                </label>
                <p className="text-xs text-slate-500 mb-2">L'état du produit</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">
                    {CONDITION_LABELS[item.condition] || item.condition}
                  </p>
                </div>
              </div>

              {/* 7. Couleur */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Couleur
                </label>
                <p className="text-xs text-slate-500 mb-2">Couleur principale</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.color || 'Non définie'}</p>
                </div>
              </div>

              {/* 8. Matière */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Matière
                </label>
                <p className="text-xs text-slate-500 mb-2">Matière principale</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.material || 'Non définie'}</p>
                </div>
              </div>

              {/* 9. Prix */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Prix
                </label>
                <p className="text-xs text-slate-500 mb-2">Prix de vente</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-2xl font-bold text-emerald-600">{item.price.toFixed(2)} €</p>
                </div>
              </div>
            </div>
          ) : (
            // Lot Form
            <div className="space-y-4">
              {/* 1. Photos */}
              {(() => {
                const allPhotos = articles.flatMap((a: any) => a.photos || []);
                return allPhotos.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Photos ({allPhotos.length})
                    </label>
                    <p className="text-xs text-slate-500 mb-3">Téléchargez toutes les photos des articles dans l'ordre</p>
                    <div className="grid grid-cols-4 gap-2">
                      {allPhotos.slice(0, 8).map((photo: string, idx: number) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                          <img
                            src={photo}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {allPhotos.length > 8 && (
                        <div className="aspect-square rounded-lg bg-slate-200 flex items-center justify-center">
                          <span className="text-slate-600 font-medium">+{allPhotos.length - 8}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Titre */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700">
                      Titre
                    </label>
                    <p className="text-xs text-slate-500">Le titre de votre lot</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.name, 'Titre')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors ml-4"
                  >
                    {copiedField === 'Titre' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copier
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.name}</p>
                </div>
              </div>

              {/* 3. Description */}
              {(() => {
                const articlesDescription = articles.map((a: any, idx: number) =>
                  `${idx + 1}. ${a.title} - ${a.brand || 'Sans marque'} - Taille ${a.size || 'N/A'}`
                ).join('\n');
                const fullDescription = `${item.description}\n\nArticles inclus dans ce lot :\n${articlesDescription}`;
                const fullDescriptionWithSeo = item.seo_keywords && item.seo_keywords.length > 0
                  ? fullDescription + (fullDescription && !fullDescription.endsWith('\n') ? '\n\n' : '') + item.seo_keywords.join(' • ')
                  : fullDescription;

                return (
                  <div className={`rounded-lg border p-4 ${
                    item.seo_keywords && item.seo_keywords.length > 0
                      ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <label className={`block text-sm font-semibold ${
                          item.seo_keywords && item.seo_keywords.length > 0 ? 'text-teal-900' : 'text-slate-700'
                        }`}>
                          {item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description'}
                        </label>
                        <p className={`text-xs ${
                          item.seo_keywords && item.seo_keywords.length > 0 ? 'text-teal-600' : 'text-slate-500'
                        }`}>
                          {item.seo_keywords && item.seo_keywords.length > 0
                            ? 'Description avec mots-clés SEO automatiquement ajoutés'
                            : 'Description détaillée du lot avec la liste des articles'}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(fullDescriptionWithSeo, item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ml-4 ${
                          item.seo_keywords && item.seo_keywords.length > 0
                            ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border border-teal-300'
                            : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                      >
                        {copiedField === (item.seo_keywords && item.seo_keywords.length > 0 ? 'Description pour Vinted' : 'Description') ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        Copier
                      </button>
                    </div>
                    <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-slate-900 font-mono text-sm whitespace-pre-wrap">{fullDescriptionWithSeo}</p>
                    </div>
                  </div>
                );
              })()}

              {/* 4. Prix */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Prix
                </label>
                <p className="text-xs text-slate-500 mb-2">Prix du lot</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-2xl font-bold text-emerald-600">{item.price.toFixed(2)} €</p>
                </div>
              </div>

              {/* 5. Nombre d'articles */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre d'articles
                </label>
                <p className="text-xs text-slate-500 mb-2">Nombre total d'articles dans le lot</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">
                    {articles.length} article{articles.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* 6. Remise */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Remise
                </label>
                <p className="text-xs text-slate-500 mb-2">Pourcentage de remise appliqué</p>
                <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-slate-900 font-mono text-sm">{item.discount_percentage}%</p>
                </div>
              </div>
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
