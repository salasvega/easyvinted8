# Guide : Système de Cache des Prix Optimaux

## Problème résolu

Avant cette implémentation, l'analyse du prix optimal se déclenchait **à chaque chargement** du drawer d'édition d'article, ce qui causait :
- Des appels API inutiles à Gemini (coût et latence)
- Une génération répétée de la même suggestion
- Une mauvaise expérience utilisateur

## Solution : Cache en base de données

Le prix optimal suggéré est maintenant **sauvegardé dans la base de données** lors de la première analyse, puis **réutilisé** lors des chargements ultérieurs.

---

## Nouvelles colonnes dans la table `articles`

La migration `add_optimal_price_to_articles` ajoute 4 colonnes :

| Colonne | Type | Description |
|---------|------|-------------|
| `suggested_price_optimal` | `numeric(10,2)` | Prix optimal suggéré par Kelly (valeur unique) |
| `price_analysis_reasoning` | `text` | Explication détaillée du prix suggéré |
| `price_analysis_confidence` | `numeric(3,2)` | Score de confiance (0-1) |
| `price_analyzed_at` | `timestamptz` | Date/heure de l'analyse |

Ces colonnes complètent les colonnes existantes :
- `suggested_price_min` : Prix minimum de la fourchette
- `suggested_price_max` : Prix maximum de la fourchette

---

## Fonctionnement du composant `PriceSuggestion`

### Nouvelles props

```typescript
interface PriceSuggestionProps {
  // Props existantes
  brand?: string;
  title?: string;
  condition?: string;
  currentPrice?: number;
  onApplyPrice?: (price: number) => void;

  // Nouvelles props
  cachedSuggestion?: PricingData | null;         // Données en cache
  onSuggestionGenerated?: (data: PricingData) => void; // Callback après génération
  autoGenerate?: boolean;                         // Auto-générer si pas de cache
}
```

### Comportement

1. **Si `cachedSuggestion` est fourni** → Utilise les données du cache, **pas d'appel API**
2. **Si `cachedSuggestion` est null ET `autoGenerate=true`** → Génère une nouvelle suggestion
3. **Si `autoGenerate=false`** → N'affiche rien (mode passif)

---

## Workflow dans `ArticleFormDrawer`

### 1. Création d'un nouvel article

```typescript
<PriceSuggestion
  brand={formData.brand}
  title={formData.title}
  condition={formData.condition}
  currentPrice={formData.price ? parseFloat(formData.price) : undefined}
  onApplyPrice={(price) => setFormData({ ...formData, price: price.toString() })}
  cachedSuggestion={null}  // Pas de cache pour un nouvel article
  onSuggestionGenerated={handlePriceSuggestionGenerated}
  autoGenerate={true}  // ✅ Génère automatiquement
/>
```

**Résultat :**
- L'utilisateur remplit `brand`, `title`, `condition`
- Après 1,5s, Kelly génère le prix optimal
- Le callback `handlePriceSuggestionGenerated` met à jour `formData` avec :
  - `suggested_price_min`, `suggested_price_max`, `suggested_price_optimal`
  - `price_analysis_reasoning`, `price_analysis_confidence`
  - Si `price` est vide, applique automatiquement `optimal`
- À la sauvegarde, ces données sont stockées en BDD avec `price_analyzed_at`

### 2. Édition d'un article existant

```typescript
<PriceSuggestion
  brand={formData.brand}
  title={formData.title}
  condition={formData.condition}
  currentPrice={formData.price ? parseFloat(formData.price) : undefined}
  onApplyPrice={(price) => setFormData({ ...formData, price: price.toString() })}
  cachedSuggestion={
    formData.suggested_price_optimal
      ? {
          suggestedMin: formData.suggested_price_min || 0,
          suggestedMax: formData.suggested_price_max || 0,
          optimal: formData.suggested_price_optimal,
          reasoning: formData.price_analysis_reasoning || '',
          confidence: formData.price_analysis_confidence || 0,
        }
      : null
  }
  onSuggestionGenerated={handlePriceSuggestionGenerated}
  autoGenerate={false}  // ✅ N'auto-génère PAS, utilise le cache
/>
```

**Résultat :**
- Les données sont chargées depuis la BDD
- Si `suggested_price_optimal` existe → Affiche les données en cache
- Si `suggested_price_optimal` est null → N'affiche rien (article créé avant la migration)
- **Pas d'appel API** = performance optimale

---

## Callback `handlePriceSuggestionGenerated`

```typescript
const handlePriceSuggestionGenerated = useCallback((data: PricingData) => {
  setFormData((prev) => ({
    ...prev,
    suggested_price_min: data.suggestedMin,
    suggested_price_max: data.suggestedMax,
    suggested_price_optimal: data.optimal,
    price_analysis_reasoning: data.reasoning,
    price_analysis_confidence: data.confidence,
    // Si le prix est vide, applique automatiquement le prix optimal
    price: !prev.price ? data.optimal.toString() : prev.price,
  }));
}, []);
```

---

## Sauvegarde dans `handleSave`

```typescript
const articleData = {
  // ... autres champs
  suggested_price_min: formData.suggested_price_min,
  suggested_price_max: formData.suggested_price_max,
  suggested_price_optimal: formData.suggested_price_optimal,
  price_analysis_reasoning: formData.price_analysis_reasoning,
  price_analysis_confidence: formData.price_analysis_confidence,
  // ✅ Timestamp uniquement si un prix optimal existe
  price_analyzed_at: formData.suggested_price_optimal ? new Date().toISOString() : null,
};
```

---

## Avantages

✅ **Performance** : Pas d'appel API inutile à chaque ouverture du drawer
✅ **Coût** : Économie de tokens Gemini
✅ **UX** : Chargement instantané des données de pricing
✅ **Historique** : Conservation de l'analyse originale avec timestamp
✅ **Flexibilité** : Possibilité de forcer une nouvelle analyse si nécessaire (futur)

---

## Cas d'usage avancés (futurs)

### Forcer une nouvelle analyse

Pour implémenter un bouton "Régénérer le prix" :

```typescript
const [forceRegenerate, setForceRegenerate] = useState(false);

<PriceSuggestion
  cachedSuggestion={forceRegenerate ? null : cachedData}
  autoGenerate={forceRegenerate || !cachedData}
  onSuggestionGenerated={(data) => {
    handlePriceSuggestionGenerated(data);
    setForceRegenerate(false);
  }}
/>

<button onClick={() => setForceRegenerate(true)}>
  🔄 Régénérer le prix
</button>
```

### Détecter les prix obsolètes

On peut identifier les articles dont l'analyse date :

```sql
SELECT * FROM articles
WHERE price_analyzed_at < NOW() - INTERVAL '30 days'
  AND status IN ('draft', 'ready')
ORDER BY price_analyzed_at ASC;
```

---

## Migration

La migration est **non-destructive** et **rétrocompatible** :
- Les articles existants ont `suggested_price_optimal = null`
- Le composant détecte l'absence de cache et n'affiche rien
- Dès qu'on édite l'article et que Kelly génère une suggestion, elle est sauvegardée

---

## Résumé

| Scénario | Comportement |
|----------|--------------|
| Nouvel article | Kelly génère le prix automatiquement → Sauvegarde en BDD |
| Édition article avec cache | Affiche le cache → Pas d'appel API |
| Édition article sans cache | N'affiche rien (articles anciens) |
| "Analyser l'article" cliqué | Génère le prix si absent, puis sauvegarde |

Le système est maintenant **économe, rapide et intelligent** ! 🚀
