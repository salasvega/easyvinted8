# Kelly AI - Catalogue de Fonctionnalités

Kelly est ton assistante IA personnelle pour optimiser tes ventes sur Vinted. Voici toutes ses capacités actuelles et futures.

## Fonctionnalités Actives

### 1. Kelly Conseils (Dressing)
**Statut** : ✅ Actif

Insights proactifs sur ton dressing :
- Articles prêts à publier
- Articles incomplets
- Opportunités saisonnières
- Suggestions de lots
- Optimisations SEO

**Localisation** : Bouton flottant Kelly sur Mon Dressing

**Documentation** : Voir composant `KellyProactive`

---

### 2. Kelly Pricing
**Statut** : ✅ Actif

Assistant de prix intelligent :
- Analyse prix du marché
- Détection sous-évaluation/sur-évaluation
- Suggestions de prix optimal
- Prix psychologiques
- Opportunités de lots

**Localisation** :
- Panneau sur Mon Dressing
- Suggestions en temps réel dans formulaire article

**Documentation** : `KELLY_PRICING_GUIDE.md`

---

## Fonctionnalités Planifiées

### 3. Kelly Photo
**Statut** : 🚧 À développer (Priorité P0)

**Objectif** : Optimisation qualité photos

**Capacités** :
- Détection photos floues/mal éclairées
- Suggestions angles manquants
- Optimisation ordre photos
- Détection fond encombré
- Comparaison avec meilleures photos

**Impact Estimé** :
- +40% de vues avec photos optimales
- +35% de confiance avec photo étiquette
- 2x plus de ventes avec 4+ photos

---

### 4. Kelly Analytics
**Statut** : 🚧 À développer (Priorité P1)

**Objectif** : Insights prédictifs et opportunités

**Capacités** :
- Identification catégories performantes
- Prédictions tendances saisonnières
- Alertes baisse de conversion
- Opportunités de revenus
- Analyse concurrence

**Exemples d'Insights** :
- "Tes jeans se vendent 2x plus vite - publie les 3 en brouillon !"
- "Demande de manteaux +40% dans 2 semaines"
- "Ton taux de conversion a baissé de 15% - ajuste tes prix"

---

### 5. Kelly Engagement
**Statut** : 🚧 À développer (Priorité P1)

**Objectif** : Booster interactions et ventes

**Capacités** :
- Alertes messages non répondus
- Détection opportunités bundle
- Suggestions négociation prix
- Réponses automatiques FAQ
- Offres personnalisées

**Exemples** :
- "3 messages depuis 2h - réponds vite !"
- "@user123 aime 3 articles - propose bundle -15%"
- "Temps de réponse 2h = -15% de ventes"

---

### 6. Kelly Content
**Statut** : 🚧 À développer (Priorité P2)

**Objectif** : Optimisation descriptions et titres

**Capacités** :
- Détection keywords manquants
- Amélioration SEO
- Adaptation style persona
- Injection emojis optimaux
- Correction orthographe

**Exemples** :
- "Ajoute 'vintage', 'rare', 'neuf' pour +60% de découvrabilité"
- "Titre trop court - ajoute marque + couleur"
- "0 hashtags - ajoute #vintage #Nike"

---

### 7. Kelly Planner
**Statut** : 🚧 À développer (Priorité P2)

**Objectif** : Optimisation calendrier de publication

**Capacités** :
- Créneaux optimaux basés sur historique
- Détection surcharge/gaps
- Alertes urgence saisonnière
- Redistribution intelligente
- Plan hebdomadaire automatique

**Exemples** :
- "Publie ce soir 19h : +35% de vues"
- "5 articles jeudi - étale sur 3 jours"
- "Dernière semaine pour manteaux d'hiver !"

---

### 8. Kelly Team
**Statut** : 🚧 À développer (Priorité P3)

**Objectif** : Insights multi-vendeurs famille

**Capacités** :
- Analyse comparative performances
- Détection best practices
- Distribution optimale articles
- Gamification défis
- Alertes sous-performance

**Exemples** :
- "Marie cartonne : +150€ ce mois !"
- "Les descriptions de Marie génèrent +40% de vues"
- "Défi : qui vend 5 articles cette semaine ?"

---

### 9. Kelly Maintenance
**Statut** : 🚧 À développer (Priorité P3)

**Objectif** : Nettoyage et optimisation dressing

**Capacités** :
- Détection doublons
- Nettoyage photos orphelines
- Archivage automatique
- Complétion brouillons
- Vérification cohérence données

