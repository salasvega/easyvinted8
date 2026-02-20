export type SizeType = 'top' | 'bottom' | 'shoe' | 'none';

const SHOE_CATEGORIES = [
  'baskets',
  'bottes',
  'bottines',
  'sandales',
  'talons',
  'chaussures plates',
  'chaussures de sport',
  'chaussures',
  'sneakers',
  'mocassins',
  'ballerines',
  'espadrilles',
  'tongs',
  'sabots',
];

const BOTTOM_CATEGORIES = [
  'pantalons',
  'jeans',
  'shorts',
  'jupes',
  'leggings',
  'joggings',
  'pantalon',
  'jean',
  'short',
  'jupe',
  'pantalon de randonnée',
  'pantalon de ski',
  'pantalon de sport',
  'pantalon cargo',
  'pantalon chino',
  'pantalon tailleur',
  'bas',
  'bermuda',
  'cycliste',
  'sarouel',
];

const TOP_CATEGORIES = [
  'robes',
  't-shirts',
  'tops & débardeurs',
  'chemises & blouses',
  'pulls, sweats & hoodies',
  'manteaux & vestes',
  'ensembles & combinaisons',
  'maillots de bain',
  'sportswear',
  'lingerie & sous-vêtements',
  'pyjamas & homewear',
  'vêtements de grossesse',
  'robe',
  't-shirt',
  'top',
  'débardeur',
  'chemise',
  'blouse',
  'pull',
  'sweat',
  'hoodie',
  'manteau',
  'veste',
  'gilet',
  'cardigan',
  'blazer',
  'costume',
  'ensemble',
  'combinaison',
  'maillot de bain',
  'lingerie',
  'pyjama',
];

export function determineSizeType(category?: string, brand?: string, title?: string): SizeType {
  if (!category && !brand && !title) {
    return 'top';
  }

  const searchText = `${category || ''} ${brand || ''} ${title || ''}`.toLowerCase();

  if (SHOE_CATEGORIES.some(cat => searchText.includes(cat))) {
    return 'shoe';
  }

  if (BOTTOM_CATEGORIES.some(cat => searchText.includes(cat))) {
    return 'bottom';
  }

  if (TOP_CATEGORIES.some(cat => searchText.includes(cat))) {
    return 'top';
  }

  return 'top';
}

export function getSizeFromMember(
  member: { top_size?: string | null; bottom_size?: string | null; shoe_size?: string | null } | null | undefined,
  sizeType: SizeType
): string {
  if (!member) return '';

  switch (sizeType) {
    case 'shoe':
      return member.shoe_size || '';
    case 'bottom':
      return member.bottom_size || '';
    case 'top':
      return member.top_size || '';
    default:
      return '';
  }
}
