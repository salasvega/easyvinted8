import { Article, ArticleStatus } from '../types/article';
import { Lot, LotStatus } from '../types/lot';

export function isArticleComplete(article: Partial<Article>): boolean {
  const hasTitle = !!article.title && article.title.trim().length > 0;
  const hasPhotos = !!article.photos && article.photos.length > 0;
  const hasPrice = article.price !== null && article.price !== undefined && article.price > 0;
  const hasBrand = !!article.brand && article.brand.trim().length > 0;
  const hasSize = !!article.size && article.size.trim().length > 0;

  return hasTitle && hasPhotos && hasPrice && hasBrand && hasSize;
}

export function isLotComplete(lot: Partial<Lot>): boolean {
  const hasName = !!lot.name && lot.name.trim().length > 0;
  const hasDescription = !!lot.description && lot.description.trim().length > 0;
  const hasPhotos = !!lot.photos && lot.photos.length > 0;
  const hasPrice = lot.price !== null && lot.price !== undefined && lot.price > 0;
  const hasCategoryId = lot.category_id !== null && lot.category_id !== undefined;
  const hasSeason = !!lot.season && lot.season.trim().length > 0;

  return hasName && hasDescription && hasPhotos && hasPrice && hasCategoryId && hasSeason;
}

export function determineArticleStatus(article: Partial<Article>, currentStatus?: ArticleStatus): ArticleStatus {
  if (currentStatus === 'sold' || currentStatus === 'vendu_en_lot' || currentStatus === 'published' || currentStatus === 'scheduled' || currentStatus === 'reserved') {
    return currentStatus;
  }

  return isArticleComplete(article) ? 'ready' : 'draft';
}

export function determineLotStatus(lot: Partial<Lot>, currentStatus?: LotStatus): LotStatus {
  if (currentStatus === 'sold' || currentStatus === 'published' || currentStatus === 'scheduled') {
    return currentStatus;
  }

  return isLotComplete(lot) ? 'ready' : 'draft';
}
