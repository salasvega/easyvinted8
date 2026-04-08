# Virtual Stylist - Configuration de l'authentification

## Modifications apportées

Les avatars et locations sont maintenant liés à l'utilisateur qui les a créés et protégés par Row Level Security (RLS).

### Changements de base de données

1. **Ajout de la colonne `user_id`**
   - Table `avatars` : chaque avatar est maintenant lié à un utilisateur spécifique
   - Table `locations` : chaque location est maintenant liée à un utilisateur spécifique

2. **Row Level Security (RLS) activé**
   - Les utilisateurs peuvent uniquement voir, créer, modifier et supprimer leurs propres avatars
   - Les utilisateurs peuvent uniquement voir, créer, modifier et supprimer leurs propres locations
   - Toutes les opérations nécessitent une authentification

### Changements de code

**Fichier modifié:** `Virtual_Stylist/services/supabaseservice.ts`

#### Nouvelles fonctions d'authentification

```typescript
// Récupère l'utilisateur actuellement connecté
export const getCurrentUser = async ()

// Vérifie si un utilisateur est authentifié
export const isUserAuthenticated = async (): Promise<boolean>
```

#### Modifications des fonctions existantes

Toutes les fonctions de création d'avatars et locations nécessitent maintenant une authentification:

- `saveAvatarToDb()` - Ajoute automatiquement le `user_id` de l'utilisateur connecté
- `createAvatarVersion()` - Ajoute automatiquement le `user_id` de l'utilisateur connecté
- `saveLocationToDb()` - Ajoute automatiquement le `user_id` de l'utilisateur connecté

Les fonctions de lecture (`fetchAvatarsFromDb`, `fetchLocationsFromDb`) récupèrent automatiquement uniquement les données de l'utilisateur connecté grâce au RLS.

### Sécurité

#### Politiques RLS en place

**Avatars:**
- `Users can view own avatars` - SELECT limité aux avatars de l'utilisateur
- `Users can insert own avatars` - INSERT vérifie que user_id = auth.uid()
- `Users can update own avatars` - UPDATE limité aux avatars de l'utilisateur
- `Users can delete own avatars` - DELETE limité aux avatars de l'utilisateur

**Locations:**
- `Users can view own locations` - SELECT limité aux locations de l'utilisateur
- `Users can insert own locations` - INSERT vérifie que user_id = auth.uid()
- `Users can update own locations` - UPDATE limité aux locations de l'utilisateur
- `Users can delete own locations` - DELETE limité aux locations de l'utilisateur

### Utilisation

#### Pour créer un avatar

```typescript
import { saveAvatarToDb, isUserAuthenticated } from './services/supabaseservice';

// Vérifier l'authentification
const isAuth = await isUserAuthenticated();
if (!isAuth) {
  alert('Vous devez être connecté pour créer un avatar');
  return;
}

// Créer l'avatar (user_id sera ajouté automatiquement)
const newAvatar = await saveAvatarToDb({
  name: 'Mon Avatar',
  gender: 'feminine',
  ageGroup: 'adult',
  // ... autres propriétés
});
```

#### Pour récupérer les avatars

```typescript
import { fetchAvatarsFromDb } from './services/supabaseservice';

// Récupère uniquement les avatars de l'utilisateur connecté
const avatars = await fetchAvatarsFromDb();
```

### Données existantes

Les avatars et locations créés avant cette mise à jour ont été automatiquement assignés au premier utilisateur de la base de données (ID: `c84c0766-29fd-41bb-b67a-50c6ce30bb3b`).

Si vous souhaitez nettoyer ces données de test:

```sql
-- Supprimer tous les avatars
DELETE FROM avatars WHERE user_id = 'c84c0766-29fd-41bb-b67a-50c6ce30bb3b';

-- Supprimer toutes les locations
DELETE FROM locations WHERE user_id = 'c84c0766-29fd-41bb-b67a-50c6ce30bb3b';
```

### Fallback IndexedDB

Si l'utilisateur n'est pas connecté ou si Supabase n'est pas configuré, les données sont automatiquement stockées localement dans IndexedDB (comportement précédent maintenu).

### Notes importantes

- Toutes les opérations sur les avatars et locations nécessitent maintenant une authentification
- Le RLS garantit que les utilisateurs ne peuvent accéder qu'à leurs propres données
- Les données sont automatiquement filtrées côté serveur par Supabase
- Aucune donnée d'un autre utilisateur ne peut être accédée, même en modifiant les requêtes
