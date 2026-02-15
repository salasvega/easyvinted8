# Guide Kelly Planner - Planification Intelligente de Publications

## Vue d'ensemble

Kelly Planner est un assistant IA qui analyse votre inventaire et vous recommande **QUAND** publier chaque article pour maximiser vos ventes sur Vinted. Il utilise l'IA Gemini pour analyser les tendances, votre historique et la saisonnalité.

## Fonctionnalités principales

### 1. Analyse intelligente
- Analyse tous vos articles "ready" (prêts à publier)
- Évalue les tendances saisonnières
- Détecte les opportunités de marché
- Identifie les articles dormants
- Suggère des regroupements en lots

### 2. Recommandations prioritisées
Les insights sont classés par priorité :
- **🔥 URGENT** : À publier dans les 48h (opportunité critique)
- **⚡ PRIORITÉ HAUTE** : À publier cette semaine
- **💡 RECOMMANDATION** : À publier dans 2-3 semaines
- **📌 À NOTER** : Information pour plus tard

### 3. Types de recommandations

#### 🌟 Seasonal Peak (Pic saisonnier)
- Détecte les pics de demande saisonnière
- Exemple : "Publie ces robes d'été MAINTENANT"
- Action : Publier immédiatement

#### 🎯 Market Gap (Créneau de marché)
- Identifie les opportunités avec faible concurrence
- Exemple : "Peu de manteaux de cette marque en vente"
- Action : Profiter de la fenêtre d'opportunité

#### 📈 Demand Spike (Pic de demande)
- Détecte une hausse soudaine de demande
- Exemple : "Les sacs à dos sont très recherchés"
- Action : Publier avant saturation

#### ⏰ Stale Inventory (Inventaire dormant)
- Articles qui ne bougent pas depuis 30+ jours
- Exemple : "Ce jean dort depuis 45 jours"
- Action : Ajuster le prix ou créer un lot

#### 📦 Bundle Opportunity (Opportunité de lot)
- Suggère de regrouper des articles
- Exemple : "Ces 3 t-shirts feraient un bon lot"
- Action : Créer un lot avec LotBuilder

#### 🎉 Weekend Boost (Boost weekend)
- Moments optimaux de la semaine
- Exemple : "Publie samedi matin pour maximum de vues"
- Action : Planifier pour le weekend

#### 💰 Price Optimize (Optimisation prix)
- Suggère un ajustement de prix avant publication
- Affiche prix actuel vs prix suggéré
- Action : Modifier le prix puis publier

## Interface utilisateur

### Position
Kelly Planner apparaît sur la page "Mon Dressing", juste après Kelly Pricing Panel.

### Mode fermé (par défaut)
```
┌─────────────────────────────────────────────┐
│ 📅 Kelly Planner                   🔄  ▼    │
│    3 recommandations                         │
└─────────────────────────────────────────────┘
```

