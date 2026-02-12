# Comportement de suppression des avatars

## Vue d'ensemble

Lorsqu'un avatar parent est supprimé, les avatars enfants (versions/variations créées par duplication ou édition) **ne sont PAS supprimés**. Ils deviennent des avatars orphelins.

## Architecture de la base de données

### Relation parent-enfant

La table `avatars` contient une colonne `parent_avatar_id` qui établit une relation d'auto-référence:

```sql
parent_avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL
```

**Comportement de la contrainte `ON DELETE SET NULL`:**
- Lorsqu'un avatar parent est supprimé, les avatars enfants restent dans la base
- Le champ `parent_avatar_id` des enfants est automatiquement mis à `NULL`
- Les avatars enfants deviennent des avatars orphelins mais restent utilisables

### Migration concernée

La migration `20260207012833_remove_cascade_delete_from_avatars.sql` a remplacé le comportement `ON DELETE CASCADE` initial par `ON DELETE SET NULL`.

**Raison du changement:** Éviter la suppression en cascade non souhaitée des avatars enfants qui peuvent être des créations précieuses pour l'utilisateur.

## Comportement de suppression

### Code frontend (Virtual_Stylist/services/supabaseservice.ts)

La fonction `deleteAvatarFromDb` effectue les opérations suivantes:

1. **Récupération de l'avatar à supprimer**
   ```typescript
   const avatar = await getAvatarById(id);
   ```

2. **Suppression des photos du storage**
   - Supprime uniquement les photos de l'avatar ciblé
   - Ne touche PAS aux photos des avatars enfants
   ```typescript
   if (avatar?.photoBase64 && avatar.photoBase64.startsWith('http')) {
     await deleteImageFromStorage(avatar.photoBase64);
   }
   if (avatar?.referencePhotoBase64 && avatar.referencePhotoBase64.startsWith('http')) {
     await deleteImageFromStorage(avatar.referencePhotoBase64);
   }
   ```

3. **Suppression de l'avatar de la base de données**
   ```typescript
   await supabase.from('avatars').delete().eq('id', id);
   ```
   - Les avatars enfants ont leur `parent_avatar_id` mis à `NULL` automatiquement
   - Ils ne sont pas supprimés

4. **Nettoyage d'IndexedDB**
   ```typescript
   await idbDelete(STORE_AVATARS, id);
   ```
   - Supprime uniquement l'avatar ciblé du cache local

### Ce qui N'EST PAS supprimé

- Les avatars enfants (versions/variations)
- Les photos des avatars enfants
- Les entrées IndexedDB des avatars enfants

## Affichage des avatars

La fonction `fetchAvatarsFromDb` récupère tous les avatars de l'utilisateur, y compris:
- Les avatars originaux (parent_avatar_id = NULL)
- Les avatars avec un parent (parent_avatar_id = UUID)
- **Les avatars orphelins** (parent_avatar_id = NULL après suppression du parent)

```typescript
const { data } = await supabase
  .from('avatars')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

## Scénario d'utilisation

### Exemple 1: Suppression d'un avatar parent

**État initial:**
- Avatar A (parent_avatar_id = NULL)
  - Avatar B (parent_avatar_id = A.id)
  - Avatar C (parent_avatar_id = A.id)

**Après suppression de l'avatar A:**
- Avatar A: ❌ Supprimé
- Avatar B: ✅ Conservé (parent_avatar_id = NULL)
- Avatar C: ✅ Conservé (parent_avatar_id = NULL)

### Exemple 2: Suppression d'un avatar enfant

**État initial:**
- Avatar A (parent_avatar_id = NULL)
  - Avatar B (parent_avatar_id = A.id)

**Après suppression de l'avatar B:**
- Avatar A: ✅ Non affecté
- Avatar B: ❌ Supprimé

## Avantages de cette approche

1. **Protection des données**: Les créations dérivées ne sont pas perdues
2. **Flexibilité**: Les utilisateurs peuvent supprimer un parent sans perdre ses variations
3. **Simplicité**: Pas besoin de confirmation supplémentaire pour les suppressions en cascade
4. **Sécurité**: Les avatars orphelins restent accessibles et utilisables

## Nettoyage des avatars orphelins

Si l'utilisateur souhaite nettoyer manuellement les avatars orphelins, il peut:
1. Identifier les avatars sans relation de parent visible dans l'interface
2. Les supprimer individuellement s'il le souhaite

Il n'y a pas de nettoyage automatique des avatars orphelins pour éviter toute perte de données non souhaitée.
