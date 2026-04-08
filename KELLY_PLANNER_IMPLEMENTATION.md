# Kelly Planner - Documentation Technique d'Implémentation

## Architecture Technique

### Structure des Fichiers

```
src/
├── lib/
│   └── kellyPlanningService.ts          # Service principal + logique IA
├── components/
│   └── KellyPlannerPanel.tsx            # Composant UI principal
└── pages/
    └── MonDressingPage.tsx              # Intégration dans la page

supabase/
└── migrations/
    └── create_kelly_planning_cache.sql  # Migration DB
```

## Service Layer - `kellyPlanningService.ts`

### Types TypeScript

```typescript
// Type de recommandation
export type PlanningInsightType =
  | 'seasonal_peak'        // Pic saisonnier
  | 'market_gap'           // Créneau de marché
  | 'demand_spike'         // Hausse de demande
  | 'stale_inventory'      // Inventaire dormant
  | 'bundle_opportunity'   // Opportunité de lot
  | 'weekend_boost'        // Boost weekend
  | 'price_optimize';      // Optimisation prix

// Niveau de priorité
export type PlanningPriority = 'urgent' | 'high' | 'medium' | 'low';

// Contexte de marché
export interface MarketContext {
  currentDemand: 'low' | 'medium' | 'high';
  competitionLevel: 'low' | 'medium' | 'high';
  priceOpportunity: number;
  timeWindowDays: number;
  seasonalTrend: 'rising' | 'peak' | 'declining' | 'off-season';
}

// Action suggérée
export interface SuggestedAction {
  type: 'publish_now' | 'schedule' | 'bundle_first' | 'wait' | 'adjust_price';
  scheduledDate?: string;
  reasoning: string;
  confidence: number;
  marketContext: MarketContext;
  priceAdjustment?: {
    current: number;
    suggested: number;
    change: number;
  };
}

// Insight complet
export interface PlanningInsight {
  id: string;
  type: PlanningInsightType;
  priority: PlanningPriority;
  title: string;
  message: string;
  articleIds: string[];
  lotIds?: string[];
  suggestedAction: SuggestedAction;
  status: 'active' | 'dismissed' | 'completed';
  createdAt: string;
  expiresAt: string;
}
```

### Fonctions Principales

#### 1. `getPlanningInsights(userId: string, forceRefresh: boolean)`
Point d'entrée principal du service.

**Workflow:**
```
1. Check cache (si !forceRefresh)
   └─> Si valide → retourne insights cachés
   └─> Si expiré → continue

2. Charge articles "ready" depuis Supabase
3. Charge lots "ready" depuis Supabase
4. Si aucun → retourne []

5. Récupère historique utilisateur
   └─> getUserHistory(userId)

6. Génère insights avec IA
   └─> generateInsightsWithAI(articles, lots, history)

7. Sauvegarde en cache
   └─> saveCacheToDatabase(userId, insights)

8. Retourne insights
```

**Code simplifié:**
```typescript
export async function getPlanningInsights(
  userId: string,
  forceRefresh = false
): Promise<PlanningInsight[]> {
  // 1. Check cache
  if (!forceRefresh) {
    const cached = await getCachedInsights(userId);
    if (cached) return cached;
  }

  // 2. Load data
  const { data: readyArticles } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ready');

  const { data: readyLots } = await supabase
    .from('lots')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ready');

  if (!readyArticles?.length && !readyLots?.length) {
    return [];
  }

  // 3. Get user history
  const userHistory = await getUserHistory(userId);

  // 4. Generate with AI
  const insights = await generateInsightsWithAI(
    readyArticles || [],
    readyLots || [],
    userHistory
  );

  // 5. Save cache
  await saveCacheToDatabase(userId, insights, articleCount);

  return insights;
}
```

#### 2. `getUserHistory(userId: string)`
Analyse l'historique de ventes pour personnaliser les recommandations.

