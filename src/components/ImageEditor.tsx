import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Wand2,
  X,
  Palette,
  Store,
  User,
  Shirt,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  Move,
  Info,
  Plus,
  Replace,
  SplitSquareHorizontal,
  MapPin,
  UserCircle2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { editProductImage, generatePoseVariation, POSE_VARIATIONS } from '../lib/geminiService';
import { compressImage, formatFileSize } from '../lib/imageCompression';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultAvatarAndLocationDetails, getUserAvatars, getUserLocations, type AvatarData, type LocationData } from '../services/settings';
import { buildAvatarPromptFromProfile, buildLocationPromptFromProfile } from '../lib/promptBuilders';
import { StudioMagikLoader } from './ui/StudioMagikLoader';

interface ImageEditorProps {
  imageUrl: string;
  allPhotos: string[];
  currentPhotoIndex: number;
  onImageEdited: (newImageDataUrl: string) => void;
  onAddAsNewPhoto?: (newImageDataUrl: string) => void;
  onClose: () => void;
  onPhotoSelect?: (index: number) => void;
}

/**
 * ✅ Global prompt add-on to ensure "vrai iPhone / pas pro" everywhere,
 * including the ImageEditor quick actions AND custom instructions.
 * Note: geminiService.editProductImage already enforces similar constraints,
 * but we also reinforce them here to fight model "studio drift".
 */
const UGC_IPHONE_STYLE = `
STYLE GLOBAL (STRICT - VINTED FRIENDLY):
- Must look like a casual iPhone photo taken by a real person (UGC), NOT a professional studio/catalog photo.
- Natural ambient light (window light or indoor warm light). No softbox, no glossy studio lighting.
- Slight imperfections REQUIRED: not perfectly centered, not perfectly straight, slightly imperfect framing.
- Slight softness or mild motion blur acceptable; subtle sensor grain/noise; avoid over-sharpening and HDR/glow.
- Background must be everyday and non-idealized (room, wall, door, hallway, bathroom, wardrobe), not "seamless".
- Never make it look like a brand campaign: avoid perfect symmetry, perfect gradients, perfect props.

CRITICAL:
- Preserve product details perfectly (logos, labels, text, textures, patterns, colors). No distortions.
- Avoid any "AI look": no plastic skin, no over-smoothing, no weird artifacts.
`.trim();


/**
 * ✅ Background prompt rewritten to avoid “studio white seamless” defaults.
 * Still aims for readability but in a realistic everyday context.
 */
const SMART_BACKGROUND_PROMPT = `
Analyze the garment (color, material, style) and how it is presented (on hanger, flatlay, etc.) in the image, then change the background strictly following these rules.

GOAL:
- Make the item readable and attractive for Vinted, BUT keep it looking like a real casual iPhone photo (NOT pro).

BACKGROUND RULES (REAL-LIFE, NOT STUDIO):
1. **Light / white clothing**: Use a light neutral REAL surface (off-white wall, light beige wall, pale concrete, light wood table) with subtle imperfections/texture so it doesn’t disappear.
2. **Dark clothing (black, navy, charcoal)**: Use a brighter everyday background (off-white wall, light door, light sheet/bedspread). Keep it believable, not seamless.
3. **Natural textiles (linen, wool, organic)**: Use light wood table, beige wall, linen fabric, kraft paper — but keep it casual (slight wrinkles/imperfections ok).
4. **Streetwear / Sport**: Use a neutral everyday background (simple wall, door, hallway) with subtle texture. NOT an editorial set.
5. **Elegant pieces (dresses, suits)**: Use a simple neutral interior context (plain wall, door, wardrobe) with natural light, not staged props.
6. **Photos on hanger/rack**: Keep a normal wall/door/wardrobe background. Preserve the vertical silhouette clearly.
7. **Flatlay photos**: Use realistic supports like a bedspread, duvet, wooden table, matte board — but avoid “perfect studio flatlay”.

CONFLICT RESOLUTION (priority):
1) Presentation type (hanger vs flatlay)
2) Style (streetwear/elegant)
3) Color (light vs dark)
4) Material

DEFAULT IF UNSURE:
- A plain off-white wall or door with soft natural shadows (NOT a white studio seamless).

ABSOLUTE:
- Preserve the garment perfectly. Labels/logos/text must remain readable and unchanged.
- Keep realism: consistent shadows, no fake glow, no “perfect product shot” vibe.

${UGC_IPHONE_STYLE}
`.trim();

