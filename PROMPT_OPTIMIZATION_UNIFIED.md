# 🎯 Optimisation Unifiée des Prompts IA - Documentation Complète

## 📋 Vue d'ensemble

L'optimisation des prompts IA a été unifiée entre les deux systèmes d'EasyVinted :
- **Magik Editor** (ImageEditor.tsx) - Édition rapide dans les drawers
- **Virtual Stylist** (Application séparée) - Studio photo professionnel

## ✅ Ce qui a été fait

### 1. Service Partagé Créé : `src/lib/promptBuilders.ts`

Ce service contient deux fonctions optimisées qui construisent des prompts scientifiquement structurés :

#### `buildAvatarPromptFromProfile(profile)`
Construit une description détaillée et hiérarchisée d'un avatar/modèle avec 4 niveaux de priorité :

**🔴 CRITICAL (doit correspondre parfaitement)**
- Genre (homme/femme)
- Type de corps (slim/athletic/average/curvy) - AFFECTE DIRECTEMENT LE FIT DES VÊTEMENTS
- Carnation (ton de peau exact requis)
- Âge (baby/child/teen/adult/senior)

**🟠 IMPORTANT (haute priorité)**
- Origine ethnique (African/East Asian/South Asian/Caucasian/Hispanic/Middle Eastern)
- Cheveux (couleur + longueur + texture combinées)

**🟡 SECONDARY (maintenir si possible)**
- Couleur des yeux

**🟢 OPTIONAL (détail bonus)**
- Features additionnelles

#### `buildLocationPromptFromProfile(location)`
Construit une description détaillée de l'environnement/arrière-plan avec analyse approfondie :

**🔴 CRITICAL**
- Type de lieu
- Description de base
- Configuration d'éclairage détaillée (direction, intensité, température de couleur, ombres)

**🟠 IMPORTANT**
- Matériaux des surfaces
- Palette de couleurs dominantes
- Profondeur spatiale
- Éléments architecturaux

**🟡 SECONDARY**
- Détails d'ambiance subtils
- Atmosphère générale

### 2. Compatibilité Multi-Format

Le service accepte **deux formats de données** automatiquement :
- **Format camelCase** : `ageGroup`, `skinTone`, `hairColor` (Virtual Stylist)
- **Format snake_case** : `age_group`, `skin_tone`, `hair_color` (EasyVinted DB)

### 3. Mapping Intelligent des Valeurs

Le service transforme les valeurs brutes en descriptions riches :

```typescript
// Exemple : Gender
'feminine' → 'woman'
'masculine' → 'man'

// Exemple : Build
'slim' → 'slim build with delicate proportions'
'athletic' → 'athletic build with toned muscle definition'
'curvy' → 'curvy build with fuller figure'

// Exemple : Hair Texture
'straight' → 'straight and sleek'
'wavy' → 'wavy with natural movement'
'curly' → 'curly with defined ringlets'
'coily' → 'coily with tight texture'
```

## 🎨 Intégration dans ImageEditor (Magik Editor)

### Avant l'optimisation
```typescript
function buildAvatarDescription(avatar: AvatarData | null): string {
  if (!avatar) return '';
  const parts: string[] = [];
  parts.push('MODEL/AVATAR REFERENCE (USE THIS FOR CONSISTENCY):');
  if (avatar.gender) parts.push(`- Gender: ${avatar.gender}`);
  if (avatar.age_group) parts.push(`- Age group: ${avatar.age_group}`);
  // ... liste plate sans hiérarchie
  return parts.join('\n');
}
```

### Après l'optimisation
```typescript
import { buildAvatarPromptFromProfile } from '../lib/promptBuilders';

const avatarDesc = buildAvatarPromptFromProfile(defaultAvatar);
```

Le prompt généré est maintenant **structuré scientifiquement** avec :
- Hiérarchie de priorités claire (CRITICAL → IMPORTANT → SECONDARY → OPTIONAL)
- Descriptions enrichies des features
- Section de validation avec checklist
- Emphase sur les éléments critiques (body type, skin tone)

## 🔬 Différences Clés avec Avant

### Structure du Prompt

**AVANT (basique)** :
```
MODEL/AVATAR REFERENCE (USE THIS FOR CONSISTENCY):
- Gender: feminine
- Age group: adult
- Build: average
- Skin tone: fair
- Hair color: brown
```

**APRÈS (optimisé)** :
```
AVATAR/MODEL REFERENCE - DETAILED CHARACTERISTICS:

🔴 CRITICAL (must match perfectly)
  • Gender: woman
  • Body Type/Silhouette: average build with natural proportions - THIS DIRECTLY AFFECTS GARMENT FIT AND DRAPING
  • Skin Tone: fair - EXACT COLOR MATCH REQUIRED
  • Age: 26-40 years old adult

🟠 IMPORTANT (high priority)
  • Ethnic Background: Caucasian descent
  • Hair: brown color, medium-length hair, straight and sleek

VALIDATION REQUIREMENT:
Compare the generated person with the reference photo provided.
The model MUST match exactly in these aspects:
  ✓ Body type and proportions (affects how clothes fit)
  ✓ Skin tone accuracy (critical for realism)
  ✓ Overall physique and build
  ✓ Facial structure coherence
  ✓ Hair color and style consistency
```