**Calculs:**
```typescript
interface UserHistory {
  bestDays: string[];              // Ex: ['Samedi', 'Dimanche', 'Vendredi']
  avgSaleDuration: number;         // Ex: 14 (jours)
  seasonalConversion: Record<string, number>;  // Ex: { 'Été': 75, 'Hiver': 60 }
  categoryPerformance: Record<string, number>; // Ex: { 'Robes': 12, 'Jeans': 8 }
}
```

**Métriques calculées:**
- **bestDays**: Jours avec le plus de ventes (top 3)
- **avgSaleDuration**: Délai moyen entre création et vente
- **seasonalConversion**: % de ventes par saison
- **categoryPerformance**: Nombre de ventes par catégorie

#### 3. `generateInsightsWithAI(articles, lots, history)`
Génère les insights avec l'IA Gemini.

**Prompt Structure:**
```
┌─────────────────────────────────────┐
│ Tu es Kelly, stratège Vinted        │
├─────────────────────────────────────┤
│ 📅 DATE ACTUELLE                    │
│ 📦 ARTICLES PRÊTS (JSON)            │
│ 📦 LOTS PRÊTS (JSON)                │
│ 📈 HISTORIQUE UTILISATEUR           │
│    - Meilleurs jours                │
│    - Délai moyen vente              │
│    - Conversion saisonnière         │
│    - Performance catégories         │
├─────────────────────────────────────┤
│ 🎯 ANALYSE DEMANDÉE:                │
│ 1. Opportunités urgentes (<7j)     │
│ 2. Articles dormants (>30j)        │
│ 3. Timing optimal                   │
│ 4. Suggestions de lots              │
│ 5. Priorisation                     │
├─────────────────────────────────────┤
│ RETOURNE JSON ARRAY (max 10)       │
└─────────────────────────────────────┘
```

**Configuration Gemini:**
```typescript
const result = await ai.models.gemini_2_0_flash.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.7,           // Créatif mais précis
    maxOutputTokens: 8000,      // Assez pour 10 insights détaillés
    responseMimeType: 'application/json',  // Force JSON
  },
});
```

#### 4. Cache Management

**getCachedInsights(userId):**
```typescript
- SELECT depuis kelly_planning_cache
- Check expires_at vs now()
- Si expiré → retourne null
- Sinon → retourne insights
```

**saveCacheToDatabase(userId, insights, articleCount):**
```typescript
- Calcule expires_at = now() + 6 heures
- Compte insights par priorité
- UPSERT dans kelly_planning_cache
- onConflict: user_id (remplace si existe)
```

#### 5. Actions sur les Insights

**dismissInsight(userId, insightId):**
```typescript
1. Charge cache
2. Map insights → change status à 'dismissed'
3. UPDATE dans DB
```

**completeInsight(userId, insightId):**
```typescript
1. Charge cache
2. Map insights → change status à 'completed'
3. UPDATE dans DB
```

### Utilitaires

```typescript
// Formatage de la fenêtre temporelle
formatTimeWindow(days: number): string
  0 → "Aujourd'hui"
  1 → "Demain"
  2-3 → "X jours"
  4-7 → "Cette semaine"
  8-14 → "Dans 2 semaines"
  15+ → "Dans X semaines"

// Couleurs de priorité
getPriorityColor(priority): string
  urgent → 'text-red-600'
  high   → 'text-orange-600'
  medium → 'text-blue-600'
  low    → 'text-gray-600'

getPriorityBgColor(priority): string
  urgent → 'bg-red-50 border-red-200'
  high   → 'bg-orange-50 border-orange-200'
  medium → 'bg-blue-50 border-blue-200'
  low    → 'bg-gray-50 border-gray-200'

// Icônes
getPriorityIcon(priority): string
  urgent → '🔥'
  high   → '⚡'
  medium → '💡'
  low    → '📌'

getTypeIcon(type): string
  seasonal_peak      → '🌟'
  market_gap         → '🎯'
  demand_spike       → '📈'
  stale_inventory    → '⏰'
  bundle_opportunity → '📦'
  weekend_boost      → '🎉'
  price_optimize     → '💰'
```

## Component Layer - `KellyPlannerPanel.tsx`

### Props Interface

