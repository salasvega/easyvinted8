# Kelly Pricing - Seuils d'Optimisation Segmentés

## Vue d'ensemble

Kelly utilise désormais des seuils d'optimisation intelligents basés sur le prix de l'article pour éviter les suggestions trop fréquentes ou non pertinentes.

## Logique des seuils

### Articles < 10€
- **Seuil**: 20%
- **Rationale**: Sur des petits montants, une différence de 1-2€ n'est pas significative pour l'acheteur
- **Exemple**: Un article à 8€ ne sera optimisé que si le marché est à 9.60€+ (20%+ d'écart)

### Articles 10-50€
- **Seuil**: 15%
- **Rationale**: Gamme de prix standard sur Vinted où 15% représente un écart visible
- **Exemple**: Un article à 25€ ne sera optimisé que si le marché est à 28.75€+ (15%+ d'écart)

### Articles > 50€
- **Seuil**: 10%
- **Rationale**: Sur des articles de valeur, même 10% représente un montant significatif
- **Exemple**: Un article à 60€ ne sera optimisé que si le marché est à 66€+ (10%+ d'écart)

## Avantages

1. **Moins de fatigue décisionnelle**: Les utilisateurs reçoivent uniquement des suggestions pertinentes
2. **Crédibilité de Kelly**: Les recommandations sont plus impactantes
3. **Psychologie du prix**: Les seuils reflètent la perception réelle des acheteurs
4. **Prise en compte des frais**: Sur Vinted, les frais de port représentent 20-30% du total, donc les petits écarts sont négligeables

## Implémentation technique

```typescript
function getOptimizationThreshold(price: number): number {
  if (price < 10) {
    return 0.20; // 20%
  } else if (price <= 50) {
    return 0.15; // 15%
  } else {
    return 0.10; // 10%
  }
}
```

## Exemples concrets

### Cas 1: Article à 8€
- Marché à 9€: écart de 12.5% → **AUCUNE suggestion** (< 20%)
- Marché à 11€: écart de 37.5% → **Suggestion d'optimisation** (≥ 20%)

### Cas 2: Article à 25€
- Marché à 27€: écart de 8% → **AUCUNE suggestion** (< 15%)
- Marché à 30€: écart de 20% → **Suggestion d'optimisation** (≥ 15%)

### Cas 3: Article à 60€
- Marché à 65€: écart de 8% → **AUCUNE suggestion** (< 10%)
- Marché à 70€: écart de 16.7% → **Suggestion d'optimisation** (≥ 10%)

## Impact sur l'expérience utilisateur

Avant cette optimisation, Kelly pouvait suggérer de passer un article de 8€ à 9€, ce qui:
- Représente un gain négligeable après frais Vinted
- Crée de la fatigue décisionnelle
- Réduit la confiance envers les suggestions

Maintenant, Kelly se concentre sur les optimisations vraiment significatives, ce qui améliore:
- La confiance de l'utilisateur
- L'efficacité des actions
- Le taux d'application des suggestions
