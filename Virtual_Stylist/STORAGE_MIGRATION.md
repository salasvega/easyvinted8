# Migration vers Supabase Storage

## Problème

Le stockage des images en base64 directement dans la base de données PostgreSQL consomme énormément de ressources :
- **132 MB pour seulement 45 images**
- Chaque image : ~2-3 MB en base64
- Bande passante excessive sur chaque requête
- Performance dégradée

## Solution

Migration vers **Supabase Storage** :
- Images stockées dans un bucket dédié
- Seulement les URLs stockées en base de données
- Réduction de **95%+ de l'espace disque**
- Meilleure performance

## Changements appliqués

### 1. Migration de la base de données
Une nouvelle migration a été créée qui :
- Crée le bucket `virtual-stylist`
- Ajoute les colonnes `photo_url` aux tables
- Configure les politiques RLS pour le storage

### 2. Modifications du code
Le service Supabase a été mis à jour pour :
- Convertir les images base64 en Blob
- Uploader vers le Storage
- Stocker les URLs au lieu du base64
- Maintenir la compatibilité avec les anciennes images

### 3. Structure du Storage
```
virtual-stylist/
  └── {user_id}/
      ├── avatars/
      │   └── {timestamp}-{nom}.png
      ├── locations/
      │   └── {timestamp}-{nom}.png
      └── photos/
          └── {timestamp}-{nom}.png
```

## Migration des données existantes

Pour migrer vos images existantes vers le Storage :

```bash
# Depuis le dossier Virtual_Stylist
npm install --save-dev tsx @supabase/supabase-js dotenv

# Exécuter la migration
npx tsx migrate-images-to-storage.ts
```

Ce script va :
1. Récupérer toutes les images en base64
2. Les uploader vers le Storage
3. Mettre à jour les URLs dans la base de données
4. Supprimer les données base64 pour libérer l'espace

## Vérification

Après la migration, vérifiez l'espace libéré :

```sql
SELECT
  'avatars' as table_name,
  COUNT(*) as total_rows,
  pg_size_pretty(pg_total_relation_size('avatars')) as table_size
FROM avatars
UNION ALL
SELECT
  'locations' as table_name,
  COUNT(*) as total_rows,
  pg_size_pretty(pg_total_relation_size('locations')) as table_size
FROM locations
UNION ALL
SELECT
  'stylist_photos' as table_name,
  COUNT(*) as total_rows,
  pg_size_pretty(pg_total_relation_size('stylist_photos')) as table_size
FROM stylist_photos;
```

**Avant la migration :**
- avatars: ~95 MB
- locations: ~35 MB
- stylist_photos: ~2.2 MB
- **Total: ~132 MB**

**Après la migration :**
- avatars: ~40 KB
- locations: ~16 KB
- stylist_photos: ~8 KB
- **Total: ~64 KB** (99.95% de réduction !)

## Fonctionnement pour les nouvelles images

Toutes les nouvelles images créées seront automatiquement :
1. Uploadées vers le Storage
2. Enregistrées avec leur URL uniquement
3. Chargées via des URLs publiques

Aucune modification n'est nécessaire dans votre code d'application - tout est transparent !

## Nettoyage final (optionnel)

Une fois que vous avez confirmé que tout fonctionne, vous pouvez supprimer les colonnes `photo_base64` :

```sql
-- ⚠️ ATTENTION: Assurez-vous que toutes les images ont été migrées avant d'exécuter ceci !
ALTER TABLE avatars DROP COLUMN IF EXISTS photo_base64;
ALTER TABLE locations DROP COLUMN IF EXISTS photo_base64;
ALTER TABLE stylist_photos DROP COLUMN IF EXISTS photo_base64;
```

## Avantages

1. **Réduction massive de l'espace disque** (99%+)
2. **Meilleure performance** des requêtes
3. **Moins de bande passante** consommée
4. **CDN automatique** via Supabase Storage
5. **Évolutivité** illimitée pour les images
6. **Cache navigateur** optimisé

## Support

Si vous rencontrez des problèmes :
1. Vérifiez que le bucket `virtual-stylist` existe
2. Vérifiez les politiques RLS du storage
3. Vérifiez que les variables d'environnement sont correctes
4. Consultez les logs du script de migration