```typescript
interface KellyPlannerPanelProps {
  onScheduleArticle?: (articleIds: string[]) => void;
  onCreateBundle?: (articleIds: string[]) => void;
}
```

### State Management

```typescript
const [isOpen, setIsOpen] = useState(false);
const [insights, setInsights] = useState<PlanningInsight[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [hasLoaded, setHasLoaded] = useState(false);
```

**Lazy Loading Pattern:**
```typescript
useEffect(() => {
  // Ne charge que si le panel est ouvert ET pas déjà chargé
  if (isOpen && !hasLoaded) {
    loadInsights();
  }
}, [isOpen]);
```

### Logique de Chargement

```typescript
async function loadInsights(forceRefresh = false) {
  if (!user) return;

  try {
    setLoading(true);
    setError(null);

    // Appel au service
    const data = await getPlanningInsights(user.id, forceRefresh);

    setInsights(data);
    setHasLoaded(true);
  } catch (err) {
    console.error('Error loading planning insights:', err);
    setError('Impossible de charger les recommandations...');
  } finally {
    setLoading(false);
  }
}
```

### Gestion des Actions

```typescript
function handleAction(insight: PlanningInsight) {
  const action = insight.suggestedAction;

  switch (action.type) {
    case 'publish_now':
    case 'schedule':
      // Ouvre modal de planification
      if (onScheduleArticle && insight.articleIds.length > 0) {
        onScheduleArticle(insight.articleIds);
      }
      handleComplete(insight.id);
      break;

    case 'bundle_first':
      // Redirige vers LotBuilder
      if (onCreateBundle && insight.articleIds.length > 0) {
        onCreateBundle(insight.articleIds);
      }
      navigate('/lots/create', { state: { articleIds: insight.articleIds } });
      handleComplete(insight.id);
      break;

    case 'adjust_price':
      // Ouvre fiche article
      if (insight.articleIds.length === 1) {
        navigate(`/mon-dressing?edit=${insight.articleIds[0]}`);
      }
      break;

    case 'wait':
      // Ignore simplement
      handleDismiss(insight.id);
      break;
  }
}
```

### Tri et Affichage

```typescript
// Tri par priorité
activeInsights.sort((a, b) => {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return priorityOrder[a.priority] - priorityOrder[b.priority];
})
```

### États d'Affichage

**1. Loading:**
```jsx
<div className="flex items-center justify-center gap-3 py-8">
  <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
  <span>Kelly analyse vos articles...</span>
</div>
```

**2. Error:**
```jsx
<div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
  <AlertCircle className="w-5 h-5 text-red-600" />
  <div>
    <p className="text-sm font-medium text-red-900">Erreur</p>
    <p className="text-sm text-red-700 mt-1">{error}</p>
  </div>
</div>
```

**3. Empty State:**
```jsx
<div className="text-center py-8">
  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100">
    <Check className="w-8 h-8 text-purple-600" />
  </div>
  <h4>Tout est optimal !</h4>
  <p>Aucune recommandation pour le moment.</p>
</div>
```

**4. Insights List:**
```jsx
{activeInsights.map((insight) => (
  <InsightCard
    key={insight.id}
    insight={insight}
    onAction={() => handleAction(insight)}
    onDismiss={() => handleDismiss(insight.id)}
  />
))}
```

### Composant InsightCard

**Structure:**
```jsx
<div className={`rounded-xl border-2 p-4 ${priorityBg}`}>
  {/* Header avec icône et titre */}
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-2">
      <div className="text-2xl">{typeIcon}</div>
      <div>
        <h4 className={priorityColor}>{priorityLabel}</h4>
        <h5>{insight.title}</h5>
        <p>{insight.message}</p>
      </div>
    </div>
    <button onClick={onDismiss}>✕</button>
  </div>

  {/* Badges contexte */}
  <div className="flex gap-2">
    <Badge>Demande: {demand}</Badge>
    <Badge>Concurrence: {competition}</Badge>
    <Badge>Fenêtre: {timeWindow}</Badge>
    <Badge>Confiance: {confidence}%</Badge>
  </div>

  {/* Raisonnement */}
  <div className="bg-white/60 rounded-lg p-3">
    <p>{insight.suggestedAction.reasoning}</p>
  </div>

  {/* Ajustement prix (si applicable) */}
  {priceAdjustment && (
    <div className="bg-orange-50">
      <div>Prix actuel: {current}€</div>
      <div>Prix suggéré: {suggested}€ ({change}%)</div>
    </div>
  )}

  {/* Bouton d'action */}
  <button onClick={onAction}>
    {actionIcon} {actionLabel}
  </button>

  {/* Footer */}
  <div>
    {articleCount} article(s) concerné(s)
  </div>
</div>
```