/**
 * ✅ Action prompts rewritten to be UGC iPhone / “pas pro” by default.
 */
const ACTION_PROMPTS = {
  PLACE: `
Action: Place (Real-life).
Place the product in a believable everyday setting to showcase it for Vinted (not a catalog).
Examples: near a plain door, on a bedspread, on a simple wooden table, in front of a wardrobe, on a hanger against a wall.

Rules:
- Keep it realistic and casual (UGC iPhone look). Slight imperfections in framing and angle are OK.
- Natural ambient lighting only. No studio feel.
- Preserve product details perfectly (logos, text, shapes, textures). No distortions.
- Keep the background simple but real (not seamless, not a perfect gradient).

${UGC_IPHONE_STYLE}
`.trim(),

  FOLD: `
Action: Fold (Real-life).
Fold the garment naturally like a real person would for a Vinted photo and place it on a realistic support:
wooden table, bedspread, duvet, simple fabric, matte board, shelf.

Rules:
- Fold should look natural, not “retail perfect”.
- Keep it UGC iPhone-like (not too sharp, not perfectly centered).
- Natural ambient light, soft shadows, no studio glow.
- Preserve product details perfectly (logos/text/labels). No distortions.

${UGC_IPHONE_STYLE}
`.trim(),

  TRY_ON: `
Action: Real-Life Try-On (UGC).
Show the garment worn or held by a REAL person (adult / teen / child depending on garment size/style),
in an everyday place (bathroom mirror, hallway, bedroom, near a door/wardrobe).

STRICT PRIVACY / VINTED RULE:
- NEVER show the full face.
  - Preferred: mirror selfie with the phone covering the face OR crop from neck down OR face outside frame.
  - If any face appears, it must be obscured and not identifiable.

Rules:
- No “fashion model” vibe. Normal body proportions. Natural posture.
- Must look like a quick iPhone photo: slight tilt, imperfect framing, mild softness/grain allowed.
- Natural ambient light only. No studio lighting.
- Garment fit/drape must be realistic and physically accurate.
- Preserve garment details perfectly (logos, patterns, textures, colors). No distortions.

${UGC_IPHONE_STYLE}
`.trim()
};