## 📊 Avantages de l'Optimisation

### 1. Qualité Améliorée
- **Hiérarchie claire** : Gemini comprend mieux ce qui est critique vs optionnel
- **Descriptions riches** : "average build" devient "average build with natural proportions"
- **Emphase contextuelle** : "THIS DIRECTLY AFFECTS GARMENT FIT AND DRAPING"

### 2. Consistance Garantie
- **Checklist de validation** : Vérifie tous les aspects critiques
- **Même logique partout** : Magik Editor et Virtual Stylist utilisent les mêmes prompts optimisés
- **Résultats reproductibles** : Mêmes paramètres = mêmes résultats

### 3. Maintenance Simplifiée
- **Single Source of Truth** : Une seule fonction à maintenir
- **Pas de duplication** : Code DRY (Don't Repeat Yourself)
- **Évolutions centralisées** : Améliorer une fonction = améliorer partout

### 4. Compatibilité Multi-Projets
- Fonctionne avec Virtual Stylist (camelCase)
- Fonctionne avec EasyVinted (snake_case)
- Extensible à d'autres projets futurs

## 🎯 Cas d'Usage

### Magik Editor - Actions Rapides

Quand l'utilisateur clique sur "Essayer sur modèle" :
```typescript
if (isTryOnAction && defaultAvatar) {
  const avatarDesc = buildAvatarPromptFromProfile(defaultAvatar);
  enrichedPrompt = `${rawPrompt}\n\n${avatarDesc}`;
}
```

Le prompt devient :
```
Try-On: Show this garment worn by a model

AVATAR/MODEL REFERENCE - DETAILED CHARACTERISTICS:
🔴 CRITICAL (must match perfectly)
  • Gender: woman
  • Body Type/Silhouette: average build with natural proportions - THIS DIRECTLY AFFECTS GARMENT FIT AND DRAPING
  ...
```

### Virtual Stylist - Studio Complet

Dans le Virtual Stylist, `performVirtualTryOn` utilise les mêmes fonctions pour construire des prompts ultra-détaillés pour les essayages virtuels professionnels.

## 🔧 Utilisation

### Pour les Développeurs

```typescript
import { buildAvatarPromptFromProfile, buildLocationPromptFromProfile } from '../lib/promptBuilders';

// Utilisation avec format snake_case (DB)
const avatarFromDb = {
  gender: 'feminine',
  age_group: 'adult',
  build: 'average',
  skin_tone: 'fair',
  // ...
};
const prompt1 = buildAvatarPromptFromProfile(avatarFromDb);

// Utilisation avec format camelCase (Virtual Stylist)
const avatarProfile = {
  gender: 'masculine',
  ageGroup: 'teen',
  build: 'athletic',
  skinTone: 'tan',
  // ...
};
const prompt2 = buildAvatarPromptFromProfile(avatarProfile);

// Les deux fonctionnent identiquement !
```

## 🎨 Style "UGC iPhone" Préservé

L'optimisation **ne change pas** le style global UGC iPhone :

```typescript
const UGC_IPHONE_STYLE = `
STYLE GLOBAL (STRICT - VINTED FRIENDLY):
- Must look like a casual iPhone photo taken by a real person (UGC), NOT a professional studio/catalog photo.
- Natural lighting, slight imperfections ok (no over-polished look).
- Preserve any texture, grain, natural shadows.
- Avoid any "AI look": no plastic skin, no over-smoothing, no weird artifacts.
`;
```

Ce style est **toujours appliqué** via `buildFinalPrompt()` qui wrap tous les prompts avec ces contraintes.

## 📈 Résultats Attendus

### Avant
- Descriptions plates et sans priorité
- Gemini "devine" ce qui est important
- Résultats variables selon le modèle
- Duplication du code entre projets

### Après
- Hiérarchie scientifique des features
- Gemini sait exactement ce qui est critique
- Résultats plus consistants et prédictibles
- Code unifié et maintenable

## 🚀 Prochaines Étapes Possibles

1. **Étendre aux autres actions** :
   - "Plier" (folding)
   - "Changer fond" (background replacement)
   - "Palette couleurs" (color palette generation)

2. **A/B Testing** :
   - Comparer qualité avant/après
   - Mesurer la consistance des résultats
   - Affiner les priorités selon les retours

3. **Optimisation continue** :
   - Ajouter plus de contexte aux features critiques
   - Tester différents niveaux de détail
   - Adapter selon les feedback de Gemini

## 📝 Notes Techniques

- **Compatibilité** : TypeScript strict mode ✅
- **Build** : Vite build passe sans erreurs ✅
- **Format** : Supporte les deux conventions de nommage ✅
- **Extensibilité** : Facile d'ajouter de nouvelles features ✅
- **Performance** : Aucun impact (simple construction de strings) ✅

---

## 🎓 Conclusion

Cette optimisation unifie les prompts IA entre Magik Editor et Virtual Stylist, garantissant une qualité constante et scientifiquement structurée partout dans l'application. Le système de hiérarchisation (CRITICAL → IMPORTANT → SECONDARY → OPTIONAL) guide Gemini pour produire des résultats plus fidèles et reproductibles.

Le code est maintenant **DRY**, **maintenable**, et **évolutif** ! 🎉
