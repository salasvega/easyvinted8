# Guide des Filtres de Sécurité Gemini - Styliste Virtuel

## Problème : Images bloquées avec erreur `IMAGE_OTHER`

Lorsque vous générez des essayages virtuels avec des modèles en maillot de bain ou lingerie, vous pouvez rencontrer l'erreur :
```
L'essayage virtuel a été arrêté: IMAGE_OTHER
```

## Pourquoi cela se produit ?

L'API Gemini de Google applique des filtres de sécurité qui peuvent bloquer certaines images de mode professionnelles, même si elles sont légitimes et destinées à un usage e-commerce.

### Raisons courantes du blocage :

1. **Images de modèles en sous-vêtements** : maillots de bain, lingerie, sportswear
2. **Poses ou cadrages considérés suggestifs** par l'IA
3. **Combinaison d'éléments** : modèle + vêtement + fond peut déclencher les filtres
4. **Qualité/résolution des images** : images floues peuvent être mal interprétées

## Solutions appliquées dans le code

Les paramètres de sécurité ont été ajustés pour permettre les images de mode :

```typescript
safetySettings: [
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_NONE', // Désactivé pour permettre les images de mode
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  // ... autres catégories
]
```

Les prompts incluent maintenant un contexte professionnel clair :
- "PROFESSIONAL E-COMMERCE FASHION PHOTOGRAPHY"
- "This is legitimate commercial fashion photography"
- "Swimwear, lingerie, and activewear are professional product categories"

## Solutions de contournement pour l'utilisateur

Si vous rencontrez toujours des blocages :

### 1. Modifiez le modèle de base
- Utilisez un avatar portant plus de vêtements (débardeur + short par exemple)
- Évitez les poses suggestives
- Préférez des cadrages neutres (face à la caméra, bras le long du corps)

### 2. Ajustez les photos de référence
- Utilisez des images nettes et professionnelles
- Évitez les photos avec un arrière-plan distrayant
- Privilégiez un éclairage naturel et uniforme

### 3. Testez progressivement
- Commencez par des vêtements couvrants
- Si ça fonctionne, testez ensuite avec des vêtements plus légers
- Identifiez quelle image déclenche le filtre

### 4. Alternative : Photo de produit seul
Si l'essayage virtuel échoue, utilisez le mode "Composition produit" :
- Sélectionnez uniquement le vêtement et le fond
- Pas de modèle = pas de blocage
- Résultat : photo du vêtement dans l'environnement choisi

## Limitations connues de l'API Gemini

Même avec `BLOCK_NONE`, certaines images peuvent être bloquées car :

1. **Filtres au niveau de l'infrastructure** : Google applique des filtres avant même que les paramètres API soient pris en compte
2. **Classification automatique** : l'IA peut mal interpréter le contexte
3. **Politiques évolutives** : Google peut modifier ses règles sans préavis

## Que faire si le problème persiste ?

1. **Vérifiez les logs de la console** :
   ```javascript
   console.log('Safety ratings:', response.candidates?.[0]?.safetyRatings);
   ```
   Cela indique quelle catégorie pose problème

2. **Contactez le support Google Cloud** :
   - Expliquez votre cas d'usage (e-commerce de mode)
   - Demandez une révision de compte pour usage professionnel
   - URL : https://cloud.google.com/support

3. **Considérez une API alternative** :
   - Stability AI (Stable Diffusion) : plus permissif
   - Midjourney API : bon pour la mode
   - RunwayML : spécialisé en vidéo/photo de mode

## Recommandations techniques

Pour minimiser les blocages :

```typescript
// ✅ Bon : contexte professionnel clair
const prompt = `Professional e-commerce fashion photography.
Model wearing swimwear for product catalog.
Natural lighting, professional pose.`;

// ❌ Éviter : langage ambigu
const prompt = `Sexy model in bikini`;
```

## Contact et support

Si vous êtes un développeur et souhaitez améliorer la compatibilité :
- Consultez la documentation Gemini : https://ai.google.dev/docs/safety_setting
- Testez avec différents modèles Gemini (Pro vs Flash)
- Partagez vos retours avec la communauté

---

**Note importante** : Ce système respecte toutes les réglementations en vigueur. Les images de mode professionnelles (maillots, lingerie) sont légitimes et conformes aux standards e-commerce internationaux.