## Intégration - `MonDressingPage.tsx`

### Import

```typescript
import { KellyPlannerPanel } from '../components/KellyPlannerPanel';
```

### Placement

```jsx
{/* Kelly Pricing Panel */}
<div className="mb-4">
  <KellyPricingPanel ... />
</div>

{/* Kelly Planner Panel - Nouvellement ajouté */}
<div className="mb-4">
  <KellyPlannerPanel
    onScheduleArticle={(articleIds) => {
      const firstArticle = allItems.find(item => item.id === articleIds[0]);
      if (firstArticle) {
        setScheduleItem(firstArticle);
        setScheduleModalOpen(true);
      }
    }}
    onCreateBundle={(articleIds) => {
      setSelectedForLot(
        allItems
          .filter(item => articleIds.includes(item.id) && item.type === 'article')
          .map(item => item.id)
      );
      setShowLotBuilder(true);
    }}
  />
</div>
```

### Callbacks

**onScheduleArticle:**
- Récupère le premier article concerné
- Ouvre le ScheduleModal
- Pré-remplit avec l'article sélectionné

**onCreateBundle:**
- Filtre les articles (pas les lots)
- Définit selectedForLot
- Ouvre le LotBuilder

## Base de Données - Migration

### Table Structure

```sql
CREATE TABLE kelly_planning_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Données
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  market_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timing
  generated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Métadonnées
  article_count integer DEFAULT 0,
  priority_count jsonb DEFAULT '{"urgent": 0, "high": 0, "medium": 0, "low": 0}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id)
);
```

### RLS Policies

```sql
-- Lecture
CREATE POLICY "Users can read own planning cache"
  ON kelly_planning_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insertion
CREATE POLICY "Users can insert own planning cache"
  ON kelly_planning_cache FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour
CREATE POLICY "Users can update own planning cache"
  ON kelly_planning_cache FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Suppression
CREATE POLICY "Users can delete own planning cache"
  ON kelly_planning_cache FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

### Indexes

```sql
-- Pour la recherche par user_id
CREATE INDEX idx_kelly_planning_cache_user_id
  ON kelly_planning_cache(user_id);

-- Pour le nettoyage des caches expirés
CREATE INDEX idx_kelly_planning_cache_expires_at
  ON kelly_planning_cache(expires_at);
```

### Trigger Auto-update

```sql
CREATE FUNCTION update_kelly_planning_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kelly_planning_cache_updated_at
  BEFORE UPDATE ON kelly_planning_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_kelly_planning_cache_updated_at();
