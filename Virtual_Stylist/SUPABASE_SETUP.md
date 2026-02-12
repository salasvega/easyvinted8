# 🗄️ Configuration Supabase pour Virtual Stylist

## ✅ Configuration terminée

Le Virtual Stylist est maintenant connecté à Supabase et peut sauvegarder vos créations!

### 📊 Tables créées

#### 1. **avatars** - Modèles virtuels
Stocke tous les mannequins que vous créez avec leurs caractéristiques:
- Nom du projet
- Genre (feminine/masculine)
- Groupe d'âge (baby/child/teen/adult/senior)
- Origine ethnique
- Carnation (12 nuances différentes)
- Couleur de cheveux (12 teintes)
- Coupe de cheveux (bald/short/medium/long)
- Texture (straight/wavy/curly/coily)
- Couleur des yeux (6 couleurs)
- Silhouette (slim/average/athletic/curvy)
- Caractéristiques additionnelles
- Image générée en base64

#### 2. **locations** - Décors/Lieux de shooting
Stocke tous les environnements que vous générez:
- Nom du lieu
- Description
- Image générée en base64

### 🔒 Sécurité

- ✅ RLS (Row Level Security) activé sur les deux tables
- ✅ Politiques publiques configurées (l'app est standalone)
- ✅ Accès en lecture/écriture/suppression autorisé
- ✅ Index créés pour optimiser les performances

### 🚀 Utilisation

L'application utilise automatiquement Supabase dès qu'elle détecte la connexion. Sinon, elle bascule sur IndexedDB (stockage local).

**Ordre de priorité:**
1. **Supabase** (base de données cloud) ☁️
2. **IndexedDB** (stockage local navigateur) 💻

### 🧪 Tester la connexion

Pour vérifier que tout fonctionne:

1. Ouvrez le fichier `test-supabase.html` dans votre navigateur
2. Cliquez sur "Lancer les tests"
3. Vérifiez que tous les tests sont ✅

### 📝 Variables d'environnement

Le fichier `.env.local` contient:

```env
SUPABASE_URL=https://mgedkyxhpzaexxldigfp.supabase.co
SUPABASE_ANON_KEY=votre_clé_anon
GEMINI_API_KEY=votre_clé_gemini
```

Ces variables sont automatiquement chargées par Vite.

### 🔄 Synchronisation

**Sauvegarde automatique:**
- ✅ Chaque modèle créé est automatiquement sauvegardé
- ✅ Chaque décor généré est automatiquement sauvegardé
- ✅ Les données sont synchronisées en temps réel

**Récupération:**
- ✅ Au démarrage, l'app charge automatiquement toutes vos créations depuis Supabase
- ✅ La galerie affiche tous vos modèles sauvegardés
- ✅ Les décors sont listés dans la section Scénographie

### 📱 Avantages de Supabase

1. **Persistance cloud** - Vos créations sont sauvegardées en ligne
2. **Multi-appareils** - Accédez à vos modèles depuis n'importe où
3. **Aucune perte de données** - Même si vous videz le cache du navigateur
4. **Performances** - Chargement rapide avec indexes optimisés
5. **Scalabilité** - Peut gérer des milliers de modèles

### 🛠️ Architecture technique

```
Virtual Stylist App
       ↓
supabaseservice.ts (Couche d'abstraction)
       ↓
    Supabase Client
       ↓
    Tables Supabase
    - avatars
    - locations
```

**Fallback automatique:**
```
Supabase disponible? → OUI → Utilise Supabase
                     → NON → Utilise IndexedDB
```

### 📊 Requêtes disponibles

**Avatars:**
- `saveAvatarToDb(avatar)` - Sauvegarde un modèle
- `fetchAvatarsFromDb()` - Récupère tous les modèles
- `deleteAvatarFromDb(id)` - Supprime un modèle

**Locations:**
- `saveLocationToDb(location)` - Sauvegarde un lieu
- `fetchLocationsFromDb()` - Récupère tous les lieux
- `deleteLocationFromDb(id)` - Supprime un lieu

### 🐛 Dépannage

**Problème:** Les créations ne se sauvent pas
- ✅ Vérifiez que `.env.local` existe et contient les bonnes clés
- ✅ Lancez `test-supabase.html` pour diagnostiquer
- ✅ Vérifiez la console du navigateur (F12) pour les erreurs

**Problème:** "CORS error"
- ✅ Vérifiez que l'URL Supabase est correcte
- ✅ Vérifiez que la clé anon est valide

**Problème:** "Permission denied"
- ✅ Les politiques RLS sont déjà configurées en mode public
- ✅ Aucune authentification n'est requise

### 💾 Migration des données existantes

Si vous aviez déjà des créations dans IndexedDB, elles continueront de fonctionner. Les nouvelles créations seront automatiquement sauvegardées dans Supabase.

Pour migrer vos anciennes créations:
1. Ouvrez la console du navigateur (F12)
2. Les données IndexedDB restent accessibles localement
3. Les futures créations iront automatiquement dans Supabase

### 📈 Statistiques

Vous pouvez consulter vos statistiques dans le dashboard Supabase:
- Nombre total de modèles créés
- Nombre de décors générés
- Utilisation du stockage
- Fréquence des créations

### 🔗 Liens utiles

- [Dashboard Supabase](https://supabase.com/dashboard/project/mgedkyxhpzaexxldigfp)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Supabase JS](https://supabase.com/docs/reference/javascript/introduction)

---

✨ **Tout est prêt!** Le Virtual Stylist est maintenant connecté à Supabase et vos créations seront sauvegardées automatiquement dans le cloud.
