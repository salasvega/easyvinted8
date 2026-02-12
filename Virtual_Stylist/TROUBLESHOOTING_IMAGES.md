# Dépannage - Affichage des images Virtual Stylist

## Problème résolu

**Symptôme** : Les images d'avatars et de locations étaient bien stockées dans Supabase mais ne s'affichaient pas dans le Virtual Stylist (sections "Modèles" et "Fonds").

## Cause identifiée

Le bucket Supabase `virtual-stylist` était configuré en mode **privé** (`public = false`), ce qui empêchait l'affichage public des images même en utilisant `getPublicUrl()`.

## Solution appliquée

### 1. Migration du bucket en mode public

Une migration a été appliquée pour rendre le bucket public :

```sql
UPDATE storage.buckets
SET public = true
WHERE id = 'virtual-stylist';
```

**Impact** :
- ✅ Les images sont maintenant accessibles publiquement via leur URL
- ✅ Les politiques RLS continuent de protéger l'upload, modification et suppression
- ✅ Seule la lecture est publique, ce qui est approprié pour un stylist virtuel

### 2. Correction de la gestion des extensions

Les images compressées passent de PNG à JPEG, ce qui changeait l'extension du fichier. Une logique a été ajoutée pour supprimer automatiquement l'ancienne version lors de l'upload :

```typescript
// Supprime l'ancien fichier avec extension différente
const alternateExtension = fileExtension === 'jpg' ? 'png' : 'jpg';
const alternateFilePath = `${userId}/${folder}/${fileName}.${alternateExtension}`;
await supabase.storage.from('virtual-stylist').remove([alternateFilePath]);
```

## Vérification

Pour vérifier que tout fonctionne correctement, utilisez le script de diagnostic :

```bash
cd Virtual_Stylist
npm install
npm run verify:storage
```

### Sortie attendue

```
✅ [Bucket] Bucket trouvé (PUBLIC)
✅ [Avatars] X avatar(s) trouvé(s)
✅ [Avatar Image] Nom_Avatar: 200 OK
✅ [Locations] X location(s) trouvée(s)
✅ [Location Image] Nom_Location: 200 OK
✅ [Stylist Photos] X photo(s) trouvée(s)

OK: X | WARNING: 0 | ERROR: 0
```

### Mode verbose

Pour plus de détails sur chaque image :

```bash
npm run verify:storage:verbose
```

## Si les images ne s'affichent toujours pas

### 1. Vérifier la migration

Connectez-vous à Supabase Studio et vérifiez que le bucket est bien en mode public :

1. Allez dans **Storage** → **Buckets**
2. Sélectionnez le bucket `virtual-stylist`
3. Vérifiez que **Public bucket** est activé

### 2. Vérifier les URLs dans la base de données

Exécutez cette requête SQL dans Supabase :

```sql
-- Vérifier les URLs des avatars
SELECT id, name, photo_url
FROM avatars
LIMIT 5;

-- Vérifier les URLs des locations
SELECT id, name, photo_url
FROM locations
LIMIT 5;
```

Les URLs doivent ressembler à :
```
https://votre-projet.supabase.co/storage/v1/object/public/virtual-stylist/user-id/avatars/fichier.jpg
```

### 3. Tester l'accès direct

Copiez une URL d'image depuis la base de données et collez-la dans votre navigateur. Si l'image ne s'affiche pas :

- ❌ Le bucket n'est pas public → Réappliquez la migration
- ❌ L'URL est malformée → Vérifiez la structure du path
- ❌ Le fichier n'existe pas → Le fichier a peut-être été supprimé

### 4. Vérifier les politiques RLS

Les politiques RLS pour le storage doivent permettre l'upload/update/delete seulement pour les propriétaires, mais permettre la lecture publique grâce au bucket public.

```sql
-- Vérifier les politiques existantes
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects';
```

### 5. Cache du navigateur

Si les images apparaissaient en gris ou ne chargeaient pas, videz le cache :

- **Chrome/Edge** : Ctrl+Shift+Delete
- **Firefox** : Ctrl+Shift+Delete
- **Safari** : Cmd+Option+E

Puis rechargez la page avec Ctrl+F5 (Cmd+Shift+R sur Mac).

## Structure du storage

```
virtual-stylist/
├── {user-id}/
│   ├── avatars/
│   │   ├── 1234567890-avatar-name.jpg
│   │   └── 1234567891-another-avatar.jpg
│   ├── locations/
│   │   ├── 1234567892-paris-street.jpg
│   │   └── 1234567893-modern-studio.jpg
│   └── photos/
│       ├── 1234567894-photo-1.jpg
│       └── 1234567895-photo-2.jpg
```

## Compression automatique

Toutes les images sont automatiquement compressées lors de l'upload :

| Type | Dimensions max | Qualité | Format | Réduction |
|------|---------------|---------|--------|-----------|
| Avatars | 1024x1024px | 85% | JPEG | 70-85% |
| Locations | 1024x1024px | 85% | JPEG | 70-85% |
| Photos | 1200x1200px | 85% | JPEG | 70-85% |

## Support

Si le problème persiste après ces vérifications :

1. Exécutez `npm run verify:storage:verbose` et partagez la sortie complète
2. Vérifiez les logs de la console du navigateur (F12)
3. Vérifiez que votre fichier `.env` contient bien les bonnes variables :
   ```
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-clé-anonyme
   ```

## Logs de développement

Lors de l'upload d'images, vous devriez voir des logs dans la console :

```
[Virtual Stylist] Image compression:
  Original: 2.5 MB
  Compressed: 450 KB
  Reduction: 82.0%
  Dimensions: 1024x1024px
```

Si ces logs n'apparaissent pas, la compression ne fonctionne pas correctement.