```

## Flux de Données Complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEUR                                   │
│                         │                                        │
│                         ▼                                        │
│              ┌──────────────────────┐                           │
│              │  MonDressingPage     │                           │
│              │  - Ouvre panel       │                           │
│              └──────────┬───────────┘                           │
│                         │                                        │
│                         ▼                                        │
│              ┌──────────────────────┐                           │
│              │  KellyPlannerPanel   │                           │
│              │  - Détecte ouverture │                           │
│              │  - Appelle service   │                           │
│              └──────────┬───────────┘                           │
│                         │                                        │
│                         ▼                                        │
│       ┌─────────────────────────────────────┐                  │
│       │  kellyPlanningService               │                  │
│       │  ┌──────────────────────────────┐   │                  │
│       │  │ 1. getCachedInsights()       │   │                  │
│       │  │    └─> Supabase query        │   │                  │
│       │  │    └─> Check expires_at      │   │                  │
│       │  └──────────┬───────────────────┘   │                  │
│       │             │                        │                  │
│       │             ▼                        │                  │
│       │  ┌──────────────────────────────┐   │                  │
│       │  │ 2. Load Articles + Lots      │   │                  │
│       │  │    └─> status = 'ready'      │   │                  │
│       │  └──────────┬───────────────────┘   │                  │
│       │             │                        │                  │
│       │             ▼                        │                  │
│       │  ┌──────────────────────────────┐   │                  │
│       │  │ 3. getUserHistory()          │   │                  │
│       │  │    └─> Analyse 50 ventes     │   │                  │
│       │  │    └─> Calcul métriques      │   │                  │
│       │  └──────────┬───────────────────┘   │                  │
│       │             │                        │                  │
│       │             ▼                        │                  │
│       │  ┌──────────────────────────────┐   │                  │
│       │  │ 4. generateInsightsWithAI()  │   │                  │
│       │  │    └─> Build prompt          │   │                  │
│       │  │    └─> Call Gemini API       │◄──┼─── GEMINI AI    │
│       │  │    └─> Parse JSON response   │   │                  │
│       │  └──────────┬───────────────────┘   │                  │
│       │             │                        │                  │
│       │             ▼                        │                  │
│       │  ┌──────────────────────────────┐   │                  │
│       │  │ 5. saveCacheToDatabase()     │   │                  │
│       │  │    └─> UPSERT cache          │   │                  │
│       │  │    └─> expires_at = +6h      │   │                  │
│       │  └──────────┬───────────────────┘   │                  │
│       │             │                        │                  │
│       └─────────────┼────────────────────────┘                  │
│                     │                                            │
│                     ▼                                            │
│          ┌──────────────────────┐                               │
│          │  Insights[]          │                               │
│          │  - urgent: 2         │                               │
│          │  - high: 3           │                               │
│          │  - medium: 4         │                               │
│          └──────────┬───────────┘                               │
│                     │                                            │
│                     ▼                                            │
│          ┌──────────────────────┐                               │
│          │  InsightCard         │                               │
│          │  - Affiche détails   │                               │
│          │  - Boutons actions   │                               │
│          └──────────┬───────────┘                               │
│                     │                                            │
│                     ▼                                            │
│          ┌──────────────────────┐                               │
│          │  Actions             │                               │
│          │  - Schedule          │                               │
│          │  - Bundle            │                               │
│          │  - Adjust Price      │                               │
│          │  - Dismiss           │                               │
│          └──────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Optimizations

### 1. Lazy Loading
- Le panel ne charge les insights que quand ouvert
- Évite les appels API inutiles au chargement de la page

### 2. Cache Layer
- Cache de 6 heures réduit drastiquement les appels API
- ~4 analyses par jour max par utilisateur
- UPSERT sur user_id évite les duplicatas

### 3. Query Optimization
```typescript
// Seulement les articles ready
.eq('status', 'ready')

// Limite aux 50 dernières ventes
.limit(50)

// Index sur user_id et expires_at
CREATE INDEX ...
```

### 4. Gemini Configuration
```typescript
temperature: 0.7,        // Bon équilibre créativité/précision
maxOutputTokens: 8000,   // Suffisant pour 10 insights
responseMimeType: 'application/json',  // Pas de parsing manuel
```

### 5. UI Optimizations
- AnimatePresence pour transitions smooth
- Lazy loading des images
- Virtual scrolling si beaucoup d'insights (TODO)

## Tests Suggérés

### Tests Unitaires

```typescript
// kellyPlanningService.test.ts
describe('formatTimeWindow', () => {
  it('formats 0 days as Aujourdhui', () => {
    expect(formatTimeWindow(0)).toBe("Aujourd'hui");
  });

  it('formats 1 day as Demain', () => {
    expect(formatTimeWindow(1)).toBe("Demain");
  });

  it('formats 7 days as Cette semaine', () => {
    expect(formatTimeWindow(7)).toBe("Cette semaine");
  });
});