**Exemples** :
- "12 brouillons depuis 3+ mois - complète ou archive"
- "150 Mo de photos non utilisées - libère de l'espace"
- "3 articles sans prix/taille - complète-les"

---

### 10. Kelly Stylist
**Statut** : 🚧 À développer (Priorité P4)

**Objectif** : Assistant mode intelligent

**Capacités** :
- Suggestions looks coordonnés
- Alertes tendances mode
- Création lots tendance
- Suggestions mise en situation
- Tags tendances automatiques

**Exemples** :
- "Ce jean + ce top = look parfait"
- "Le style Y2K explose : +180% !"
- "Crée lot 'Barbiecore' à 65€"

---

### 11. Kelly Logistics
**Statut** : 🚧 À développer (Priorité P4)

**Objectif** : Optimisation expédition

**Capacités** :
- Conseils emballage optimal
- Sélection transporteur économique
- Calcul automatique meilleur tarif
- Alertes délais
- Génération étiquettes

**Exemples** :
- "Emballe à plat : -35% de frais de port"
- "Mondial Relay 30% moins cher pour ce colis"
- "Expédie avant 14h = livraison J+1"

---

## Architecture Unifiée

Toutes les fonctionnalités Kelly partagent :

### Table commune : `kelly_insights`
```sql
- user_id
- type (enum étendu)
- priority (high, medium, low)
- title
- message
- action_label
- article_ids
- suggested_action (jsonb)
- status (active, dismissed, completed)
- cache_key
- expires_at (30 min cache)
```

### Service réutilisable
```typescript
export async function getKellyInsights(
  category: InsightCategory,
  userId: string,
  forceRefresh = false
): Promise<Insight[]>
```

### Composant UI générique
```tsx
<KellyInsightsPanel
  category="analytics"
  onAction={handleAction}
  position="bottom-right"
  icon={TrendingUp}
  color="purple"
/>
```

## Priorisation et ROI

| Fonctionnalité | Impact Business | Complexité | ROI | Priorité |
|----------------|-----------------|------------|-----|----------|
| **Kelly Pricing** | ⭐⭐⭐⭐⭐ | ⭐⭐ | 🔥🔥🔥 | ✅ P0 - Fait |
| **Kelly Conseils** | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔥🔥 | ✅ P0 - Fait |
| **Kelly Photo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔥🔥🔥 | 🚧 P0 |
| **Kelly Analytics** | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔥🔥 | 🚧 P1 |
| **Kelly Engagement** | ⭐⭐⭐⭐ | ⭐⭐ | 🔥🔥 | 🚧 P1 |
| **Kelly Content** | ⭐⭐⭐ | ⭐⭐ | 🔥 | 🚧 P2 |
| **Kelly Planner** | ⭐⭐⭐ | ⭐⭐⭐ | 🔥 | 🚧 P2 |
| **Kelly Team** | ⭐⭐⭐ | ⭐⭐ | 🔥 | 🚧 P3 |
| **Kelly Maintenance** | ⭐⭐ | ⭐ | 🔥 | 🚧 P3 |
| **Kelly Stylist** | ⭐⭐⭐ | ⭐⭐⭐⭐ | 🔥 | 🚧 P4 |
| **Kelly Logistics** | ⭐⭐ | ⭐⭐ | 🔥 | 🚧 P4 |

## Coûts Estimés

### Avec système de cache (30 min)
- **Kelly Pricing** : $0.15/utilisateur/mois
- **Kelly Photo** : $0.20/utilisateur/mois
- **Kelly Analytics** : $0.10/utilisateur/mois
- **Autres** : $0.05/utilisateur/mois chacun

**Total estimé** : ~$0.80/utilisateur/mois pour toutes les fonctionnalités

### 1000 utilisateurs actifs
- Sans cache : ~$1500/mois
- Avec cache : **~$800/mois** (réduction 47%)

## Feuille de Route

### Q1 2026 ✅
- Kelly Conseils (Dressing)
- Kelly Pricing

### Q2 2026 🎯
- Kelly Photo
- Kelly Analytics
- Kelly Engagement

### Q3 2026
- Kelly Content
- Kelly Planner
- Kelly Team

### Q4 2026
- Kelly Maintenance
- Kelly Stylist
- Kelly Logistics

---

**Vision** : Kelly devient l'assistante IA indispensable qui accompagne chaque vendeur Vinted de la prise de photo à la vente finale, en optimisant chaque étape.