### Mode ouvert
```
┌─────────────────────────────────────────────┐
│ 📅 Kelly Planner                   🔄  ▲    │
│    3 recommandations                         │
├─────────────────────────────────────────────┤
│ 🔥 URGENT - Publier maintenant              │
│ ┌────────────────────────────────────────┐  │
│ │ 🌟 Pic saisonnier détecté              │  │
│ │                                        │  │
│ │ Publie ces robes d'été MAINTENANT     │  │
│ │ La demande explose (+45% cette        │  │
│ │ semaine). Les 3 prochains jours       │  │
│ │ sont critiques.                       │  │
│ │                                        │  │
│ │ [Demande: Forte] [Concurrence: Faible]│  │
│ │ [Fenêtre: 3 jours] [Confiance: 92%]   │  │
│ │                                        │  │
│ │ Raisonnement:                          │  │
│ │ Pic saisonnier + faible concurrence    │  │
│ │                                        │  │
│ │ [Publier maintenant] 📦               │  │
│ │                                        │  │
│ │ 2 articles concernés                   │  │
│ └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Actions disponibles

### 1. Publier maintenant / Planifier
- Ouvre le modal de planification
- Pré-remplit la date suggérée
- Marque l'insight comme complété

### 2. Créer le lot
- Redirige vers le LotBuilder
- Pré-sélectionne les articles suggérés
- Marque l'insight comme complété

### 3. Ajuster le prix
- Redirige vers la fiche article
- Affiche le prix suggéré
- Permet de modifier avant publication

### 4. Ignorer (bouton X)
- Masque la recommandation
- Garde en mémoire pour ne pas réafficher
- Peut être réactivée avec le refresh

### 5. Rafraîchir (🔄)
- Force une nouvelle analyse
- Régénère tous les insights
- Utile après avoir modifié l'inventaire

## Contexte de marché

Chaque insight affiche le contexte :

### Demande actuelle
- **Forte** : Beaucoup d'acheteurs recherchent ce type d'article
- **Moyenne** : Demande normale
- **Faible** : Peu de recherches actuellement

### Niveau de concurrence
- **Faible** : Peu d'articles similaires en vente (opportunité)
- **Moyenne** : Concurrence normale
- **Forte** : Beaucoup de vendeurs (difficile)

### Fenêtre d'opportunité
- Nombre de jours avant expiration de l'opportunité
- Formaté : "Aujourd'hui", "3 jours", "Cette semaine"

### Score de confiance
- 0-100% : Niveau de confiance de l'IA
- Basé sur la qualité des données et l'historique

### Tendance saisonnière
- **rising** : Demande en hausse
- **peak** : Au pic de la saison
- **declining** : Demande en baisse
- **off-season** : Hors saison

## Cache et performances

### Durée de cache
- **6 heures** par défaut
- Stocké dans Supabase (`kelly_planning_cache`)
- Évite les appels API inutiles

### Lazy loading
- L'analyse ne se lance que quand vous ouvrez le panel
- Gain de performances au chargement de la page

### Refresh manuel
- Bouton 🔄 pour forcer une nouvelle analyse
- Utile après :
  - Ajout de nouveaux articles
  - Modification de prix
  - Changement de saison

## Algorithme d'analyse

### 1. Collecte des données
```typescript
- Articles "ready" (prêts)
- Lots "ready"
- Historique de ventes (50 derniers)
- Date actuelle
```

### 2. Calcul des métriques utilisateur
```typescript
- Meilleurs jours de vente (ex: Samedi, Dimanche)
- Délai moyen de vente (ex: 14 jours)
- Taux de conversion par saison (%)
- Performance par catégorie
```

### 3. Analyse IA avec Gemini
```typescript
- Prompt de 500+ tokens
- Température: 0.7 (créatif mais précis)
- Format: JSON structuré
- Maximum: 10 insights prioritisés
```

### 4. Post-traitement
```typescript
- Tri par priorité (urgent → low)
- Ajout d'IDs uniques
- Calcul des dates d'expiration
- Sauvegarde en cache
```

## Base de données

### Table `kelly_planning_cache`
```sql
CREATE TABLE kelly_planning_cache (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  insights jsonb,           -- Array d'insights
  market_data jsonb,         -- Données de marché
  generated_at timestamptz,  -- Date de génération
  expires_at timestamptz,    -- Date d'expiration
  article_count integer,     -- Nombre d'articles analysés
  priority_count jsonb,      -- Compteurs par priorité
  UNIQUE(user_id)
);
```

### RLS activé
- Les utilisateurs ne voient que leur propre cache
- Policies pour SELECT, INSERT, UPDATE, DELETE

## Intégration avec les autres fonctionnalités

### Avec Kelly Pricing
- Les insights "price_optimize" suggèrent un ajustement
- Peut renvoyer vers Kelly Pricing pour analyse détaillée

### Avec Planner (ancien)
- Complémentaire : Planner = gestion, Kelly Planner = recommandations
- Peut créer des suggestions dans `selling_suggestions`

### Avec LotBuilder
- Action "bundle_first" pré-sélectionne les articles
- Création de lots optimisée

### Avec Agent Publisher
- Les insights "publish_now" peuvent déclencher la publication
- Intégration future possible

## Exemple d'utilisation

### Scénario 1 : Pic saisonnier
```
1. Mi-juin : Kelly détecte la demande de maillots de bain
2. Insight urgent : "Publie ces 3 maillots MAINTENANT"
3. Vous cliquez "Publier maintenant"
4. Modal s'ouvre avec date pré-remplie
5. Vous confirmez → articles planifiés
```

### Scénario 2 : Article dormant
```
1. Article de 45 jours sans vue
2. Insight high : "Baisse le prix de 20%"
3. Vous cliquez "Ajuster le prix"
4. Fiche article s'ouvre
5. Vous modifiez le prix
6. L'insight est marqué complété
```

### Scénario 3 : Opportunité de lot
```
1. Kelly détecte 3 t-shirts similaires
2. Insight medium : "Crée un lot de 3 t-shirts"
3. Vous cliquez "Créer le lot"
4. LotBuilder s'ouvre avec articles pré-sélectionnés
5. Vous ajustez et créez le lot
```

## Troubleshooting

### "Impossible de charger les recommandations"
- Vérifiez que `VITE_GEMINI_API_KEY` est configurée
- Vérifiez votre quota API Gemini
- Regardez la console pour les erreurs détaillées

### "Aucune recommandation"
- Normal si tous vos articles sont déjà optimalement positionnés
- Essayez d'ajouter de nouveaux articles "ready"
- Vérifiez que vous avez des articles avec statut "ready"

### Le panel ne s'ouvre pas
- Vérifiez la console pour erreurs JavaScript
- Assurez-vous que l'utilisateur est connecté
- Rafraîchissez la page

### Insights pas pertinents
- L'IA s'améliore avec plus d'historique de ventes
- Plus vous vendez, meilleures sont les prédictions
- Les premiers insights peuvent être génériques

## Configuration recommandée

### Variables d'environnement requises
```env
VITE_GEMINI_API_KEY=votre_cle_api
VITE_SUPABASE_URL=votre_url
VITE_SUPABASE_ANON_KEY=votre_cle
```

### Quotas API Gemini
- Modèle utilisé : `gemini-2.0-flash`
- Environ 1000-2000 tokens par analyse
- Cache de 6h = ~4 appels/jour max
- Coût estimé : très faible (< 0.01€/jour)

## Améliorations futures possibles

### Courte terme
- Notifications push pour insights urgents
- Historique des insights complétés
- Export des recommandations en PDF

### Moyen terme
- Apprentissage des préférences utilisateur
- Intégration données Vinted temps réel
- Suggestions de jours/heures de publication

### Long terme
- Auto-publication des insights urgents
- A/B testing automatique des prix
- Prédiction du délai de vente

## Support

Pour toute question ou problème :
1. Consultez les logs dans la console navigateur
2. Vérifiez la table `kelly_planning_cache` dans Supabase
3. Testez avec le bouton refresh (🔄)
4. Contactez le support technique

---

Kelly Planner vous aide à publier au bon moment pour maximiser vos ventes. Laissez l'IA analyser les tendances pendant que vous vous concentrez sur vos articles !