describe('getPriorityColor', () => {
  it('returns red for urgent', () => {
    expect(getPriorityColor('urgent')).toBe('text-red-600');
  });
});

describe('getUserHistory', () => {
  it('calculates best sales days correctly', () => {
    // Mock sold articles
    // Assert bestDays calculation
  });
});
```

### Tests d'Intégration

```typescript
// KellyPlannerPanel.test.tsx
describe('KellyPlannerPanel', () => {
  it('loads insights when opened', async () => {
    // Mock service
    // Click to open
    // Assert loading state
    // Assert insights displayed
  });

  it('handles schedule action', () => {
    // Mock insight with publish_now
    // Click action button
    // Assert callback called
    // Assert insight marked completed
  });

  it('displays error on API failure', () => {
    // Mock API error
    // Open panel
    // Assert error message displayed
  });
});
```

### Tests E2E

```typescript
// kelly-planner.spec.ts (Playwright)
test('full Kelly Planner workflow', async ({ page }) => {
  await page.goto('/mon-dressing');

  // Wait for page load
  await page.waitForSelector('[data-testid="kelly-planner-panel"]');

  // Open panel
  await page.click('[data-testid="kelly-planner-toggle"]');

  // Wait for insights
  await page.waitForSelector('[data-testid="insight-card"]');

  // Count insights
  const insightCount = await page.locator('[data-testid="insight-card"]').count();
  expect(insightCount).toBeGreaterThan(0);

  // Click first action
  await page.click('[data-testid="insight-action-0"]');

  // Assert modal opened or navigation occurred
});
```

## Monitoring & Analytics

### Métriques à Suivre

```typescript
// Analytics events à ajouter
analytics.track('kelly_planner_opened', {
  userId,
  articleCount,
  insightCount,
});

analytics.track('kelly_planner_insight_generated', {
  userId,
  insightType,
  priority,
  confidence,
});

analytics.track('kelly_planner_action_taken', {
  userId,
  insightType,
  actionType,
  articleIds,
});

analytics.track('kelly_planner_insight_dismissed', {
  userId,
  insightType,
  reason,
});
```

### KPIs

1. **Taux d'adoption**
   - % utilisateurs qui ouvrent Kelly Planner
   - Fréquence d'utilisation

2. **Taux de conversion**
   - % insights → actions prises
   - % actions → ventes réalisées

3. **Performance IA**
   - Score de confiance moyen
   - Précision des prédictions vs résultats réels

4. **Performance technique**
   - Temps de génération des insights
   - Taux d'utilisation du cache
   - Coût API Gemini

## Coûts Estimés

### API Gemini Flash 2.0

```
Tokens par analyse:
- Input:  ~1500 tokens (prompt + data)
- Output: ~3000 tokens (10 insights détaillés)
- Total:  ~4500 tokens par analyse

Prix Gemini Flash 2.0:
- Input:  $0.075 / 1M tokens
- Output: $0.30 / 1M tokens

Coût par analyse:
- Input:  1500 * $0.075 / 1M = $0.0001125
- Output: 3000 * $0.30 / 1M = $0.0009
- Total:  ~$0.001 par analyse

Avec cache de 6h:
- 4 analyses/jour max
- 120 analyses/mois
- Coût mensuel: ~$0.12 par utilisateur

Pour 100 utilisateurs actifs:
- ~$12/mois
```

### Infrastructure Supabase

```
Stockage cache:
- ~50KB par utilisateur
- Négligeable sur plan gratuit/payant

Queries:
- ~10 queries par session
- Inclus dans quotas normaux
```

**Total estimé: < $20/mois pour 100 utilisateurs actifs**

## Conclusion

Kelly Planner est une fonctionnalité premium qui:
- Utilise l'IA de manière intelligente et économique
- Offre une vraie valeur ajoutée aux utilisateurs
- S'intègre naturellement dans le workflow existant
- Est scalable et performante
- Peut être étendue facilement

La séparation claire entre Service/Component/Integration facilite la maintenance et les tests.
