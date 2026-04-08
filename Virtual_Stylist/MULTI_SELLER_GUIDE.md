# Guide Multi-Vendeurs - Virtual Stylist

## Vue d'ensemble

Le Virtual Stylist supporte désormais un système multi-vendeurs qui permet à chaque vendeur de votre équipe EasyVinted d'avoir ses propres avatars et environnements par défaut, complètement isolés les uns des autres.

## Comment ça fonctionne

### 1. Isolation des préférences

Chaque vendeur (family_member) dans EasyVinted possède ses propres champs:
- `default_avatar_id`: L'avatar par défaut de ce vendeur
- `default_location_id`: L'environnement par défaut de ce vendeur

Ces préférences sont **complètement isolées** entre vendeurs. Modifier l'avatar par défaut d'un vendeur n'affecte pas les autres vendeurs.

### 2. Sélection du vendeur actif

Le Virtual Stylist affiche et modifie uniquement les préférences du **vendeur par défaut** configuré dans EasyVinted (`user_profiles.default_seller_id`).

Pour changer le vendeur actif:
1. Allez dans **EasyVinted** > **Paramètres** > **Équipe**
2. Sélectionnez le vendeur à définir par défaut
3. Revenez dans le Virtual Stylist
4. Les avatars et scènes par défaut affichés seront ceux du nouveau vendeur sélectionné

### 3. Indicateur visuel

Une bannière en haut du Virtual Stylist indique clairement:
- Le nom du vendeur actuellement actif
- Que les modèles et scènes par défaut sont propres à ce vendeur

## Cas d'usage

### Exemple 1: Famille avec plusieurs vendeurs

Marie et ses enfants Paul (12 ans) et Sophie (8 ans) vendent sur Vinted. Chacun a des préférences différentes:

- **Marie**: Avatar féminin adulte, environnement salon moderne
- **Paul**: Avatar masculin enfant, environnement chambre de jeu
- **Sophie**: Avatar féminin enfant, environnement jardin fleuri

Lorsque Marie crée des articles pour Paul:
1. Elle sélectionne Paul comme vendeur par défaut dans EasyVinted
2. Dans le Virtual Stylist, elle voit automatiquement l'avatar et l'environnement de Paul
3. Les photos générées utilisent les préférences de Paul
4. Les préférences de Marie et Sophie restent intactes

### Exemple 2: Boutique avec plusieurs vendeurs

Une boutique de revente a 3 vendeurs spécialisés:
- **Emma**: Vêtements féminins adultes
- **Lucas**: Vêtements masculins
- **Zoé**: Vêtements enfants

Chaque vendeur peut configurer ses propres modèles et environnements dans le Virtual Stylist sans affecter les autres.

## Fonctions techniques

### Dans Virtual Stylist

```typescript
// Récupère les avatars/locations du vendeur par défaut
const { defaultAvatarId, defaultLocationId, defaultSellerName } =
  await getDefaultAvatarAndLocation();

// Définit l'avatar par défaut du vendeur actif
await setDefaultAvatar(avatarId);

// Définit l'environnement par défaut du vendeur actif
await setDefaultLocation(locationId);
```

### Dans EasyVinted

```typescript
// Récupère les préférences du vendeur par défaut (avec fallback sur le profil utilisateur)
const { avatarPhoto, locationPhoto, writingStyle, personaId } =
  await getDefaultSellerAvatarAndLocation(userId);
```

## Important

- **Pas de vendeur par défaut configuré**: Si aucun vendeur par défaut n'est défini dans EasyVinted, le Virtual Stylist affichera une erreur lors de la tentative de définition d'avatars/locations par défaut
- **Synchronisation bidirectionnelle**: Les modifications dans le Virtual Stylist sont automatiquement reflétées dans EasyVinted et vice-versa
- **Isolation complète**: Les préférences d'un vendeur n'affectent jamais celles d'un autre vendeur

## Migration depuis l'ancien système

L'ancien système utilisait `user_profiles.default_avatar_id` et `user_profiles.default_location_id` pour tous les vendeurs. Le nouveau système:
1. Lit désormais depuis `family_members` du vendeur actif
2. Ne synchronise plus vers `user_profiles`
3. Permet une isolation complète entre vendeurs

Si vous aviez des préférences configurées dans l'ancien système, vous devrez les reconfigurer pour chaque vendeur individuellement.