export function ImageEditor({
  imageUrl,
  allPhotos,
  currentPhotoIndex,
  onImageEdited,
  onAddAsNewPhoto,
  onClose,
  onPhotoSelect
}: ImageEditorProps) {
  const { user } = useAuth();
  const [instruction, setInstruction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Édition en cours');
  const [error, setError] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [defaultAvatar, setDefaultAvatar] = useState<AvatarData | null>(null);
  const [defaultLocation, setDefaultLocation] = useState<LocationData | null>(null);
  const [avatars, setAvatars] = useState<AvatarData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>('smart-avatar');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>('smart-location');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditHistory([imageUrl]);
    setHistoryIndex(0);
  }, [imageUrl]);

  useEffect(() => {
    const loadDefaultData = async () => {
      if (!user?.id) return;

      try {
        const { avatar, location } = await getDefaultAvatarAndLocationDetails(user.id);
        const userAvatars = await getUserAvatars(user.id);
        const userLocations = await getUserLocations(user.id);

        setDefaultAvatar(avatar);
        setDefaultLocation(location);
        setAvatars(userAvatars);
        setLocations(userLocations);

        // Use default avatar and location if defined by user
        if (avatar?.id) {
          setSelectedAvatarId(avatar.id);
        }
        if (location?.id) {
          setSelectedLocationId(location.id);
        }
      } catch (error) {
        console.error('Error loading default avatar and location:', error);
      }
    };

    loadDefaultData();
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };

    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInfo]);

  const currentImage = editHistory[historyIndex] || imageUrl;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < editHistory.length - 1;
  const hasEdited = historyIndex > 0;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentImage]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      if (zoom === 1 && e.deltaY > 0) return;

      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.25;

      setZoom(prev => {
        const newZoom = Math.min(Math.max(prev + delta, 1), 5);
        if (newZoom === 1) setPan({ x: 0, y: 0 });
        return newZoom;
      });
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, [zoom]);

  /**
   * ✅ Ensure EVERY edit gets “UGC iPhone / pas pro”
   * including custom user prompts (we append constraints).
   */
  const buildFinalPrompt = (rawPrompt: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed) return trimmed;

    // If user asks explicitly for something that sounds like studio,
    // the appended constraints will steer it back to believable UGC.
    return `${trimmed}\n\n${UGC_IPHONE_STYLE}`;
  };

  const convertImageUrlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert image URL to base64:', error);
      throw error;
    }
  };

  const handleEdit = async (customPrompt?: string) => {
    const rawPrompt = typeof customPrompt === 'string' ? customPrompt : instruction;

    if (!rawPrompt.trim()) {
      setError('Veuillez entrer une instruction');
      return;
    }

    const promptLower = rawPrompt.toLowerCase();
    const isTryOnAction =
      promptLower.includes('try-on') ||
      promptLower.includes('porté') ||
      promptLower.includes('worn') ||
      promptLower.includes('porter') ||
      promptLower.includes('wear') ||
      promptLower.includes('essayé') ||
      promptLower.includes('mannequin') ||
      promptLower.includes('modèle') ||
      promptLower.includes('personne');

    const isPlaceAction =
      promptLower.includes('place') ||
      promptLower.includes('situation') ||
      promptLower.includes('mise en scène') ||
      promptLower.includes('environnement') ||
      promptLower.includes('contexte');

    const isFoldAction =
      promptLower.includes('fold') ||
      promptLower.includes('plié') ||
      promptLower.includes('plier') ||
      promptLower.includes('folded');

    const isBackgroundAction =
      promptLower.includes('fond') ||
      promptLower.includes('background') ||
      promptLower.includes('palette') ||
      promptLower.includes('arrière-plan') ||
      promptLower.includes('décor');

    let enrichedPrompt = rawPrompt;

    // Use smart mode if "smart-avatar" or "smart-location" is selected (no specific avatar/location)
    const useSmartAvatar = selectedAvatarId === 'smart-avatar';
    const useSmartLocation = selectedLocationId === 'smart-location';

    const selectedAvatar = !useSmartAvatar
      ? (avatars.find(a => a.id === selectedAvatarId) || defaultAvatar)
      : null;
    const selectedLocation = !useSmartLocation
      ? (locations.find(l => l.id === selectedLocationId) || defaultLocation)
      : null;

    if (isTryOnAction && selectedAvatar) {
      const avatarDesc = buildAvatarPromptFromProfile(selectedAvatar);
      enrichedPrompt = `${rawPrompt}\n\n${avatarDesc}`;
    }

    if ((isPlaceAction || isBackgroundAction) && selectedLocation) {
      const locationDesc = buildLocationPromptFromProfile(selectedLocation);
      enrichedPrompt = `${enrichedPrompt}\n\n${locationDesc}`;
    }

    if (isFoldAction && selectedLocation) {
      const locationDesc = buildLocationPromptFromProfile(selectedLocation);
      enrichedPrompt = `${enrichedPrompt}\n\n${locationDesc}`;
    }

    const promptToUse = buildFinalPrompt(enrichedPrompt);

    try {
      if (isTryOnAction) {
        setLoadingMessage('Application du modèle');
      } else if (isBackgroundAction) {
        setLoadingMessage('Optimisation du fond');
      } else if (isPlaceAction) {
        setLoadingMessage('Mise en situation');
      } else if (isFoldAction) {
        setLoadingMessage('Création du pliage');
      } else {
        setLoadingMessage('Édition en cours');
      }

      setProcessing(true);
      setError(null);

      const response = await fetch(currentImage);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type;

      const referenceImages: { data: string; description: string }[] = [];

      if (isTryOnAction && selectedAvatar) {
        // Prioriser reference_photo_url pour un style UGC authentique avec vraie personne
        const avatarImageData = selectedAvatar.reference_photo_url
          ? await convertImageUrlToBase64(selectedAvatar.reference_photo_url)
          : (selectedAvatar.photo_url
            ? await convertImageUrlToBase64(selectedAvatar.photo_url)
            : selectedAvatar.photo_base64?.split('base64,')[1] || selectedAvatar.photo_base64 || '');

        if (avatarImageData) {
          referenceImages.push({
            data: avatarImageData,
            description: 'Reference image: Use this avatar/model as a reference for the person wearing the garment. Match the body type, skin tone, and overall appearance of this model exactly.'
          });
        }
      }

      if ((isPlaceAction || isBackgroundAction || isFoldAction) && selectedLocation) {
        // Prioriser reference_photo_url pour un style UGC authentique avec vrai lieu
        const locationImageData = selectedLocation.reference_photo_url
          ? await convertImageUrlToBase64(selectedLocation.reference_photo_url)
          : (selectedLocation.photo_url
            ? await convertImageUrlToBase64(selectedLocation.photo_url)
            : selectedLocation.photo_base64?.split('base64,')[1] || selectedLocation.photo_base64 || '');

        if (locationImageData) {
          referenceImages.push({
            data: locationImageData,
            description: 'Reference image: Use this background/location as a reference for the scene. Match the style, lighting, and ambiance of this environment exactly.'
          });
        }
      }

      const editedImageBase64 = await editProductImage(
        base64,
        mimeType,
        promptToUse,
        referenceImages.length > 0 ? referenceImages : undefined
      );

      const editedImageDataUrl = `data:${mimeType};base64,${editedImageBase64}`;

      const responseEdited = await fetch(editedImageDataUrl);
      const editedBlob = await responseEdited.blob();
      const tempFile = new File([editedBlob], 'edited-image.jpg', { type: 'image/jpeg' });

      const compressionResult = await compressImage(tempFile);
      console.log(
        `Compressed edited image: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(
          compressionResult.compressedSize
        )} (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
      );

      const compressedBlob = compressionResult.file;
      const compressedDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedBlob);
      });

      setEditHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(compressedDataUrl);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);

      if (typeof customPrompt !== 'string') {
        setInstruction('');
      }
    } catch (err) {
      console.error('Error editing image:', err);

      let errorMessage = "Erreur lors de l'édition de l'image";

      if (err instanceof Error) {
        if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage =
            "Quota Gemini dépassé. Le modèle de génération d'images Gemini nécessite un compte avec facturation activée. Veuillez activer la facturation sur console.cloud.google.com ou utiliser une clé API avec crédit disponible.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handlePoseVariation = async (poseInstruction: string) => {
    try {
      setLoadingMessage('Génération de la pose');
      setProcessing(true);
      setError(null);

      const response = await fetch(currentImage);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type;

      const editedImageBase64 = await generatePoseVariation(
        base64,
        mimeType,
        poseInstruction
      );

      const editedImageDataUrl = `data:${mimeType};base64,${editedImageBase64}`;

      const responseEdited = await fetch(editedImageDataUrl);
      const editedBlob = await responseEdited.blob();
      const tempFile = new File([editedBlob], 'pose-variation.jpg', { type: 'image/jpeg' });

      const compressionResult = await compressImage(tempFile);
      console.log(
        `Compressed pose variation: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(
          compressionResult.compressedSize
        )} (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
      );

      const compressedBlob = compressionResult.file;
      const compressedDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedBlob);
      });

      setEditHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(compressedDataUrl);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      console.error('Error generating pose variation:', err);

      let errorMessage = "Erreur lors de la génération de la variation de pose";

      if (err instanceof Error) {
        if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage =
            "Quota Gemini dépassé. La génération de variations de pose nécessite un compte avec facturation activée.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleUndo = () => {
    if (canUndo) setHistoryIndex(prev => prev - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIndex(prev => prev + 1);
  };

  const handleReset = () => {
    setEditHistory([imageUrl]);
    setHistoryIndex(0);
    setError(null);
    setShowComparison(false);
  };

  const handleAddAsNew = () => {
    if (onAddAsNewPhoto && hasEdited) {
      onAddAsNewPhoto(currentImage);
      setEditHistory([imageUrl]);
      setHistoryIndex(0);
      setShowComparison(false);
      setSuccessMessage('Photo ajoutée avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleReplace = () => {
    onImageEdited(currentImage);
    setEditHistory([imageUrl]);
    setHistoryIndex(0);
    setShowComparison(false);
    setSuccessMessage('Photo remplacée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleComparisonDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setComparisonPosition(x);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[80]">
      <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full h-[95vh] sm:h-[90vh] shadow-2xl relative flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl sm:rounded-t-2xl z-[100]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Studio Magik-AI</h2>

            </div>
          </div>

          <div className="flex items-center gap-2">
            <div ref={infoRef} className="relative hidden lg:block">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 text-sm font-medium shadow-sm hover:shadow-md"
              >
                <Info size={18} />
                <span>{showInfo ? 'Masquer' : 'Infos'}</span>
              </button>

              {showInfo && (
                <div className="absolute top-full right-0 mt-2 w-96 bg-white border-2 border-blue-300 rounded-xl p-5 shadow-2xl z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 bg-blue-100 rounded-lg p-2">
                      <Sparkles className="text-blue-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-slate-900 font-bold text-base mb-2">
                        Studio Magik-AI
                      </h3>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        Choisissez un Modèle (avatar), une option, une pose ou décrivez les modifications souhaitées pour sublimer votre article, puis cliquez sur Éditer :  Le Studio Magik-AI s’occupe du reste.
                        <br />
                        <br />
                        ⚠️ Les rendus sont volontairement naturels (style “photo iPhone”) car Vinted privilégie les visuels authentiques.
                        <br />
                        <br />
                       Vous êtes trop moche ou fatigué de poser? 1. Choisissez un Avatar, 2. Sélectionnez l'article, 3. Cliquez sur l’option “Porté” et laissez l'Avatar poser pour vous! 😎 
                        <br />
                        <br />
                        <span className="text-blue-700 font-medium">💡 Besoin d’ajouter ou modifier un avatar ?
</span>
                        <br />
                        Rendez-vous dans la{' '}
                        <a
                          href="/virtual-stylist"
                          className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = '/virtual-stylist';
                          }}
                        >
                          Cabine d'essayage
                        </a>
                        {' '}pour gérer vos avatars personnalisés.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowInfo(false)}
                      className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-lg p-1"
                      title="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: hasEdited ? '0' : '0' }}>
          <div className="p-3 sm:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Colonne gauche - Preview optimisée */}
            <div className="flex-shrink-0 w-full lg:w-80 xl:w-96 space-y-3">
            <div
              ref={imageContainerRef}
              className="w-full aspect-[3/4] lg:max-h-[500px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl overflow-hidden relative select-none shadow-lg ring-1 ring-black/5"
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {showComparison && hasEdited ? (
                <div
                  ref={comparisonRef}
                  className="absolute inset-0 cursor-ew-resize"
                  onMouseMove={handleComparisonDrag}
                  onClick={handleComparisonDrag}
                >
                  <div className="absolute inset-0">
                    <img src={currentImage} alt="Image editee" className="w-full h-full object-cover" />
                  </div>
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - comparisonPosition}% 0 0)` }}
                  >
                    <img src={imageUrl} alt="Image originale" className="w-full h-full object-cover" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                    style={{ left: `${comparisonPosition}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <SplitSquareHorizontal size={18} className="text-slate-600" />
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 bg-slate-900/80 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Avant
                  </div>
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Apres
                  </div>
                </div>
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                >
                  <img
                    src={currentImage}
                    alt="Image a editer"
                    draggable={false}
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transition: isDragging
                        ? 'none'
                        : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    }}
                    className={`w-full h-full object-cover origin-center ${
                      processing ? 'opacity-50 blur-sm' : ''
                    }`}
                  />
                </div>
              )}

              {!showComparison && zoom > 1 && (
                <div
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-[5] px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-white/20 flex items-center gap-2 pointer-events-none transition-all duration-300 ${
                    isDragging
                      ? 'bg-blue-600/90 text-white shadow-blue-500/20 scale-105'
                      : 'bg-white/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Move size={14} className={isDragging ? 'animate-pulse' : ''} />
                  <span className="text-xs font-semibold tracking-wide">
                    {isDragging ? 'Deplacement' : 'Glisser pour deplacer'}
                  </span>
                </div>
              )}

              {!showComparison && hasEdited && !processing && (
                <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 z-[5]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Editee ({historyIndex} modif.)</span>
                </div>
              )}

              {successMessage && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 z-[10] shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                  <Check className="w-4 h-4" />
                  <span>{successMessage}</span>
                </div>
              )}

              {processing && (
                <StudioMagikLoader message={loadingMessage} />
              )}

              <button
                type="button"
                onClick={() => setEnlargedImage(currentImage)}
                className="absolute top-3 right-3 p-2.5 rounded-lg transition-all shadow-lg bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200 hover:border-blue-400 z-[5]"
                title="Agrandir l'image"
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-[5]">
                {hasEdited && (
                  <button
                    type="button"
                    onClick={() => setShowComparison(!showComparison)}
                    className={`p-2.5 rounded-lg transition-all shadow-lg ${
                      showComparison
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200'
                    }`}
                    title="Comparer avant/apres"
                  >
                    <SplitSquareHorizontal className="w-5 h-5" />
                  </button>
                )}

                <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={`p-2 rounded-md transition-all ${
                      canUndo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title="Annuler"
                  >
                    <Undo2 size={18} />
                  </button>
                  <div className="w-px h-5 bg-slate-300 mx-0.5"></div>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={`p-2 rounded-md transition-all ${
                      canRedo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title="Refaire"
                  >
                    <Redo2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {allPhotos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onPhotoSelect && onPhotoSelect(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentPhotoIndex
                        ? 'border-blue-600 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

            {/* Colonne droite - Content */}
            <div className="flex-1 space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">
                {error}
              </div>
            )}

            {/* Avatar Selection - Always show, even if no avatars */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-2.5 sm:p-3 shadow-sm">
                <button
                  onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-md flex-shrink-0">
                      <UserCircle2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        Modèle (Avatar)
                      </p>
                      <p className="text-[10px] text-slate-600 truncate">
                        {selectedAvatarId === 'smart-avatar'
                          ? 'Modèle Intelligent'
                          : avatars.find(a => a.id === selectedAvatarId)?.name || 'Par défaut'}
                      </p>
                    </div>
                  </div>
                  {showAvatarSelector ? <ChevronUp size={16} className="flex-shrink-0" /> : <ChevronDown size={16} className="flex-shrink-0" />}
                </button>

                {showAvatarSelector && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {/* Smart Avatar Option */}
                    <button
                      onClick={() => {
                        setSelectedAvatarId('smart-avatar');
                        setShowAvatarSelector(false);
                      }}
                      className={`relative p-1.5 rounded-md border transition-all ${
                        selectedAvatarId === 'smart-avatar'
                          ? 'border-blue-600 bg-blue-100'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="aspect-square rounded overflow-hidden bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 mb-1 relative flex items-center justify-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Sparkles size={20} className="text-blue-600" />
                          <span className="text-[8px] font-bold text-blue-700">Auto</span>
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-slate-900 text-center truncate leading-tight">
                        Intelligent
                      </p>
                      {selectedAvatarId === 'smart-avatar' && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center">
                          <Check size={10} />
                        </div>
                      )}
                    </button>

                    {avatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => {
                          setSelectedAvatarId(avatar.id);
                          setShowAvatarSelector(false);
                        }}
                        className={`relative p-1.5 rounded-md border transition-all ${
                          selectedAvatarId === avatar.id
                            ? 'border-blue-600 bg-blue-100'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div className="aspect-square rounded overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 mb-1 relative">
                          {(avatar.photo_url || avatar.photo_base64) ? (
                            <>
                              <img
                                src={avatar.photo_url || avatar.photo_base64 || ''}
                                alt={avatar.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full absolute inset-0 hidden items-center justify-center bg-slate-100">
                                <UserCircle2 size={20} className="text-slate-400" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <UserCircle2 size={20} className="text-slate-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-slate-900 text-center truncate leading-tight">
                          {avatar.name}
                        </p>
                        {selectedAvatarId === avatar.id && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center">
                            <Check size={10} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            {/* Location Selection - Always show, even if no locations */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-2.5 sm:p-3 shadow-sm">
                <button
                  onClick={() => setShowLocationSelector(!showLocationSelector)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-md flex-shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        Lieu (Background)
                      </p>
                      <p className="text-[10px] text-slate-600 truncate">
                        {selectedLocationId === 'smart-location'
                          ? 'Fond Intelligent'
                          : locations.find(l => l.id === selectedLocationId)?.name || 'Par défaut'}
                      </p>
                    </div>
                  </div>
                  {showLocationSelector ? <ChevronUp size={16} className="flex-shrink-0" /> : <ChevronDown size={16} className="flex-shrink-0" />}
                </button>

                {showLocationSelector && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {/* Smart Location Option */}
                    <button
                      onClick={() => {
                        setSelectedLocationId('smart-location');
                        setShowLocationSelector(false);
                      }}
                      className={`relative p-1.5 rounded-md border transition-all ${
                        selectedLocationId === 'smart-location'
                          ? 'border-emerald-600 bg-emerald-100'
                          : 'border-slate-200 hover:border-emerald-300 bg-white'
                      }`}
                    >
                      <div className="aspect-square rounded overflow-hidden bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 mb-1 relative flex items-center justify-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Sparkles size={20} className="text-emerald-600" />
                          <span className="text-[8px] font-bold text-emerald-700">Auto</span>
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-slate-900 text-center truncate leading-tight">
                        Intelligent
                      </p>
                      {selectedLocationId === 'smart-location' && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                          <Check size={10} />
                        </div>
                      )}
                    </button>

                    {locations.map((location) => (
                      <button
                        key={location.id}
                        onClick={() => {
                          setSelectedLocationId(location.id);
                          setShowLocationSelector(false);
                        }}
                        className={`relative p-1.5 rounded-md border transition-all ${
                          selectedLocationId === location.id
                            ? 'border-emerald-600 bg-emerald-100'
                            : 'border-slate-200 hover:border-emerald-300 bg-white'
                        }`}
                      >
                        <div className="aspect-square rounded overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 mb-1 relative">
                          {(location.photo_url || location.photo_base64) ? (
                            <>
                              <img
                                src={location.photo_url || location.photo_base64 || ''}
                                alt={location.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full absolute inset-0 hidden items-center justify-center bg-slate-100">
                                <MapPin size={20} className="text-slate-400" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MapPin size={20} className="text-slate-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-slate-900 text-center truncate leading-tight">
                          {location.name}
                        </p>
                        {selectedLocationId === location.id && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                            <Check size={10} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            {/* Actions rapides */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-2 sm:mb-3 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600" />
                Actions Magiques Rapides
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(SMART_BACKGROUND_PROMPT)}
                  disabled={processing}
                  className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="p-1 sm:p-1.5 bg-blue-600 text-white rounded-md group-hover:scale-110 transition-transform duration-200">
                    <Palette size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-blue-900 text-center leading-tight">Fond optimisé</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.PLACE)}
                  disabled={processing}
                  className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg hover:from-emerald-100 hover:to-emerald-200 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="p-1 sm:p-1.5 bg-emerald-600 text-white rounded-md group-hover:scale-110 transition-transform duration-200">
                    <Store size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-900 text-center leading-tight">Mis en Situation</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.TRY_ON)}
                  disabled={processing}
                  className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-lg hover:from-pink-100 hover:to-pink-200 hover:border-pink-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="p-1 sm:p-1.5 bg-pink-600 text-white rounded-md group-hover:scale-110 transition-transform duration-200">
                    <User size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-pink-900 text-center leading-tight">Porté</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.FOLD)}
                  disabled={processing}
                  className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-lg hover:from-violet-100 hover:to-violet-200 hover:border-violet-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="p-1 sm:p-1.5 bg-violet-600 text-white rounded-md group-hover:scale-110 transition-transform duration-200">
                    <Shirt size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-violet-900 text-center leading-tight">Plier</span>
                </button>
              </div>
            </div>

            {/* Variations de Pose */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-2 sm:mb-3 flex items-center gap-2">
                <Move className="w-4 h-4 text-purple-600" />
                Variations de Pose
              </h3>
              <p className="text-[10px] text-slate-600 mb-2">
                Générer différentes perspectives de la même photo (personne, vêtement et fond identiques)
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {POSE_VARIATIONS.map((pose) => (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => handlePoseVariation(pose.instruction)}
                    disabled={processing}
                    className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="p-1 sm:p-1.5 bg-purple-600 text-white rounded-md group-hover:scale-110 transition-transform duration-200">
                      <Move size={14} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-purple-900 text-center leading-tight">{pose.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Edition personnalisée */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-600" />
                Edition Personnalisée
              </h3>

              <div>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={`Ex: Mets l'article porté en selfie miroir (téléphone devant le visage), dans un couloir ou salle de bain, lumière naturelle...`}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={processing}
                />
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Rendu "vrai iPhone / pas pro" appliqué automatiquement (anti studio, anti catalogue).
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                {hasEdited && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={processing}
                    className="px-3 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition-colors font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Reinitialiser a l'image originale"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Réinitialiser</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEdit()}
                  disabled={processing || !instruction.trim()}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Edition...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Editer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Footer avec boutons d'action - Toujours visible */}
        {hasEdited && (
          <div className="flex-shrink-0 bg-gradient-to-r from-emerald-50 via-emerald-100 to-teal-50 border-t-2 border-emerald-200 px-3 sm:px-6 py-3 sm:py-4 rounded-b-xl sm:rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 text-emerald-800 text-xs sm:text-sm font-semibold">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                <span className="hidden sm:inline">Image editee avec succes !</span>
                <span className="sm:hidden">Editee !</span>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleAddAsNew}
                  disabled={processing || !onAddAsNewPhoto}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg sm:rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  title={!onAddAsNewPhoto ? 'Non disponible' : "Ajouter l'image editee comme nouvelle photo"}
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Ajouter comme nouvelle</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplace}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-amber-600 text-white rounded-lg sm:rounded-xl hover:bg-amber-700 hover:shadow-lg transition-all font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Replace className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Remplacer l'originale</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-0 right-0 sm:top-4 sm:right-4 p-3 sm:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all backdrop-blur-sm z-10"
              title="Reduire"
            >
              <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <img
              src={enlargedImage}
              alt="Image agrandie"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs sm:text-sm font-medium">
              Cliquez en dehors pour fermer
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
