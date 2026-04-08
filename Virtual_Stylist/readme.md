<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Virtual Stylist - AI-Powered Fashion Studio

Application de stylisme virtuel avec IA utilisant Gemini et Supabase Storage.

View your app in AI Studio: https://ai.studio/apps/drive/1rQFacmTtPNTD2X9Dw7SxYfpxfUP2wS13

## Fonctionnalités

- **Génération d'avatars IA** : Créez des modèles personnalisés avec Gemini
- **Backgrounds professionnels** : Générez des fonds pour vos photos produits
- **Virtual Try-On** : Visualisez vos articles EasyVinted sur des modèles
- **Compression automatique** : Réduction de 70-85% de la taille des images
- **Multi-vendeurs** : Support complet des membres de famille EasyVinted
- **Storage optimisé** : Stockage Supabase avec URLs publiques

## Run Locally

**Prerequisites:**  Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `../.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Verify storage configuration:
   ```bash
   npm run verify:storage
   ```

## Documentation

- [IMAGE_COMPRESSION.md](./IMAGE_COMPRESSION.md) - Guide complet sur la compression d'images
- [TROUBLESHOOTING_IMAGES.md](./TROUBLESHOOTING_IMAGES.md) - Dépannage de l'affichage des images
- [STORAGE_MIGRATION.md](./STORAGE_MIGRATION.md) - Migration vers Supabase Storage

## Scripts disponibles

- `npm run dev` - Lancer le serveur de développement
- `npm run build` - Build de production
- `npm run preview` - Prévisualiser le build
- `npm run verify:storage` - Vérifier la configuration du storage
- `npm run verify:storage:verbose` - Vérification détaillée avec logs

## Optimisations récentes

### Compression d'images (Février 2026)
- Compression automatique de toutes les images avant upload
- Conversion PNG → JPEG avec qualité 85%
- Réduction de 70-85% de la taille des fichiers
- Logs détaillés de compression dans la console

### Storage public (Février 2026)
- Bucket `virtual-stylist` configuré en mode public
- URLs publiques fonctionnelles pour avatars, locations et photos
- Politiques RLS maintenues pour la sécurité des uploads
- Nettoyage automatique des doublons d'extension

## Intégration EasyVinted

Le Virtual Stylist est intégré avec EasyVinted pour :
- Importer des articles depuis votre dressing
- Utiliser les avatars par défaut des membres de famille
- Générer des photos professionnelles pour vos annonces
- Sauvegarder automatiquement dans Supabase
