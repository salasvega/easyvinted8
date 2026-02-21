
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Upload, X, Pencil, Star, Info, Sparkles, Copy, Check, Camera, Eye, Maximize2, Minimize2, Save, Filter, Palette } from 'lucide-react';
import {
  Gender, AgeGroup, Origin, SkinTone, AvatarProfile, LocationProfile, AppState, Build, RenderStyle, HairColor, EyeColor, HairCut, HairTexture, Preset, StylistPhoto
} from './types';
import { generateBaseAvatar, generateBackground, performVirtualTryOn, fileToDataUrl, optimizeAvatarPromptFromText, optimizeLocationPromptFromText, generateAvatarFromTextPrompt, buildAvatarPromptFromProfile, analyzePhotoForAvatar, analyzePhotoForLocation, generateAvatarDescriptionFromPhoto } from './services/geminiservice';
import { compressAvatarImage } from './services/imageCompression';
import {
  saveAvatarToDb, fetchAvatarsFromDb, deleteAvatarFromDb, updateAvatarInDb,
  saveLocationToDb, fetchLocationsFromDb, deleteLocationFromDb, updateLocationInDb,
  savePresetToDb, fetchPresetsFromDb, deletePresetFromDb, supabase,
  fetchDressingArticles, DressingArticle, createAvatarVersion, getAvatarById,
  setDefaultAvatar, setDefaultLocation, getDefaultAvatarAndLocation,
  saveStylistPhoto, fetchStylistPhotos, deleteStylistPhoto
} from './services/supabaseservice';
import { NewVersionModal } from './components/NewVersionModal';
import StudioLoader from './components/StudioLoader';
import CardSkeletonLoader from './components/CardSkeletonLoader';
import AvatarEditModal from './components/AvatarEditModal';
import { CollapsibleFilterSection } from './components/CollapsibleFilterSection';
import './styles.css';

const GalleryLoader: React.FC = () => (
  <div className="animate-in fade-in duration-500">
    <div className="mb-8 flex justify-center">
      <div className="h-12 w-48 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl animate-pulse"></div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
      {Array.from({ length: 8 }).map((_, index) => (
        <AvatarSkeletonCard key={index} delay={index * 75} />
      ))}
    </div>
  </div>
);

const AvatarSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <div className="group space-y-3 sm:space-y-4" style={{ animationDelay: `${delay}ms` }}>
    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100">
      <div className="absolute inset-0 animate-pulse"></div>

      <div className="absolute top-4 right-4 h-7 w-24 bg-gray-300/80 rounded-xl animate-pulse"></div>

      <div className="absolute top-4 left-4 h-8 w-28 bg-gray-800/40 rounded-xl animate-pulse"></div>

      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
    </div>

    <div className="px-1 sm:px-2 space-y-2">
      <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4 animate-pulse"></div>
      <div className="h-2.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded w-1/2 animate-pulse"></div>
    </div>
  </div>
);

const SceneLoader: React.FC = () => (
  <div className="animate-in fade-in duration-500">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
      {Array.from({ length: 8 }).map((_, index) => (
        <LocationSkeletonCard key={index} delay={index * 75} />
      ))}
    </div>
  </div>
);

const LocationSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <div
    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 shadow-lg"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 animate-pulse"></div>

    <div className="absolute top-4 right-4 h-7 w-24 bg-yellow-300/60 rounded-xl animate-pulse flex items-center gap-1.5 px-3">
      <div className="w-3 h-3 bg-gray-800/30 rounded-full"></div>
      <div className="flex-1 h-2 bg-gray-800/30 rounded"></div>
    </div>

    <div className="absolute top-4 left-4 h-8 w-28 bg-gray-800/40 rounded-xl animate-pulse"></div>

    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 sm:p-6">
      <div className="h-3 bg-white/40 rounded w-3/4 mb-2 animate-pulse"></div>
      <div className="h-2.5 bg-white/30 rounded w-1/2 animate-pulse"></div>
    </div>

    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle: string; step?: number }> = ({ title, subtitle, step }) => (
  <div className="mb-6 px-4">
    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
    <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
  </div>
);

const FieldLabel: React.FC<{ label: string; info?: string }> = ({ label, info }) => (
  <div className="flex flex-col gap-1 mb-3">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    {info && <span className="text-xs text-gray-500">{info}</span>}
  </div>
);

const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; delay?: number }> = ({ title, subtitle, children, delay = 0 }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-500`} style={{ animationDelay: `${delay}ms` }}>
    <div className="bg-white px-6 py-4 border-b border-gray-100">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const SKIN_COLORS: Record<SkinTone, string> = {
  porcelain: '#F7E7E2', golden_fair: '#F8F4D0', fair: '#F3D9C9', light: '#F0CBB0',
  medium: '#EBB68D', medium_cool: '#D0A78B', light_tan: '#C6A681', tan: '#AD8360',
  bronze_medium: '#D9A873', bronze_dark: '#C18E5E', dark: '#8C5B3F', deep: '#624335'
};

const HAIR_COLORS: Record<HairColor, string> = {
  platinum: '#E5DECF', blonde: '#D1A361', honey: '#B98C46', ginger: '#BC5434',
  red: '#A62C2B', auburn: '#7E3128', chestnut: '#5E3A2B', brown: '#4A2E1F',
  chocolate: '#362016', black: '#1A1A1A', grey: '#8E8E8E', plum: '#5A314A'
};

const EYE_COLORS: Record<EyeColor, string> = {
  blue: '#7BB9E8', green: '#7C9E59', brown: '#634133', grey: '#8E9DA2', honey: '#BA8C08', black: '#1C1C1C'
};

const getRealisticIrisStyle = (eyeColor: EyeColor): React.CSSProperties => {
  const baseColor = EYE_COLORS[eyeColor];
  const colorMap: Record<EyeColor, { light: string; mid: string; dark: string; limbus: string; glow: string }> = {
    blue: { light: '#A8D5F2', mid: '#5B9BD5', dark: '#2B5B8A', limbus: '#1A3D5F', glow: 'rgba(123, 185, 232, 0.4)' },
    green: { light: '#B4D99F', mid: '#7FAB5F', dark: '#4A7035', limbus: '#2E4A22', glow: 'rgba(124, 158, 89, 0.4)' },
    brown: { light: '#A67C52', mid: '#6B4423', dark: '#3D2817', limbus: '#2A1810', glow: 'rgba(99, 65, 51, 0.3)' },
    grey: { light: '#B8C5CF', mid: '#7A8B98', dark: '#4A5662', limbus: '#2E3840', glow: 'rgba(142, 157, 162, 0.3)' },
    honey: { light: '#D4A84A', mid: '#B88A15', dark: '#8B6610', limbus: '#5A4210', glow: 'rgba(186, 140, 8, 0.45)' },
    black: { light: '#4A4A4A', mid: '#2A2A2A', dark: '#1A1A1A', limbus: '#0A0A0A', glow: 'rgba(74, 74, 74, 0.3)' }
  };

  const colors = colorMap[eyeColor];

  return {
    background: `
      radial-gradient(circle at 50% 50%, #000000 0%, #000000 15%, transparent 18%),
      radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, transparent 8%),
      conic-gradient(from 0deg at 50% 50%,
        ${colors.dark} 0deg, ${colors.mid} 30deg, ${colors.light} 45deg, ${colors.mid} 60deg,
        ${colors.dark} 90deg, ${colors.mid} 120deg, ${colors.light} 135deg, ${colors.mid} 150deg,
        ${colors.dark} 180deg, ${colors.mid} 210deg, ${colors.light} 225deg, ${colors.mid} 240deg,
        ${colors.dark} 270deg, ${colors.mid} 300deg, ${colors.light} 315deg, ${colors.mid} 330deg,
        ${colors.dark} 360deg
      ),
      radial-gradient(circle at 50% 50%, ${colors.light} 0%, ${colors.mid} 35%, ${colors.dark} 65%, ${colors.limbus} 75%, ${colors.limbus} 100%)
    `,
    boxShadow: `
      inset 0 0 20px rgba(0,0,0,0.4),
      inset 0 2px 4px rgba(0,0,0,0.3),
      0 0 15px ${colors.glow},
      0 0 25px ${colors.glow}
    `
  };
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: 'setup',
    avatar: {
      name: '',
      gender: 'feminine',
      ageGroup: 'adult',
      origin: 'caucasian',
      skinTone: 'fair',
      hairColor: 'brown',
      hairCut: 'medium',
      hairTexture: 'straight',
      eyeColor: 'brown',
      build: 'average',
      additionalFeatures: '',
      renderStyle: null,
      modelSignature: ''
    },
    location: null,
    renderStyle: null,
    modelSignature: '',
    garmentBase64: null,
    generatedImageUrl: null,
    isProcessing: false,
    error: null
  });

  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [savedAvatars, setSavedAvatars] = useState<AvatarProfile[]>([]);
  const [savedLocations, setSavedLocations] = useState<LocationProfile[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<StylistPhoto[]>([]);
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [defaultSellerName, setDefaultSellerName] = useState<string | null>(null);
  const [locName, setLocName] = useState("");
  const [locInput, setLocInput] = useState("");
  const [dressingArticles, setDressingArticles] = useState<DressingArticle[]>([]);
  const [showDressingPicker, setShowDressingPicker] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<DressingArticle | null>(null);

  const [showAvatarImportModal, setShowAvatarImportModal] = useState(false);
  const [avatarImportData, setAvatarImportData] = useState<{ name: string; photoBase64: string; applyStyle?: boolean } | null>(null);
  const [showLocationImportModal, setShowLocationImportModal] = useState(false);
  const [locationImportData, setLocationImportData] = useState<{ name: string; photoBase64: string } | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputWithStyleRef = useRef<HTMLInputElement>(null);
  const locationFileInputRef = useRef<HTMLInputElement>(null);

  const [showAvatarEditModal, setShowAvatarEditModal] = useState(false);
  const [avatarEditData, setAvatarEditData] = useState<AvatarProfile | null>(null);
  const [showAvatarEditInfo, setShowAvatarEditInfo] = useState(false);
  const [showLocationEditModal, setShowLocationEditModal] = useState(false);
  const [showLocationEditInfo, setShowLocationEditInfo] = useState(false);
  const [locationEditData, setLocationEditData] = useState<{ id: string; name: string; description: string; photoBase64: string } | null>(null);

  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [creationMethod, setCreationMethod] = useState<'text' | 'gallery' | 'manual' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'avatar' | 'location'; id: string; name: string } | null>(null);

  // Helper pour changer de méthode de création et réinitialiser modelSignature
  const changeCreationMethod = (method: 'text' | 'gallery' | 'manual' | null) => {
    setCreationMethod(method);
    // Réinitialiser modelSignature quand on change de méthode
    setState(p => ({ ...p, modelSignature: '' }));
    // Réinitialiser la photo de référence quand on bascule vers "Configuration Manuelle"
    if (method === 'manual') {
      setManualReferencePhoto(null);
      if (manualReferencePhotoInputRef.current) {
        manualReferencePhotoInputRef.current.value = '';
      }
    }
  };

  const [galleryUploadedPhoto, setGalleryUploadedPhoto] = useState<string | null>(null);
  const [galleryModelName, setGalleryModelName] = useState('');
  const galleryPhotoInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingGallery, setIsLoadingGallery] = useState(true);

  const [textGenerationName, setTextGenerationName] = useState('');
  const [textGenerationDescription, setTextGenerationDescription] = useState('');
  const [textGenerationStyle, setTextGenerationStyle] = useState<'studio' | 'casual' | '3d_hyperrealistic' | null>(null);
  const [isGeneratingFromText, setIsGeneratingFromText] = useState(false);

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{ name: string; prompt: string } | null>(null);

  const [manualReferencePhoto, setManualReferencePhoto] = useState<string | null>(null);
  const manualReferencePhotoInputRef = useRef<HTMLInputElement>(null);

  const [avatarFilters, setAvatarFilters] = useState<{
    gender: Gender | 'all';
    hairColor: HairColor | 'all';
    ageGroup: AgeGroup | 'all';
  }>({
    gender: 'all',
    hairColor: 'all',
    ageGroup: 'all'
  });

  const [locationFilters, setLocationFilters] = useState<{
    environment: 'all' | 'interior' | 'exterior' | 'studio';
    style: 'all' | 'minimalist' | 'modern' | 'natural' | 'urban' | 'elegant';
    tone: 'all' | 'light' | 'dark' | 'colorful' | 'neutral';
  }>({
    environment: 'all',
    style: 'all',
    tone: 'all'
  });

  useEffect(() => { loadGallery(); }, []);

  useEffect(() => {
    // Réinitialiser les états quand on change de méthode de création
    if (creationMethod === 'gallery') {
      setGalleryUploadedPhoto(null);
      setGalleryModelName('');
      setState(p => ({ ...p, renderStyle: null, modelSignature: '' }));
    }
  }, [creationMethod]);

  const loadGallery = async () => {
    setIsLoadingGallery(true);
    try {
      const [avas, locs, photos, defaults] = await Promise.all([
        fetchAvatarsFromDb(),
        fetchLocationsFromDb(),
        fetchStylistPhotos(),
        getDefaultAvatarAndLocation()
      ]);
      setSavedAvatars(avas);
      setSavedLocations(locs);
      setSavedPhotos(photos);
      setDefaultAvatarId(defaults.defaultAvatarId);
      setDefaultLocationId(defaults.defaultLocationId);
      setDefaultSellerName(defaults.defaultSellerName || null);
    } catch (err: any) { setState(p => ({ ...p, error: "Erreur Lookbook : " + err.message })); }
    finally { setIsLoadingGallery(false); }
  };

  const getFilteredAvatars = () => {
    return savedAvatars.filter(avatar => {
      if (avatarFilters.gender !== 'all' && avatar.gender !== avatarFilters.gender) {
        return false;
      }
      if (avatarFilters.hairColor !== 'all' && avatar.hairColor !== avatarFilters.hairColor) {
        return false;
      }
      if (avatarFilters.ageGroup !== 'all' && avatar.ageGroup !== avatarFilters.ageGroup) {
        return false;
      }
      return true;
    });
  };

  const detectLocationEnvironment = (loc: LocationProfile): 'interior' | 'exterior' | 'studio' | 'unknown' => {
    const text = `${loc.name} ${loc.description}`.toLowerCase();

    if (text.match(/studio|photo studio|fond blanc|white background|neutre/i)) return 'studio';
    if (text.match(/intérieur|interior|maison|home|chambre|salon|cuisine|room|indoor|inside/i)) return 'interior';
    if (text.match(/extérieur|exterior|jardin|garden|rue|street|parc|park|plage|beach|outdoor|outside|nature|forêt|forest|montagne|mountain/i)) return 'exterior';

    return 'unknown';
  };

  const detectLocationStyle = (loc: LocationProfile): 'minimalist' | 'modern' | 'natural' | 'urban' | 'elegant' | 'unknown' => {
    const text = `${loc.name} ${loc.description}`.toLowerCase();

    if (text.match(/minimaliste|minimalist|simple|épuré|clean/i)) return 'minimalist';
    if (text.match(/moderne|modern|contemporain|contemporary/i)) return 'modern';
    if (text.match(/naturel|natural|nature|organic|végétal|plante|plant/i)) return 'natural';
    if (text.match(/urbain|urban|ville|city|street|rue|industriel|industrial/i)) return 'urban';
    if (text.match(/élégant|elegant|luxe|luxury|chic|sophistiqué|sophisticated/i)) return 'elegant';

    return 'unknown';
  };

  const detectLocationTone = (loc: LocationProfile): 'light' | 'dark' | 'colorful' | 'neutral' | 'unknown' => {
    const text = `${loc.name} ${loc.description}`.toLowerCase();

    if (text.match(/clair|light|blanc|white|lumineux|bright/i)) return 'light';
    if (text.match(/sombre|dark|noir|black|nocturne|night/i)) return 'dark';
    if (text.match(/coloré|colorful|vibrant|couleur|color/i)) return 'colorful';
    if (text.match(/neutre|neutral|gris|grey|gray|beige/i)) return 'neutral';

    return 'unknown';
  };

  const getFilteredLocations = () => {
    return savedLocations.filter(loc => {
      if (locationFilters.environment !== 'all') {
        const env = detectLocationEnvironment(loc);
        if (env !== locationFilters.environment && env !== 'unknown') {
          return false;
        }
        if (env === 'unknown' && locationFilters.environment !== 'all') {
          return false;
        }
      }

      if (locationFilters.style !== 'all') {
        const style = detectLocationStyle(loc);
        if (style !== locationFilters.style && style !== 'unknown') {
          return false;
        }
        if (style === 'unknown' && locationFilters.style !== 'all') {
          return false;
        }
      }

      if (locationFilters.tone !== 'all') {
        const tone = detectLocationTone(loc);
        if (tone !== locationFilters.tone && tone !== 'unknown') {
          return false;
        }
        if (tone === 'unknown' && locationFilters.tone !== 'all') {
          return false;
        }
      }

      return true;
    });
  };

  const toggleDefaultAvatar = async (avatarId: string) => {
    try {
      const newDefaultId = defaultAvatarId === avatarId ? null : avatarId;
      await setDefaultAvatar(newDefaultId);
      setDefaultAvatarId(newDefaultId);
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors de la définition de l'avatar par défaut : " + err.message }));
    }
  };

  const toggleDefaultLocation = async (locationId: string) => {
    try {
      const newDefaultId = defaultLocationId === locationId ? null : locationId;
      await setDefaultLocation(newDefaultId);
      setDefaultLocationId(newDefaultId);
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors de la définition de la location par défaut : " + err.message }));
    }
  };

  const openDressingPicker = async () => {
    setState(p => ({ ...p, isProcessing: true }));
    try {
      const articles = await fetchDressingArticles();
      setDressingArticles(articles);
      setShowDressingPicker(true);
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur chargement dressing : " + err.message }));
    } finally {
      setState(p => ({ ...p, isProcessing: false }));
    }
  };

  const selectArticleFromDressing = async (article: DressingArticle) => {
    if (article.photos && article.photos.length > 0) {
      const photoUrl = article.photos[0];
      setState(p => ({ ...p, isProcessing: true }));
      try {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        const base64 = await fileToDataUrl(new File([blob], 'photo.jpg', { type: blob.type }));
        setState(p => ({ ...p, garmentBase64: base64, isProcessing: false }));
        setSelectedArticle(article);
        setShowDressingPicker(false);
      } catch (err: any) {
        setState(p => ({ ...p, error: "Erreur chargement image : " + err.message, isProcessing: false }));
      }
    }
  };

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(p => ({ ...p, isProcessing: true, error: null }));
    try {
      let avatarData = { ...state.avatar };

      if (manualReferencePhoto) {
        setState(p => ({ ...p, loadingMessage: 'Analyse de votre photo de référence...' }));

        const analysis = await analyzePhotoForAvatar(manualReferencePhoto);

        const genderMap: Record<string, Gender> = {
          'female': 'feminine',
          'male': 'masculine',
          'feminine': 'feminine',
          'masculine': 'masculine'
        };

        const ageGroupMap: Record<string, AgeGroup> = {
          'baby': 'baby',
          'child': 'child',
          'teen': 'teen',
          'young_adult': 'adult',
          'adult': 'adult',
          'middle_aged': 'adult',
          'senior': 'senior'
        };

        const skinToneMap: Record<string, SkinTone> = {
          'very_fair': 'porcelain',
          'fair': 'fair',
          'light': 'light',
          'medium': 'medium',
          'olive': 'medium_cool',
          'tan': 'tan',
          'brown': 'bronze_medium',
          'dark_brown': 'bronze_dark',
          'deep': 'deep'
        };

        const hairColorMap: Record<string, HairColor> = {
          'blonde': 'blonde',
          'brown': 'brown',
          'black': 'black',
          'red': 'red',
          'gray': 'grey',
          'grey': 'grey',
          'white': 'grey',
          'auburn': 'auburn',
          'chestnut': 'chestnut',
          'chocolate': 'chocolate',
          'honey': 'honey',
          'ginger': 'ginger',
          'platinum': 'platinum',
          'plum': 'plum'
        };

        const hairCutMap: Record<string, HairCut> = {
          'short': 'short',
          'medium': 'medium',
          'long': 'long',
          'bald': 'bald',
          'buzz_cut': 'short',
          'pixie': 'short',
          'bob': 'short',
          'shoulder_length': 'medium',
          'waist_length': 'long'
        };

        const hairTextureMap: Record<string, HairTexture> = {
          'straight': 'straight',
          'wavy': 'wavy',
          'curly': 'curly',
          'coily': 'coily',
          'kinky': 'coily'
        };

        const eyeColorMap: Record<string, EyeColor> = {
          'blue': 'blue',
          'green': 'green',
          'brown': 'brown',
          'hazel': 'brown',
          'gray': 'grey',
          'grey': 'grey',
          'amber': 'honey',
          'honey': 'honey',
          'black': 'black'
        };

        const buildMap: Record<string, Build> = {
          'slim': 'slim',
          'athletic': 'athletic',
          'average': 'average',
          'curvy': 'curvy',
          'plus_size': 'curvy'
        };

        const originMap: Record<string, Origin> = {
          'african': 'african',
          'east_asian': 'east_asian',
          'south_asian': 'south_asian',
          'caucasian': 'caucasian',
          'hispanic': 'hispanic',
          'middle_eastern': 'middle_eastern'
        };

        if (analysis.gender) avatarData.gender = genderMap[analysis.gender.toLowerCase()] || avatarData.gender;
        if (analysis.age_group) avatarData.ageGroup = ageGroupMap[analysis.age_group.toLowerCase()] || avatarData.ageGroup;
        if (analysis.origin) avatarData.origin = originMap[analysis.origin.toLowerCase()] || avatarData.origin;
        if (analysis.skin_tone) avatarData.skinTone = skinToneMap[analysis.skin_tone.toLowerCase()] || avatarData.skinTone;
        if (analysis.hair_color) avatarData.hairColor = hairColorMap[analysis.hair_color.toLowerCase()] || avatarData.hairColor;
        if (analysis.hair_cut) avatarData.hairCut = hairCutMap[analysis.hair_cut.toLowerCase()] || avatarData.hairCut;
        if (analysis.hair_texture) avatarData.hairTexture = hairTextureMap[analysis.hair_texture.toLowerCase()] || avatarData.hairTexture;
        if (analysis.eye_color) avatarData.eyeColor = eyeColorMap[analysis.eye_color.toLowerCase()] || avatarData.eyeColor;
        if (analysis.build) avatarData.build = buildMap[analysis.build.toLowerCase()] || avatarData.build;
      }

      const avatarWithStyle = { ...avatarData, renderStyle: state.renderStyle, modelSignature: state.modelSignature, referencePhotoBase64: manualReferencePhoto || undefined };

      // Générer le prompt de base à partir du profil
      const basePrompt = buildAvatarPromptFromProfile(avatarWithStyle);

      // Optimiser le prompt avec l'IA pour le rendre encore plus détaillé
      setState(p => ({ ...p, loadingMessage: 'Génération du prompt descriptif optimisé...' }));
      const generationPrompt = await optimizeAvatarPromptFromText(basePrompt);

      let img: string;
      if (manualReferencePhoto) {
        setState(p => ({ ...p, loadingMessage: 'Optimisation de votre photo...' }));
        img = await compressAvatarImage(manualReferencePhoto);
      } else {
        setState(p => ({ ...p, loadingMessage: 'Génération du modèle...' }));
        const rawImg = await generateBaseAvatar(avatarWithStyle, state.renderStyle);
        img = rawImg.startsWith('data:') ? rawImg : `data:image/png;base64,${rawImg}`;
      }
      setAvatarImage(img);

      setState(p => ({ ...p, loadingMessage: 'Enregistrement du modèle...' }));
      const saved = await saveAvatarToDb({
        ...avatarWithStyle,
        photoBase64: img,
        generationPrompt,
        additionalFeatures: generationPrompt
      });
      setSavedAvatars(prev => [saved, ...prev]);
      setState(p => ({ ...p, step: 'gallery', isProcessing: false, avatar: saved, loadingMessage: undefined }));
      setManualReferencePhoto(null);
    } catch (err: any) { setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined })); }
  };

  const updateAvatar = (fields: Partial<AvatarProfile>) => {
    setState(p => ({ ...p, avatar: { ...p.avatar, ...fields } }));
  };

  const handleCreateLocation = async () => {
    if (!locName.trim() || !locInput.trim()) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Optimisation de votre description...' }));
    try {
      // Optimiser le prompt avec l'IA
      const generationPrompt = await optimizeLocationPromptFromText(locInput);

      setState(p => ({ ...p, loadingMessage: 'Génération du fond...' }));
      const locationToGenerate: LocationProfile = {
        name: locName.trim(),
        description: locInput,
        photoBase64: '',
        generationPrompt
      };
      const rawImg = await generateBackground(locationToGenerate);
      const img = rawImg.startsWith('data:') ? rawImg : `data:image/png;base64,${rawImg}`;

      setState(p => ({ ...p, loadingMessage: 'Enregistrement du fond...' }));
      const newLoc: LocationProfile = {
        name: locName.trim(),
        description: locInput,
        photoBase64: img,
        generationPrompt
      };
      const saved = await saveLocationToDb(newLoc);
      setSavedLocations(prev => [saved, ...prev]);
      setState(p => ({ ...p, location: saved, isProcessing: false, loadingMessage: undefined }));
      setLocName("");
      setLocInput("");
    } catch (err: any) { setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined })); }
  };

  const handleTryOn = async () => {
    const selectedCount = [avatarImage, state.location?.photoBase64, state.garmentBase64].filter(Boolean).length;
    if (selectedCount < 2) return;

    setState(p => ({ ...p, isProcessing: true, error: null }));
    try {
      const rawRes = await performVirtualTryOn(
        avatarImage || '',
        state.garmentBase64 || '',
        state.location?.photoBase64,
        state.avatar,
        state.location || undefined
      );
      const res = rawRes.startsWith('data:') ? rawRes : `data:image/png;base64,${rawRes}`;
      setState(p => ({ ...p, generatedImageUrl: res, step: 'result', isProcessing: false }));
    } catch (err: any) { setState(p => ({ ...p, error: err.message, isProcessing: false })); }
  };

  const reset = () => {
    setState({
      step: 'setup',
      avatar: { name: '', gender: 'feminine', ageGroup: 'adult', origin: 'caucasian', skinTone: 'fair', hairColor: 'brown', hairCut: 'medium', hairTexture: 'straight', eyeColor: 'brown', build: 'average', additionalFeatures: '', renderStyle: 'studio' },
      location: null, renderStyle: 'studio', garmentBase64: null, generatedImageUrl: null, isProcessing: false, error: null
    });
    setAvatarImage(null);
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, applyStyle: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToDataUrl(file);
      setAvatarImportData({ name: '', photoBase64: base64, applyStyle });
      setShowAvatarImportModal(true);
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors du chargement de l'image : " + err.message }));
    }
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    if (avatarFileInputWithStyleRef.current) avatarFileInputWithStyleRef.current.value = '';
  };

  // Fonction wrapper pour l'import depuis la page "Nouveau modèle" (avec transformation)
  const handleAvatarFileSelectWithStyle = (e: React.ChangeEvent<HTMLInputElement>) => {
    return handleAvatarFileSelect(e, true);
  };

  // Fonction wrapper pour l'import depuis la galerie (sans transformation)
  const handleAvatarFileSelectNoStyle = (e: React.ChangeEvent<HTMLInputElement>) => {
    return handleAvatarFileSelect(e, false);
  };

  const handleAvatarImportSave = async () => {
    if (!avatarImportData || !avatarImportData.name.trim()) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Analyse de la photo en cours...' }));
    try {
      let photoToSave = avatarImportData.photoBase64;
      let usedRenderStyle: RenderStyle | null = null;

      // Si on doit appliquer le style de rendu (depuis la page "Nouveau modèle")
      if (avatarImportData.applyStyle) {
        setState(p => ({ ...p, loadingMessage: 'Optimisation de la photo importée...' }));
        photoToSave = await compressAvatarImage(avatarImportData.photoBase64);
        usedRenderStyle = state.renderStyle;
      }

      // Analyser l'image pour extraire les caractéristiques
      setState(p => ({ ...p, loadingMessage: 'Analyse des caractéristiques...' }));
      const analysis = await analyzePhotoForAvatar(avatarImportData.photoBase64);

      const genderMap: Record<string, Gender> = {
        'female': 'feminine',
        'male': 'masculine',
        'feminine': 'feminine',
        'masculine': 'masculine'
      };

      const ageGroupMap: Record<string, AgeGroup> = {
        'child': 'child',
        'teen': 'teen',
        'young_adult': 'adult',
        'adult': 'adult',
        'middle_aged': 'adult',
        'senior': 'senior',
        'baby': 'baby'
      };

      const skinToneMap: Record<string, SkinTone> = {
        'very_fair': 'porcelain',
        'fair': 'fair',
        'light': 'light',
        'medium': 'medium',
        'olive': 'medium_cool',
        'tan': 'tan',
        'brown': 'bronze_medium',
        'dark_brown': 'bronze_dark',
        'deep': 'deep'
      };

      const hairColorMap: Record<string, HairColor> = {
        'blonde': 'blonde',
        'brown': 'brown',
        'black': 'black',
        'red': 'red',
        'gray': 'grey',
        'grey': 'grey',
        'white': 'grey',
        'auburn': 'auburn',
        'chestnut': 'chestnut',
        'chocolate': 'chocolate',
        'honey': 'honey',
        'ginger': 'ginger',
        'platinum': 'platinum',
        'plum': 'plum'
      };

      const hairCutMap: Record<string, HairCut> = {
        'short': 'short',
        'medium': 'medium',
        'long': 'long',
        'bald': 'bald',
        'buzz_cut': 'short',
        'pixie': 'short',
        'bob': 'short',
        'shoulder_length': 'medium',
        'waist_length': 'long'
      };

      const hairTextureMap: Record<string, HairTexture> = {
        'straight': 'straight',
        'wavy': 'wavy',
        'curly': 'curly',
        'coily': 'coily',
        'kinky': 'coily'
      };

      const eyeColorMap: Record<string, EyeColor> = {
        'blue': 'blue',
        'green': 'green',
        'brown': 'brown',
        'hazel': 'brown',
        'gray': 'grey',
        'grey': 'grey',
        'amber': 'honey',
        'honey': 'honey',
        'black': 'black'
      };

      const buildMap: Record<string, Build> = {
        'slim': 'slim',
        'athletic': 'athletic',
        'average': 'average',
        'curvy': 'curvy',
        'plus_size': 'curvy'
      };

      const originMap: Record<string, Origin> = {
        'african': 'african',
        'east_asian': 'east_asian',
        'south_asian': 'south_asian',
        'caucasian': 'caucasian',
        'hispanic': 'hispanic',
        'middle_eastern': 'middle_eastern'
      };

      // Générer le prompt descriptif détaillé
      setState(p => ({ ...p, loadingMessage: 'Génération du prompt descriptif optimisé...' }));
      const detailedDescription = await generateAvatarDescriptionFromPhoto(avatarImportData.photoBase64);

      const importedAvatar: AvatarProfile = {
        name: avatarImportData.name.trim(),
        gender: analysis.gender ? genderMap[analysis.gender.toLowerCase()] || 'feminine' : 'feminine',
        ageGroup: analysis.age_group ? ageGroupMap[analysis.age_group.toLowerCase()] || 'adult' : 'adult',
        origin: analysis.origin ? originMap[analysis.origin.toLowerCase()] || 'caucasian' : 'caucasian',
        skinTone: analysis.skin_tone ? skinToneMap[analysis.skin_tone.toLowerCase()] || 'fair' : 'fair',
        hairColor: analysis.hair_color ? hairColorMap[analysis.hair_color.toLowerCase()] || 'brown' : 'brown',
        hairCut: analysis.hair_cut ? hairCutMap[analysis.hair_cut.toLowerCase()] || 'medium' : 'medium',
        hairTexture: analysis.hair_texture ? hairTextureMap[analysis.hair_texture.toLowerCase()] || 'straight' : 'straight',
        eyeColor: analysis.eye_color ? eyeColorMap[analysis.eye_color.toLowerCase()] || 'brown' : 'brown',
        build: analysis.build ? buildMap[analysis.build.toLowerCase()] || 'average' : 'average',
        additionalFeatures: detailedDescription,
        renderStyle: usedRenderStyle,
        photoBase64: photoToSave,
        generationPrompt: detailedDescription
      };

      setState(p => ({ ...p, loadingMessage: 'Enregistrement du modèle...' }));
      const saved = await saveAvatarToDb(importedAvatar);
      setSavedAvatars(prev => [saved, ...prev]);
      setShowAvatarImportModal(false);
      setAvatarImportData(null);
      setState(p => ({ ...p, isProcessing: false, step: 'gallery', loadingMessage: undefined }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined }));
    }
  };

  const handleGalleryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToDataUrl(file);
      setGalleryUploadedPhoto(base64);
      setState(p => ({ ...p, error: null }));
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors du chargement de l'image : " + err.message }));
    }

    if (galleryPhotoInputRef.current) {
      galleryPhotoInputRef.current.value = '';
    }
  };

  const clearGalleryPhoto = () => {
    setGalleryUploadedPhoto(null);
    setGalleryModelName('');
    if (galleryPhotoInputRef.current) {
      galleryPhotoInputRef.current.value = '';
    }
  };

  const handleManualReferencePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToDataUrl(file);
      setManualReferencePhoto(base64);
      setState(p => ({ ...p, error: null }));
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors du chargement de l'image : " + err.message }));
    }

    if (manualReferencePhotoInputRef.current) {
      manualReferencePhotoInputRef.current.value = '';
    }
  };

  const clearManualReferencePhoto = () => {
    setManualReferencePhoto(null);
    if (manualReferencePhotoInputRef.current) {
      manualReferencePhotoInputRef.current.value = '';
    }
  };

  const handleGenerateModel = async () => {
    if (!galleryUploadedPhoto || !galleryModelName.trim()) {
      setState(p => ({ ...p, error: 'Veuillez importer une photo et saisir un nom pour le modèle' }));
      return;
    }

    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Génération du modèle en cours...' }));

    try {
      let photoToSave = galleryUploadedPhoto;
      let usedRenderStyle: RenderStyle | null = state.renderStyle;

      // Optimisation de la photo importée
      setState(p => ({ ...p, loadingMessage: 'Optimisation de la photo importée...' }));
      photoToSave = await compressAvatarImage(galleryUploadedPhoto);

      const importedAvatar: AvatarProfile = {
        name: galleryModelName.trim(),
        gender: 'feminine',
        ageGroup: 'adult',
        origin: 'caucasian',
        skinTone: 'fair',
        hairColor: 'brown',
        hairCut: 'medium',
        hairTexture: 'straight',
        eyeColor: 'brown',
        build: 'average',
        additionalFeatures: state.renderStyle
          ? `Import avec style ${usedRenderStyle}${state.modelSignature ? `, ${state.modelSignature}` : ''}`
          : `Import direct${state.modelSignature ? ` - ${state.modelSignature}` : ''}`,
        renderStyle: usedRenderStyle,
        modelSignature: state.modelSignature || undefined,
        photoBase64: photoToSave
      };

      setState(p => ({ ...p, loadingMessage: 'Sauvegarde du modèle...' }));
      const saved = await saveAvatarToDb(importedAvatar);
      setSavedAvatars(prev => [saved, ...prev]);

      // Réinitialiser et rediriger
      clearGalleryPhoto();
      setState(p => ({
        ...p,
        isProcessing: false,
        step: 'gallery',
        loadingMessage: null,
        renderStyle: null,
        modelSignature: ''
      }));
    } catch (err: any) {
      console.error('Error in handleGenerateModel:', err);
      let errorMessage = err.message || 'Une erreur est survenue';

      if (errorMessage.includes('generation s\'est terminee sans produire d\'image')) {
        errorMessage += '\n\nSolution: Essayez de sélectionner "Aucun" pour le style de rendu afin d\'importer la photo sans transformation.';
      }

      setState(p => ({
        ...p,
        error: errorMessage,
        isProcessing: false,
        loadingMessage: null
      }));
    }
  };

  const handleLocationFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToDataUrl(file);
      setLocationImportData({ name: '', photoBase64: base64 });
      setShowLocationImportModal(true);
    } catch (err: any) {
      setState(p => ({ ...p, error: "Erreur lors du chargement de l'image : " + err.message }));
    }
    if (locationFileInputRef.current) locationFileInputRef.current.value = '';
  };

  const handleLocationImportSave = async () => {
    if (!locationImportData || !locationImportData.name.trim()) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Analyse de la photo en cours...' }));
    try {
      // Analyser l'image pour générer un prompt descriptif détaillé
      setState(p => ({ ...p, loadingMessage: 'Génération du prompt descriptif...' }));
      const detailedDescription = await analyzePhotoForLocation(locationImportData.photoBase64);

      // Optimiser le prompt avec l'IA
      setState(p => ({ ...p, loadingMessage: 'Optimisation du prompt descriptif...' }));
      const generationPrompt = await optimizeLocationPromptFromText(detailedDescription);

      const importedLocation: LocationProfile = {
        name: locationImportData.name.trim(),
        description: detailedDescription,
        photoBase64: locationImportData.photoBase64,
        generationPrompt
      };

      setState(p => ({ ...p, loadingMessage: 'Enregistrement du fond...' }));
      const saved = await saveLocationToDb(importedLocation);
      setSavedLocations(prev => [saved, ...prev]);
      setShowLocationImportModal(false);
      setLocationImportData(null);
      setState(p => ({ ...p, isProcessing: false, loadingMessage: undefined }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined }));
    }
  };

  const openAvatarEditModal = (avatar: AvatarProfile) => {
    setAvatarEditData({ ...avatar });
    setShowAvatarEditModal(true);
  };

  const handleAvatarEditSave = async (updatedData: Partial<AvatarProfile>) => {
    if (!avatarEditData || !updatedData.name?.trim()) return;
    setState(p => ({ ...p, isProcessing: true, error: null }));
    try {
      const updateData = {
        name: updatedData.name.trim(),
        gender: updatedData.gender,
        ageGroup: updatedData.ageGroup,
        origin: updatedData.origin,
        skinTone: updatedData.skinTone,
        hairColor: updatedData.hairColor,
        hairCut: updatedData.hairCut,
        hairTexture: updatedData.hairTexture,
        eyeColor: updatedData.eyeColor,
        build: updatedData.build,
        additionalFeatures: updatedData.additionalFeatures?.trim() || '',
        renderStyle: updatedData.renderStyle
      };

      await updateAvatarInDb(avatarEditData.id!, updateData);

      setSavedAvatars(prev => prev.map(a =>
        a.id === avatarEditData.id ? { ...a, ...updateData } : a
      ));

      if (state.avatar?.id === avatarEditData.id) {
        setState(p => ({ ...p, avatar: { ...p.avatar, ...updateData } }));
      }

      setShowAvatarEditModal(false);
      setAvatarEditData(null);
      setState(p => ({ ...p, isProcessing: false }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false }));
    }
  };

  const generateVersionName = async (current: AvatarProfile, parentId?: string): Promise<string> => {
    if (!parentId) {
      return `${current.name.trim()} Version`;
    }

    const parent = await getAvatarById(parentId);
    if (!parent) {
      return `${current.name.trim()} Version`;
    }

    const changes: string[] = [];

    // Labels en français pour les caractéristiques
    const genderLabels: Record<Gender, string> = {
      'masculine': 'Masculin',
      'feminine': 'Féminin'
    };

    const ageLabels: Record<AgeGroup, string> = {
      'baby': 'Bébé',
      'child': 'Enfant',
      'teen': 'Ado',
      'adult': 'Adulte',
      'senior': 'Senior'
    };

    const hairCutLabels: Record<HairCut, string> = {
      'bald': 'Chauve',
      'short': 'Cheveux Courts',
      'medium': 'Cheveux Mi-longs',
      'long': 'Cheveux Longs'
    };

    const hairTextureLabels: Record<HairTexture, string> = {
      'straight': 'Lisses',
      'wavy': 'Ondulés',
      'curly': 'Bouclés',
      'coily': 'Frisés'
    };

    const hairColorLabels: Record<HairColor, string> = {
      'platinum': 'Platine',
      'blonde': 'Blonds',
      'honey': 'Miel',
      'ginger': 'Roux',
      'red': 'Rouges',
      'auburn': 'Auburn',
      'chestnut': 'Châtain',
      'brown': 'Bruns',
      'chocolate': 'Chocolat',
      'black': 'Noirs',
      'grey': 'Gris',
      'plum': 'Prune'
    };

    const eyeColorLabels: Record<EyeColor, string> = {
      'blue': 'Yeux Bleus',
      'green': 'Yeux Verts',
      'brown': 'Yeux Marron',
      'grey': 'Yeux Gris',
      'honey': 'Yeux Miel',
      'black': 'Yeux Noirs'
    };

    const buildLabels: Record<Build, string> = {
      'slim': 'Mince',
      'average': 'Moyenne',
      'athletic': 'Athlétique',
      'curvy': 'Ronde'
    };

    // Comparer et ajouter les différences
    if (current.gender !== parent.gender) {
      changes.push(genderLabels[current.gender]);
    }

    if (current.ageGroup !== parent.ageGroup) {
      changes.push(ageLabels[current.ageGroup]);
    }

    if (current.hairCut !== parent.hairCut) {
      changes.push(hairCutLabels[current.hairCut]);
    }

    if (current.hairTexture !== parent.hairTexture) {
      changes.push(hairTextureLabels[current.hairTexture]);
    }

    if (current.hairColor !== parent.hairColor) {
      changes.push(hairColorLabels[current.hairColor]);
    }

    if (current.eyeColor !== parent.eyeColor) {
      changes.push(eyeColorLabels[current.eyeColor]);
    }

    if (current.build !== parent.build) {
      changes.push(buildLabels[current.build]);
    }

    // Générer le nom final
    if (changes.length === 0) {
      return `${current.name.trim()} Version`;
    }

    return `${current.name.trim()} ${changes.join(' ')}`;
  };

  const handleRegeneratePhoto = async (updatedData: Partial<AvatarProfile>) => {
    if (!avatarEditData) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Génération du nom de version...' }));
    try {
      const updatedAvatar = { ...avatarEditData, ...updatedData };

      // 1. Générer un nom automatique pour la nouvelle version basé sur les différences
      const newName = await generateVersionName(updatedAvatar, avatarEditData.id);

      // 2. Dupliquer le modèle avec les nouvelles caractéristiques
      setState(p => ({ ...p, loadingMessage: 'Création de la nouvelle version...' }));
      const duplicated = await createAvatarVersion(updatedAvatar, newName);

      // 3. Générer le prompt optimisé
      setState(p => ({ ...p, loadingMessage: 'Génération du prompt descriptif optimisé...' }));
      const basePrompt = buildAvatarPromptFromProfile(duplicated);
      const generationPrompt = await optimizeAvatarPromptFromText(basePrompt);

      // 4. Générer la nouvelle photo avec les nouvelles caractéristiques
      setState(p => ({ ...p, loadingMessage: 'Génération de la nouvelle photo...' }));
      // Ne pas passer modelSignature comme customPrompt car cela peut causer des erreurs
      // Laisser generateBaseAvatar construire le prompt à partir du profil
      const rawPhoto = await generateBaseAvatar(duplicated, duplicated.renderStyle);
      const newPhotoBase64 = rawPhoto.startsWith('data:') ? rawPhoto : `data:image/png;base64,${rawPhoto}`;

      // 5. Mettre à jour la nouvelle version avec la nouvelle photo et le prompt optimisé
      await updateAvatarInDb(duplicated.id!, {
        photoBase64: newPhotoBase64,
        generationPrompt,
        additionalFeatures: generationPrompt
      });

      const finalDuplicated = {
        ...duplicated,
        photoBase64: newPhotoBase64,
        additionalFeatures: generationPrompt,
        generationPrompt
      };
      setSavedAvatars(prev => [finalDuplicated, ...prev]);

      // 6. Fermer la modale
      setShowAvatarEditModal(false);
      setAvatarEditData(null);
      setState(p => ({ ...p, isProcessing: false, loadingMessage: undefined }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined }));
    }
  };

  const handleConfirmNewVersion = async (newName: string) => {
    if (!avatarEditData) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Création de la nouvelle version...' }));
    try {
      const saved = await createAvatarVersion(avatarEditData, newName);
      setSavedAvatars(prev => [saved, ...prev]);

      setShowAvatarEditModal(false);
      setAvatarEditData(null);
      setShowNewVersionModal(false);
      setState(p => ({ ...p, isProcessing: false, loadingMessage: undefined }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined }));
    }
  };

  const saveMontageAsAvatar = async () => {
    if (!state.avatar || !state.generatedImageUrl) return;
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Sauvegarde du montage...' }));
    try {
      const dressingArticleName = state.dressingArticle?.title || 'Création';
      const newName = `${state.avatar.name} - ${dressingArticleName}`;

      const photoToSave: StylistPhoto = {
        name: newName,
        photoBase64: state.generatedImageUrl,
        avatarId: state.avatar.id,
        locationId: state.location?.id,
        articleId: state.dressingArticle?.id
      };

      const saved = await saveStylistPhoto(photoToSave);
      setSavedPhotos(prev => [saved, ...prev]);

      setState(p => ({
        ...p,
        step: 'photos',
        isProcessing: false,
        error: null,
        loadingMessage: null,
        generatedImageUrl: null
      }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: null }));
    }
  };

  const handleGenerateModelFromText = async () => {
    if (!textGenerationName.trim()) {
      setState(p => ({ ...p, error: 'Veuillez saisir un nom pour le modèle' }));
      return;
    }

    if (!textGenerationDescription.trim()) {
      setState(p => ({ ...p, error: 'Veuillez saisir une description du modèle' }));
      return;
    }

    setIsGeneratingFromText(true);
    setState(p => ({ ...p, isProcessing: true, error: null, loadingMessage: 'Optimisation et génération du modèle en cours...' }));

    try {
      const rawBase64 = await generateAvatarFromTextPrompt(textGenerationDescription, textGenerationStyle || undefined);
      const photoBase64 = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;

      const optimizedPrompt = await optimizeAvatarPromptFromText(textGenerationDescription);

      // Analyser l'image générée pour extraire les caractéristiques
      setState(p => ({ ...p, loadingMessage: 'Analyse des caractéristiques...' }));
      const analysis = await analyzePhotoForAvatar(photoBase64);

      const genderMap: Record<string, Gender> = {
        'female': 'feminine',
        'male': 'masculine',
        'feminine': 'feminine',
        'masculine': 'masculine'
      };

      const ageGroupMap: Record<string, AgeGroup> = {
        'child': 'child',
        'teen': 'teen',
        'young_adult': 'adult',
        'adult': 'adult',
        'middle_aged': 'adult',
        'senior': 'senior',
        'baby': 'baby'
      };

      const skinToneMap: Record<string, SkinTone> = {
        'very_fair': 'porcelain',
        'fair': 'fair',
        'light': 'light',
        'medium': 'medium',
        'olive': 'medium_cool',
        'tan': 'tan',
        'brown': 'bronze_medium',
        'dark_brown': 'bronze_dark',
        'deep': 'deep'
      };

      const hairColorMap: Record<string, HairColor> = {
        'blonde': 'blonde',
        'brown': 'brown',
        'black': 'black',
        'red': 'red',
        'gray': 'grey',
        'grey': 'grey',
        'white': 'grey',
        'auburn': 'auburn',
        'chestnut': 'chestnut',
        'chocolate': 'chocolate',
        'honey': 'honey',
        'ginger': 'ginger',
        'platinum': 'platinum',
        'plum': 'plum'
      };

      const hairCutMap: Record<string, HairCut> = {
        'short': 'short',
        'medium': 'medium',
        'long': 'long',
        'bald': 'bald',
        'buzz_cut': 'short',
        'pixie': 'short',
        'bob': 'short',
        'shoulder_length': 'medium',
        'waist_length': 'long'
      };

      const hairTextureMap: Record<string, HairTexture> = {
        'straight': 'straight',
        'wavy': 'wavy',
        'curly': 'curly',
        'coily': 'coily',
        'kinky': 'coily'
      };

      const eyeColorMap: Record<string, EyeColor> = {
        'blue': 'blue',
        'green': 'green',
        'brown': 'brown',
        'hazel': 'brown',
        'gray': 'grey',
        'grey': 'grey',
        'amber': 'honey',
        'honey': 'honey',
        'black': 'black'
      };

      const buildMap: Record<string, Build> = {
        'slim': 'slim',
        'athletic': 'athletic',
        'average': 'average',
        'curvy': 'curvy',
        'plus_size': 'curvy'
      };

      const originMap: Record<string, Origin> = {
        'african': 'african',
        'east_asian': 'east_asian',
        'south_asian': 'south_asian',
        'caucasian': 'caucasian',
        'hispanic': 'hispanic',
        'middle_eastern': 'middle_eastern'
      };

      const newAvatar: AvatarProfile = {
        name: textGenerationName.trim(),
        photoBase64,
        gender: analysis.gender ? genderMap[analysis.gender.toLowerCase()] || 'feminine' : 'feminine',
        ageGroup: analysis.age_group ? ageGroupMap[analysis.age_group.toLowerCase()] || 'adult' : 'adult',
        origin: analysis.origin ? originMap[analysis.origin.toLowerCase()] || 'caucasian' : 'caucasian',
        skinTone: analysis.skin_tone ? skinToneMap[analysis.skin_tone.toLowerCase()] || 'fair' : 'fair',
        hairColor: analysis.hair_color ? hairColorMap[analysis.hair_color.toLowerCase()] || 'brown' : 'brown',
        hairCut: analysis.hair_cut ? hairCutMap[analysis.hair_cut.toLowerCase()] || 'medium' : 'medium',
        hairTexture: analysis.hair_texture ? hairTextureMap[analysis.hair_texture.toLowerCase()] || 'straight' : 'straight',
        eyeColor: analysis.eye_color ? eyeColorMap[analysis.eye_color.toLowerCase()] || 'brown' : 'brown',
        build: analysis.build ? buildMap[analysis.build.toLowerCase()] || 'average' : 'average',
        additionalFeatures: optimizedPrompt,
        renderStyle: textGenerationStyle || undefined,
        generationPrompt: optimizedPrompt
      };

      const savedAvatar = await saveAvatarToDb(newAvatar);
      setSavedAvatars(prev => [savedAvatar, ...prev]);

      setTextGenerationName('');
      setTextGenerationDescription('');
      setTextGenerationStyle(null);

      setState(p => ({ ...p, step: 'gallery', isProcessing: false, loadingMessage: undefined, error: null }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false, loadingMessage: undefined }));
    } finally {
      setIsGeneratingFromText(false);
    }
  };

  const openPromptModal = (avatar: AvatarProfile) => {
    if (avatar.generationPrompt) {
      setSelectedPrompt({ name: avatar.name, prompt: avatar.generationPrompt });
      setShowPromptModal(true);
    }
  };

  const openLocationPromptModal = (location: LocationProfile) => {
    if (location.description) {
      setSelectedPrompt({ name: location.name, prompt: location.description });
      setShowPromptModal(true);
    }
  };

  const openLocationEditModal = (location: LocationProfile) => {
    setLocationEditData({
      id: location.id!,
      name: location.name,
      description: location.description || '',
      photoBase64: location.photoBase64 || ''
    });
    setShowLocationEditModal(true);
  };

  const handleLocationEditSave = async () => {
    if (!locationEditData || !locationEditData.name.trim()) return;
    setState(p => ({ ...p, isProcessing: true, error: null }));
    try {
      await updateLocationInDb(locationEditData.id, {
        name: locationEditData.name.trim(),
        description: locationEditData.description.trim()
      });
      setSavedLocations(prev => prev.map(l =>
        l.id === locationEditData.id
          ? { ...l, name: locationEditData.name.trim(), description: locationEditData.description.trim() }
          : l
      ));
      if (state.location?.id === locationEditData.id) {
        setState(p => ({
          ...p,
          location: { ...p.location!, name: locationEditData.name.trim(), description: locationEditData.description.trim() }
        }));
      }
      setShowLocationEditModal(false);
      setShowLocationEditInfo(false);
      setLocationEditData(null);
      setState(p => ({ ...p, isProcessing: false }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false }));
    }
  };

  const openDeleteConfirm = (type: 'avatar' | 'location', id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setState(p => ({ ...p, isProcessing: true }));
    try {
      if (deleteTarget.type === 'avatar') {
        if (state.avatar?.id === deleteTarget.id) {
          setState(p => ({ ...p, avatar: { ...initialAvatar } }));
          setAvatarImage(null);
        }
        await deleteAvatarFromDb(deleteTarget.id);
      } else {
        if (state.location?.id === deleteTarget.id) {
          setState(p => ({ ...p, location: null }));
        }
        await deleteLocationFromDb(deleteTarget.id);
      }
      loadGallery();
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setState(p => ({ ...p, isProcessing: false }));
    } catch (err: any) {
      setState(p => ({ ...p, error: err.message, isProcessing: false }));
    }
  };

  const skinTones = Object.keys(SKIN_COLORS) as SkinTone[];
  const hairColors = Object.keys(HAIR_COLORS) as HairColor[];
  const eyeColors = Object.keys(EYE_COLORS) as EyeColor[];
  
  const origins: { id: Origin; label: string }[] = [
    { id: 'african', label: 'AFRO' },
    { id: 'east_asian', label: 'EST-ASIATIQUE' },
    { id: 'south_asian', label: 'SUD-ASIATIQUE' },
    { id: 'caucasian', label: 'EUROPÉEN' },
    { id: 'hispanic', label: 'LATINO' },
    { id: 'middle_eastern', label: 'MOYEN-ORIENT' }
  ];

  const cuts: { id: HairCut; label: string }[] = [
    { id: 'bald', label: 'CHAUVE' },
    { id: 'short', label: 'COURTS' },
    { id: 'medium', label: 'MI-LONGS' },
    { id: 'long', label: 'LONGS' }
  ];

  const textures: { id: HairTexture; label: string }[] = [
    { id: 'straight', label: 'LISSES' },
    { id: 'wavy', label: 'ONDULÉS' },
    { id: 'curly', label: 'BOUCLÉS' },
    { id: 'coily', label: 'FRISÉS' }
  ];

  const ages: { id: AgeGroup; label: string }[] = [
    { id: 'baby', label: 'BÉBÉ' },
    { id: 'child', label: 'ENFANT' },
    { id: 'teen', label: 'ADO' },
    { id: 'adult', label: 'ADULTE' },
    { id: 'senior', label: 'SENIOR' }
  ];

  const builds: { id: Build; label: string }[] = [
    { id: 'slim', label: 'SLIM' },
    { id: 'average', label: 'AVERAGE' },
    { id: 'athletic', label: 'ATHLETIC' },
    { id: 'curvy', label: 'CURVY' }
  ];

  const genders: { id: Gender; label: string }[] = [
    { id: 'feminine', label: 'FEMME' },
    { id: 'masculine', label: 'HOMME' }
  ];

  const choiceBtnClass = (isSelected: boolean, isAtLeastDisabled?: boolean) => `
    px-5 py-2.5 rounded-xl font-medium transition-all
    ${isSelected
      ? 'bg-slate-900 text-white shadow-lg'
      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}
    ${isAtLeastDisabled ? 'opacity-50 cursor-not-allowed' : ''}
  `.trim();

  const actionBtnClass = (isDisabled: boolean = false) => `
    w-full py-3 bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg
    ${isDisabled
      ? '!bg-slate-100 !text-slate-300 cursor-not-allowed'
      : 'hover:bg-emerald-600'}
  `.trim();

  return (
    <div className="virtual-stylist min-h-screen bg-gray-50 text-gray-900">
      {state.isProcessing && <StudioLoader message={state.loadingMessage || "Création en cours"} />}

      <div className="max-w-7xl mx-auto px-6 pt-3 pb-16">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Mon style</h1>
          <p className="text-sm text-gray-600 mt-1">Ajoutez ou Sélectionnez le modèle ou le fond que vous souhaitez utiliser pour l'essayage de vos articles!</p>
        </div>

        {/* Navigation */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setState(p => ({ ...p, step: 'setup' }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                state.step === 'setup'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Nouveau Modèle
            </button>
            <button
              onClick={() => setState(p => ({ ...p, step: 'gallery' }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                state.step === 'gallery'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Modèles
            </button>
            <button
              onClick={() => setState(p => ({ ...p, step: 'backgrounds' }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                state.step === 'backgrounds'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Fonds
            </button>
            <button
              onClick={() => setState(p => ({ ...p, step: 'garment' }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                state.step === 'garment'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Essayage
            </button>
            <button
              onClick={() => setState(p => ({ ...p, step: 'photos' }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                state.step === 'photos'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Mes Photos
            </button>
          </div>

          {/* Indicateur du vendeur actif */}
          {defaultSellerName && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-gray-700 font-medium">{defaultSellerName}</span>
            </div>
          )}
        </div>

        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center font-bold text-xs flex-shrink-0">!</span>
            <span className="flex-1">{state.error}</span>
          </div>
        )}

        {state.step === 'setup' && (
          <div>
            <SectionHeader title="Création du Modèle" subtitle="Choisissez la méthode qui vous convient le mieux" />

            {/* Sélection de la méthode de création */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Méthode 1: Configuration manuelle */}
              <button
                onClick={() => changeCreationMethod(creationMethod === 'manual' ? null : 'manual')}
                className={`p-5 rounded-xl border transition-all text-left ${
                  creationMethod === 'manual'
                    ? 'border-gray-900 bg-gray-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    creationMethod === 'manual' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Pencil className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Configuration Manuelle</h3>
                    <p className="text-xs text-gray-600">Contrôle total sur chaque détail</p>
                  </div>
                </div>
              </button>

              {/* Méthode 2: Import depuis galerie */}
              <button
                onClick={() => changeCreationMethod(creationMethod === 'gallery' ? null : 'gallery')}
                className={`p-5 rounded-xl border transition-all text-left ${
                  creationMethod === 'gallery'
                    ? 'border-gray-900 bg-gray-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    creationMethod === 'gallery' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Import Photo</h3>
                    <p className="text-xs text-gray-600">Utilisez une photo existante</p>
                  </div>
                </div>
              </button>

              {/* Méthode 3: Génération par texte */}
              <button
                onClick={() => changeCreationMethod(creationMethod === 'text' ? null : 'text')}
                className={`p-5 rounded-xl border transition-all text-left ${
                  creationMethod === 'text'
                    ? 'border-gray-900 bg-gray-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    creationMethod === 'text' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Génération par Texte</h3>
                    <p className="text-xs text-gray-600">Décrivez votre modèle à l'IA</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Contenu selon la méthode sélectionnée */}
            {creationMethod === 'text' && (
              <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <SectionCard title="Génération par Description Textuelle" subtitle="L'IA créera votre modèle à partir de votre description" delay={0}>
                  <div className="space-y-6">
                    {/* Nom du modèle */}
                    <div>
                      <FieldLabel label="Nom du Modèle" info="Nom d'identification du modèle" />
                      <input
                        type="text"
                        value={textGenerationName}
                        onChange={(e) => setTextGenerationName(e.target.value)}
                        placeholder="Ex: Sophie, Mannequin Hiver, etc."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Description du modèle */}
                    <div>
                      <FieldLabel label="Description du Modèle" info="Décrivez le modèle que vous souhaitez créer (âge, genre, traits physiques, style...)" />
                      <textarea
                        value={textGenerationDescription}
                        onChange={(e) => setTextGenerationDescription(e.target.value)}
                        placeholder="Ex: Femme d'environ 25 ans, cheveux longs châtains, yeux verts, sourire naturel, style décontracté..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-sm"
                        rows={4}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        L'IA optimisera automatiquement votre description pour obtenir le meilleur résultat possible
                      </p>
                    </div>

                    {/* Sélecteur de style de rendu */}
                    <div>
                      <FieldLabel label="Style de Rendu (optionnel)" info="Définit l'apparence finale du modèle. Laissez sans sélection pour un style par défaut." />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={() => setTextGenerationStyle(null)}
                          className={`px-5 py-3 rounded-xl font-medium transition-all ${
                            textGenerationStyle === null
                              ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          Aucun
                        </button>
                        <button
                          type="button"
                          onClick={() => setTextGenerationStyle('casual')}
                          className={`px-5 py-3 rounded-xl font-medium transition-all ${
                            textGenerationStyle === 'casual'
                              ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          Casual
                        </button>
                        <button
                          type="button"
                          onClick={() => setTextGenerationStyle('studio')}
                          className={`px-5 py-3 rounded-xl font-medium transition-all ${
                            textGenerationStyle === 'studio'
                              ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => setTextGenerationStyle('3d_hyperrealistic')}
                          className={`px-5 py-3 rounded-xl font-medium transition-all ${
                            textGenerationStyle === '3d_hyperrealistic'
                              ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          3D Hyperréaliste
                        </button>
                      </div>
                    </div>

                    {/* Bouton de génération */}
                    <button
                      onClick={handleGenerateModelFromText}
                      disabled={!textGenerationName.trim() || !textGenerationDescription.trim() || isGeneratingFromText}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 disabled:from-blue-600 disabled:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isGeneratingFromText ? (
                        <>
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-base uppercase tracking-wider">Génération en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-6 h-6" />
                          <span className="text-base uppercase tracking-wider">Générer le Modèle</span>
                        </>
                      )}
                    </button>
                  </div>
                </SectionCard>
              </div>
            )}

            {creationMethod === 'gallery' && (
              <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <SectionCard title="Import Photo Directe" subtitle="Importez une photo et créez votre modèle personnalisé" delay={0}>
                  <form onSubmit={handleAvatarSubmit} className="space-y-6">
                    {/* Nom du Modèle */}
                    <div>
                      <FieldLabel label="Nom du Modèle" info="Nom d'identification du modèle" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Mannequin Sarah - Collection Été"
                        value={state.avatar.name}
                        onChange={e => updateAvatar({ name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Photo de Référence (Optionnel) */}
                    <div>
                      <FieldLabel
                        label="Photo de Référence (Optionnel)"
                        info="Uploadez une photo de la personne réelle que vous voulez utiliser comme modèle. L'IA reproduira cette personne exactement dans tous les essayages."
                      />
                      <input
                        type="file"
                        ref={manualReferencePhotoInputRef}
                        accept="image/*"
                        onChange={handleManualReferencePhotoUpload}
                        className="hidden"
                      />

                      {!manualReferencePhoto ? (
                        <button
                          onClick={() => manualReferencePhotoInputRef.current?.click()}
                          type="button"
                          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="text-sm font-bold uppercase tracking-wider">Ajouter une Photo de Référence</span>
                        </button>
                      ) : (
                        <div className="relative w-full max-w-sm mx-auto">
                          <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-purple-300 shadow-xl">
                            <img
                              src={manualReferencePhoto}
                              alt="Photo de référence"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={clearManualReferencePhoto}
                            className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110"
                            title="Supprimer la photo de référence"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bouton Générer le Modèle */}
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={!state.avatar.name.trim() || state.isProcessing}
                        className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-xl font-bold text-lg transition-all shadow-xl ${
                          !state.avatar.name.trim() || state.isProcessing
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        <Sparkles className="w-6 h-6" />
                        <span className="uppercase tracking-wider">
                          {state.isProcessing ? 'Génération en cours...' : 'Générer le Modèle'}
                        </span>
                      </button>
                      {!state.avatar.name.trim() && (
                        <p className="text-xs text-red-500 mt-2 text-center">
                          Veuillez saisir un nom pour le modèle
                        </p>
                      )}
                    </div>
                  </form>
                </SectionCard>
              </div>
            )}

            {creationMethod === 'manual' && (
              <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <SectionCard title="Configuration Manuelle du Modèle" subtitle="Définissez précisément chaque caractéristique" delay={0}>
                  <form onSubmit={handleAvatarSubmit} className="space-y-6">
                    {/* Nom du Modèle */}
                    <div>
                      <FieldLabel label="Nom du Modèle" info="Nom d'identification du modèle" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Mannequin Sarah - Collection Été"
                        value={state.avatar.name}
                        onChange={e => updateAvatar({ name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Grille des Caractéristiques - Style Analysis IA */}
                    <div>
                      <FieldLabel label="Caractéristiques Physiques" info="Configurez chaque aspect du modèle" />

                      <div className="p-6 bg-gradient-to-br from-orange-50 via-white to-blue-50 rounded-2xl border border-orange-100">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Carte 1: Genre */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Genre</p>
                            <div className="grid grid-cols-2 gap-2">
                              {genders.map(g => (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => updateAvatar({ gender: g.id })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    state.avatar.gender === g.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {g.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 2: Tranche d'âge */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Tranche d'âge</p>
                            <div className="grid grid-cols-2 gap-2">
                              {ages.map(a => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => updateAvatar({ ageGroup: a.id })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    state.avatar.ageGroup === a.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 3: Morphologie */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Morphologie</p>
                            <div className="grid grid-cols-2 gap-2">
                              {builds.map(b => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => updateAvatar({ build: b.id })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    state.avatar.build === b.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 4: Origine */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Origine</p>
                            <div className="grid grid-cols-2 gap-2">
                              {origins.map(o => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => updateAvatar({ origin: o.id })}
                                  className={`px-3 py-2 rounded-lg text-[10px] font-medium transition-all ${
                                    state.avatar.origin === o.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 5: Teint */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Teint</p>
                            <div className="grid grid-cols-4 gap-2">
                              {skinTones.map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateAvatar({ skinTone: t })}
                                  className={`relative w-10 h-10 rounded-full transition-all duration-300 ${
                                    state.avatar.skinTone === t
                                      ? 'ring-2 ring-orange-500 ring-offset-2 scale-125'
                                      : 'ring-2 ring-gray-200 hover:scale-110 hover:ring-gray-300'
                                  }`}
                                  style={{ backgroundColor: SKIN_COLORS[t] }}
                                  title={t.replace('_', ' ')}
                                >
                                  {state.avatar.skinTone === t && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 6: Couleur yeux */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Couleur yeux</p>
                            <div className="grid grid-cols-4 gap-2">
                              {eyeColors.map(e => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={() => updateAvatar({ eyeColor: e })}
                                  className={`relative w-10 h-10 rounded-full transition-all duration-300 overflow-hidden ${
                                    state.avatar.eyeColor === e
                                      ? 'ring-2 ring-orange-500 ring-offset-2 scale-125'
                                      : 'ring-2 ring-gray-200 hover:scale-110 hover:ring-gray-300'
                                  }`}
                                  style={getRealisticIrisStyle(e)}
                                  title={e}
                                >
                                  {state.avatar.eyeColor === e && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                      <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 7: Couleur cheveux */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Couleur cheveux</p>
                            <div className="grid grid-cols-4 gap-2">
                              {hairColors.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  disabled={state.avatar.hairCut === 'bald'}
                                  onClick={() => updateAvatar({ hairColor: c })}
                                  className={`relative w-10 h-10 rounded-full transition-all duration-300 ${
                                    state.avatar.hairColor === c
                                      ? 'ring-2 ring-orange-500 ring-offset-2 scale-125'
                                      : 'ring-2 ring-gray-200 hover:scale-110 hover:ring-gray-300'
                                  } ${state.avatar.hairCut === 'bald' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                  style={{ backgroundColor: HAIR_COLORS[c] }}
                                  title={c}
                                >
                                  {state.avatar.hairColor === c && state.avatar.hairCut !== 'bald' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 8: Texture cheveux */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Texture cheveux</p>
                            <div className="grid grid-cols-2 gap-2">
                              {textures.map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  disabled={state.avatar.hairCut === 'bald'}
                                  onClick={() => updateAvatar({ hairTexture: t.id })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    state.avatar.hairTexture === t.id && state.avatar.hairCut !== 'bald'
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  } ${state.avatar.hairCut === 'bald' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Carte 9: Coupe */}
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Coupe</p>
                            <div className="grid grid-cols-2 gap-2">
                              {cuts.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => updateAvatar({ hairCut: c.id })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    state.avatar.hairCut === c.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Détails Signature */}
                    <div>
                      <FieldLabel label="Détails Signature (optionnel)" info="Accessoires, tenue, pose, style particulier" />
                      <textarea
                        value={state.avatar.additionalFeatures}
                        onChange={e => updateAvatar({ additionalFeatures: e.target.value })}
                        placeholder="Ex: Lunettes de vue noires, taches de rousseur, barbe de 3 jours, look minimaliste..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-sm"
                        rows={3}
                      />
                    </div>

                    {/* Style de Rendu */}
                    <div>
                      <FieldLabel label="Style de Rendu - Direction Artistique" info="Définit l'apparence finale du modèle" />
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={() => setState(p => ({ ...p, renderStyle: 'casual' }))}
                          className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                            state.renderStyle === 'casual'
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          Casual
                        </button>
                        <button
                          type="button"
                          onClick={() => setState(p => ({ ...p, renderStyle: 'studio' }))}
                          className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                            state.renderStyle === 'studio'
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => setState(p => ({ ...p, renderStyle: '3d_hyperrealistic' }))}
                          className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                            state.renderStyle === '3d_hyperrealistic'
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}>
                          3D Hyperréaliste
                        </button>
                      </div>
                    </div>

                    {/* Bouton Générer le Modèle */}
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={!state.avatar.name.trim() || state.isProcessing}
                        className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-xl font-bold text-lg transition-all shadow-xl ${
                          !state.avatar.name.trim() || state.isProcessing
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        <Sparkles className="w-6 h-6" />
                        <span className="uppercase tracking-wider">
                          {state.isProcessing ? 'Génération en cours...' : 'Générer le Modèle'}
                        </span>
                      </button>
                      {!state.avatar.name.trim() && (
                        <p className="text-xs text-red-500 mt-2 text-center">
                          Veuillez saisir un nom pour le modèle
                        </p>
                      )}
                    </div>
                  </form>
                </SectionCard>
              </div>
            )}
          </div>
        )}

        {state.step === 'photos' && (
          <div className="animate-in fade-in duration-700">
            <SectionHeader title="Mes Photos" subtitle="Vos créations de stylisme virtuel sauvegardées" />

            {isLoadingGallery ? (
              <GalleryLoader />
            ) : savedPhotos.length === 0 ? (
              <div className="py-20 text-center space-y-6 border-2 border-dashed border-gray-200 rounded-2xl">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl sm:text-4xl">📸</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Aucune photo pour le moment</p>
                  <p className="text-xs text-gray-400">Créez votre premier essayage dans la section "Essayage"</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
                {savedPhotos.map(photo => (
                  <div key={photo.id} className="group space-y-3 sm:space-y-4">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                      <img src={photo.photoBase64} className="w-full h-full object-cover" alt={photo.name} />

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnlargedImage({ url: photo.photoBase64!, name: photo.name });
                          }}
                          className="hidden md:flex w-10 h-10 md:w-12 md:h-12 bg-purple-600 rounded-xl items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95"
                          title="Agrandir"
                        >
                          <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer "${photo.name}" ?`)) {
                              deleteStylistPhoto(photo.id!).then(() => {
                                setSavedPhotos(prev => prev.filter(p => p.id !== photo.id));
                              }).catch(err => {
                                setState(p => ({ ...p, error: err.message }));
                              });
                            }
                          }}
                          className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none">
                        <p className="text-white text-xs font-bold truncate">{photo.name}</p>
                        {photo.created_at && (
                          <p className="text-white/60 text-[10px] mt-1">
                            {new Date(photo.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.step === 'backgrounds' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <SectionHeader title="Mes Fonds" subtitle="Choisissez l'environnement qui sublimera vos articles." />

            {/* Galerie des scènes */}
            <div className="mb-12 sm:mb-16 lg:mb-20">
              <FieldLabel label="Galerie de fonds" info={savedLocations.length > 0 ? `${savedLocations.length} fond(s) disponible(s)` : "Aucun fond sauvegardé"} />

              {isLoadingGallery ? (
                <SceneLoader />
              ) : savedLocations.length === 0 ? (
                <div className="py-20 text-center space-y-6 border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl sm:text-4xl">🎬</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Aucun fond pour le moment</p>
                    <p className="text-xs text-gray-400">Créez votre premier fond en utilisant le panneau ci-dessous</p>
                  </div>
                </div>
              ) : (
                <>
                {/* Filtres */}
                <div className="mb-8 sm:mb-12 max-w-7xl mx-auto px-4">
                  <CollapsibleFilterSection
                    title="Filtres de recherche"
                    subtitle={`${getFilteredLocations().length} fond${getFilteredLocations().length > 1 ? 's' : ''} trouvé${getFilteredLocations().length > 1 ? 's' : ''}`}
                    icon={<Palette className="w-5 h-5" />}
                    defaultOpen={false}
                    variant="secondary"
                  >
                    {/* Filtre Environnement */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Type d'environnement</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, environment: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.environment === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, environment: 'interior' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.environment === 'interior'
                              ? 'bg-amber-600 text-white shadow-lg scale-105'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          Intérieur
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, environment: 'exterior' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.environment === 'exterior'
                              ? 'bg-green-600 text-white shadow-lg scale-105'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          Extérieur
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, environment: 'studio' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.environment === 'studio'
                              ? 'bg-slate-700 text-white shadow-lg scale-105'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Studio
                        </button>
                      </div>
                    </div>

                    {/* Filtre Style */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Style</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'minimalist' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'minimalist'
                              ? 'bg-stone-600 text-white shadow-lg scale-105'
                              : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          Minimaliste
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'modern' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'modern'
                              ? 'bg-blue-600 text-white shadow-lg scale-105'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          Moderne
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'natural' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'natural'
                              ? 'bg-emerald-600 text-white shadow-lg scale-105'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Naturel
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'urban' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'urban'
                              ? 'bg-zinc-700 text-white shadow-lg scale-105'
                              : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          Urbain
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, style: 'elegant' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.style === 'elegant'
                              ? 'bg-rose-600 text-white shadow-lg scale-105'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          Élégant
                        </button>
                      </div>
                    </div>

                    {/* Filtre Tonalité */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Tonalité</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, tone: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.tone === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, tone: 'light' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.tone === 'light'
                              ? 'bg-sky-400 text-white shadow-lg scale-105'
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                        >
                          Clair
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, tone: 'dark' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.tone === 'dark'
                              ? 'bg-gray-800 text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Sombre
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, tone: 'colorful' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.tone === 'colorful'
                              ? 'bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white shadow-lg scale-105'
                              : 'bg-gradient-to-r from-pink-50 via-red-50 to-yellow-50 text-red-700 hover:from-pink-100 hover:via-red-100 hover:to-yellow-100'
                          }`}
                        >
                          Coloré
                        </button>
                        <button
                          onClick={() => setLocationFilters(prev => ({ ...prev, tone: 'neutral' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            locationFilters.tone === 'neutral'
                              ? 'bg-neutral-500 text-white shadow-lg scale-105'
                              : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          Neutre
                        </button>
                      </div>
                    </div>

                    {/* Bouton de réinitialisation */}
                    {(locationFilters.environment !== 'all' || locationFilters.style !== 'all' || locationFilters.tone !== 'all') && (
                      <div className="pt-4 border-t border-gray-100">
                        <button
                          onClick={() => setLocationFilters({ environment: 'all', style: 'all', tone: 'all' })}
                          className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl transition-all shadow-md hover:shadow-lg"
                        >
                          Réinitialiser tous les filtres
                        </button>
                      </div>
                    )}
                  </CollapsibleFilterSection>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
                  {getFilteredLocations().map(loc => (
                    <div key={loc.id} className="group space-y-3 sm:space-y-4">
                      <div
                        onClick={() => setState(p => ({ ...p, location: loc }))}
                        className={`studio-card relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-lg cursor-pointer transition-all duration-500 ${state.location?.id === loc.id ? 'ring-4 ring-black ring-offset-4 scale-[0.97] shadow-2xl' : 'grayscale hover:grayscale-0 hover:scale-[1.02]'}`}>
                        <img src={loc.photoBase64} className={`w-full h-full object-cover transition-all duration-700 ${state.location?.id === loc.id ? '' : 'grayscale group-hover:grayscale-0'}`} alt={loc.name} />

                        {/* Overlay avec actions */}
                        <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-2 sm:gap-3 ${state.location?.id === loc.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEnlargedImage({ url: loc.photoBase64!, name: loc.name }); }}
                            className="hidden md:flex w-10 h-10 md:w-12 md:h-12 bg-purple-600 rounded-xl items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95"
                            title="Agrandir"
                          >
                            <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setState(p => ({ ...p, location: loc, step: 'garment' }));
                            }}
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center text-black font-bold shadow-xl hover:scale-110 active:scale-95 text-base sm:text-lg"
                          >
                            &#10140;
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDefaultLocation(loc.id!);
                            }}
                            className={`w-10 h-10 sm:w-12 sm:h-12 ${defaultLocationId === loc.id ? 'bg-yellow-400' : 'bg-gray-600'} rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95`}
                          >
                            <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${defaultLocationId === loc.id ? 'fill-white' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openLocationEditModal(loc);
                            }}
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95"
                          >
                            <Pencil className="w-5 h-5 sm:w-6 sm:h-6" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm('location', loc.id!, loc.name);
                            }}
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95"
                          >
                            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                          </button>
                        </div>

                        {/* Badge par défaut */}
                        {defaultLocationId === loc.id && (
                          <div className="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl animate-in zoom-in-95 flex items-center gap-1.5">
                            <Star className="w-3 h-3 fill-black" />
                            Par défaut
                          </div>
                        )}

                        {/* Badge de sélection */}
                        {state.location?.id === loc.id && (
                          <div className="absolute top-4 left-4 bg-black text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl animate-in zoom-in-95">
                            Sélectionné
                          </div>
                        )}

                        {/* Bouton Prompt */}
                        {loc.description && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openLocationPromptModal(loc); }}
                            className="absolute bottom-4 left-4 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl flex items-center gap-1.5 hover:scale-105 transition-all z-10"
                            title="Consulter le prompt du fond"
                          >
                            <Info className="w-3 h-3" />
                            <span>Prompt</span>
                          </button>
                        )}

                        {/* Infos en bas de la carte */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 sm:p-6 pointer-events-none">
                          <p className="text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate">{loc.name}</p>
                          {loc.description && <p className="text-white/70 text-[8px] sm:text-[9px] uppercase tracking-wider truncate mt-1">{loc.description}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {getFilteredLocations().length === 0 && savedLocations.length > 0 && (
                  <div className="py-16 sm:py-24 text-center space-y-4 sm:space-y-6">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Aucun fond ne correspond aux filtres sélectionnés
                    </p>
                    <button
                      onClick={() => setLocationFilters({ environment: 'all', style: 'all', tone: 'all' })}
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-black text-white rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-all"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                )}
                </>
              )}
            </div>

            {/* Bloc de création personnalisée */}
            <div className="max-w-4xl mx-auto mb-12 sm:mb-16 lg:mb-20">
              <div className="bg-gray-50 text-gray-900 p-8 sm:p-10 lg:p-12 rounded-3xl space-y-8 sm:space-y-10 shadow-lg border border-gray-200">
                <div className="space-y-4">
                  <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Fond sur mesure</h3>
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">Nommez et décrivez le Fond que vous souhaitez créer</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">Nom du Fond</label>
                    <input
                      type="text"
                      value={locName}
                      onChange={e => setLocName(e.target.value)}
                      placeholder="Ex: Studio minimaliste, Plage ensoleillée..."
                      maxLength={50}
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm sm:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">Description détaillée</label>
                    <textarea
                      value={locInput}
                      onChange={e => setLocInput(e.target.value)}
                      placeholder="Ex: Loft minimaliste à Paris au crépuscule avec vue sur la Tour Eiffel, ambiance chaleureuse..."
                      className="w-full h-32 sm:h-40 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 text-sm sm:text-base text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateLocation}
                  disabled={!locName.trim() || !locInput.trim()}
                  className={actionBtnClass(!locName.trim() || !locInput.trim())}
                >
                  Générer le Fond
                </button>

                <div className="pt-6 border-t border-gray-200">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-4 text-center">ou</p>
                  <input
                    type="file"
                    ref={locationFileInputRef}
                    accept="image/*"
                    onChange={handleLocationFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => locationFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-medium transition-all shadow-md"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-bold uppercase tracking-wider">Importer une photo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bouton de navigation principal */}
            {(savedLocations.length > 0 || state.location) && (
              <div className="max-w-4xl mx-auto space-y-4">
                <button onClick={() => setState(p => ({ ...p, step: 'garment' }))} disabled={!state.location}
                  className={`group ${actionBtnClass(!state.location)} relative overflow-hidden`}>
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    Passer à l'étape suivante
                    <span className="text-lg">→</span>
                  </span>
                  {state.location && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  )}
                </button>

                {!state.location && (
                  <p className="text-center text-[9px] sm:text-[10px] text-gray-400 italic">
                    Veuillez sélectionner ou créer un fond pour continuer
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {state.step === 'garment' && (
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-1000">
            <SectionHeader title="L'Essayage" subtitle="Selectionnez votre modèle, un fond de photo et l'article de votre choix et laissez la magie réaliser l'essayage pour vous :)" />

            {/* Prévisualisation de la composition complète */}
            <div className="mb-12 sm:mb-16">
              <FieldLabel label="Votre Composition"  />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200">
                {/* Modèle */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${avatarImage ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                    Modèle
                  </div>
                  {avatarImage ? (
                    <div className="relative group">
                      <img src={avatarImage} className="aspect-[3/4] w-full object-cover rounded-xl shadow-lg ring-1 ring-black/5" alt="Avatar" />
                      <div className="glass absolute bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-2 rounded-xl shadow-md">
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{state.avatar.name}</span>
                      </div>
                      <button
                        onClick={() => { setAvatarImage(null); setState(p => ({ ...p, avatar: { name: '', gender: 'feminine', ageGroup: 'adult', origin: 'caucasian', skinTone: 'fair', hairColor: 'brown', hairCut: 'medium', hairTexture: 'straight', eyeColor: 'brown', build: 'average', additionalFeatures: '', renderStyle: 'studio' } })); }}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black rounded-full flex items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  ) : isLoadingGallery ? (
                    <CardSkeletonLoader />
                  ) : savedAvatars.length > 0 ? (
                    <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
                      <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-x-auto overflow-y-hidden">
                          <div className="flex gap-2 p-3 h-full" style={{ minWidth: 'max-content' }}>
                            {savedAvatars.map(ava => (
                              <button
                                key={ava.id}
                                onClick={() => { setAvatarImage(ava.photoBase64!); setState(p => ({ ...p, avatar: ava })); }}
                                className="flex-shrink-0 h-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-transparent hover:border-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <img src={ava.photoBase64} className="w-full h-full object-cover" alt={ava.name} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 p-1 border-t border-gray-100 bg-gray-50/50">
                          <p className="text-[4px] font-medium uppercase tracking-wide text-center text-gray-400">
                            {savedAvatars.length} modèle{savedAvatars.length > 1 ? 's' : ''} - Glisser
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
                      <div className="h-full flex flex-col items-center justify-center p-4 space-y-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xl text-gray-400">?</span>
                        </div>
                        <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 text-center">Aucun modèle</p>
                        <button
                          onClick={() => setState(p => ({ ...p, step: 'setup' }))}
                          className="px-4 py-2 bg-black text-white rounded-lg text-[8px] font-bold uppercase tracking-wider hover:bg-gray-900 transition-colors"
                        >
                          Créer un modèle
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Décor */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${state.location ? 'bg-blue-400' : 'bg-orange-400'}`}></div>
                    Fond
                  </div>
                  {state.location ? (
                    <div className="relative group">
                      <img src={state.location.photoBase64!} className="aspect-[3/4] w-full object-cover rounded-xl shadow-lg ring-1 ring-black/5" alt="Location" />
                      <div className="glass absolute bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-2 rounded-xl shadow-md">
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{state.location.name}</span>
                      </div>
                      <button
                        onClick={() => setState(p => ({ ...p, location: null }))}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black rounded-full flex items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  ) : isLoadingGallery ? (
                    <CardSkeletonLoader />
                  ) : savedLocations.length > 0 ? (
                    <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
                      <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-x-auto overflow-y-hidden">
                          <div className="flex gap-2 p-3 h-full" style={{ minWidth: 'max-content' }}>
                            {savedLocations.map(loc => (
                              <button
                                key={loc.id}
                                onClick={() => setState(p => ({ ...p, location: loc }))}
                                className="flex-shrink-0 h-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-transparent hover:border-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <img src={loc.photoBase64} className="w-full h-full object-cover" alt={loc.name} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 p-1 border-t border-gray-100 bg-gray-50/50">
                          <p className="text-[4px] font-medium uppercase tracking-wide text-center text-gray-400">
                            {savedLocations.length} décor{savedLocations.length > 1 ? 's' : ''} - Glisser
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
                      <div className="h-full flex flex-col items-center justify-center p-4 space-y-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xl text-gray-400">?</span>
                        </div>
                        <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 text-center">Aucun fond</p>
                        <button
                          onClick={() => setState(p => ({ ...p, step: 'backgrounds' }))}
                          className="px-4 py-2 bg-black text-white rounded-lg text-[8px] font-bold uppercase tracking-wider hover:bg-gray-900 transition-colors"
                        >
                          Créer un Fond
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* L'article à mettre en situation */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                    L'article
                  </div>
                  <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 overflow-hidden shadow-inner">
                    {state.garmentBase64 ? (
                      <div className="relative w-full h-full group">
                        <img src={state.garmentBase64} className="w-full h-full object-contain animate-in fade-in duration-500" alt="Garment" />
                        <div className="glass absolute bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-2 rounded-xl shadow-md">
                          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
                            {selectedArticle ? selectedArticle.title : 'Importee'}
                          </span>
                        </div>
                        <button
                          onClick={() => { setState(p => ({ ...p, garmentBase64: null })); setSelectedArticle(null); }}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black rounded-full flex items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center space-y-6 p-6">
                        <div className="text-center space-y-1">
                          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-400">Choisir une source</p>
                          <p className="text-[7px] sm:text-[8px] text-gray-400">Sélectionnez un article</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 w-full max-w-[200px]">
                          <label className="relative cursor-pointer group">
                            <input type="file" accept="image/*" onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const base64 = await fileToDataUrl(f);
                                setState(p => ({ ...p, garmentBase64: base64 }));
                                setSelectedArticle(null);
                              }
                            }} className="hidden" />
                            <div className="relative flex items-center justify-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-black hover:shadow-lg group-active:scale-[0.98] overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="relative text-xl font-bold text-gray-700 group-hover:text-black transition-colors duration-300">↑</span>
                              <span className="relative text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-700 group-hover:text-black transition-colors duration-300">Importer</span>
                            </div>
                          </label>
                          <label className="relative cursor-pointer group">
                            <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const base64 = await fileToDataUrl(f);
                                setState(p => ({ ...p, garmentBase64: base64 }));
                                setSelectedArticle(null);
                              }
                            }} className="hidden" />
                            <div className="relative flex items-center justify-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-black hover:shadow-lg group-active:scale-[0.98] overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="relative text-xl font-bold text-gray-700 group-hover:text-black transition-colors duration-300">📷</span>
                              <span className="relative text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-700 group-hover:text-black transition-colors duration-300">Photo</span>
                            </div>
                          </label>
                          <button
                            onClick={openDressingPicker}
                            className="relative flex items-center justify-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-black hover:shadow-lg active:scale-[0.98] overflow-hidden group"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <span className="relative text-xl">👔</span>
                            <span className="relative text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-700 group-hover:text-black transition-colors duration-300">Mon dressing</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section Génération */}
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
              {(() => {
                const selectedCount = [avatarImage, state.location, state.garmentBase64].filter(Boolean).length;
                const isDisabled = selectedCount < 2;

                return (
                  <>
                    {selectedCount < 2 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 text-center">
                          {selectedCount === 0
                            ? "Selectionnez au moins 2 elements parmi : modele, fond, article"
                            : selectedCount === 1
                            ? "Selectionnez encore 1 element pour continuer le montage"
                            : ""}
                        </p>
                      </div>
                    )}
                    {selectedCount === 2 && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-700 text-center">
                          {!state.garmentBase64 && avatarImage && state.location
                            ? "Montage modele + decor - L'article sera genere par l'IA"
                            : !state.location && avatarImage && state.garmentBase64
                            ? "Montage modele + article - Le fond sera genere par l'IA"
                            : !avatarImage && state.location && state.garmentBase64
                            ? "Montage article + decor - Le modele sera genere par l'IA"
                            : ""}
                        </p>
                      </div>
                    )}
                    <button onClick={handleTryOn} disabled={isDisabled}
                      className={`${actionBtnClass(isDisabled)}`}>
                      Passer à la cabine d'essayage
                    </button>
                  </>
                );
              })()}
              <div className="space-y-2">
                <p className="text-center text-[8px] sm:text-[9px] text-gray-400 italic">Le traitement peut durer entre 10 et 20 secondes.</p>
                
              </div>
            </div>
          </div>
        )}

        {state.step === 'result' && state.generatedImageUrl && (
          <div className="animate-in fade-in zoom-in-95 duration-1000 max-w-6xl mx-auto">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16 lg:gap-24 items-center">
                <div className="lg:col-span-7 relative group">
                    <div className="absolute -inset-4 bg-gradient-to-tr from-gray-100 via-white to-gray-50 rounded-2xl -z-10 blur-2xl opacity-50"></div>
                    <img src={state.generatedImageUrl} className={`${state.renderStyle === '3d_hyperrealistic' ? 'aspect-[16/9]' : 'aspect-[3/4]'} w-full object-cover rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)] sm:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border-[8px] sm:border-[12px] lg:border-[16px] border-white ring-1 ring-black/5`} alt="Result" />
                    <div className="absolute top-6 right-6 sm:top-8 sm:right-8 lg:top-12 lg:right-12 bg-black text-white text-[8px] sm:text-[9px] font-black px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-xl uppercase tracking-[0.2em] sm:tracking-[0.25em] lg:tracking-[0.3em] shadow-2xl">Photo shoot</div>
                </div>

                <div className="lg:col-span-5 space-y-8 sm:space-y-12 lg:space-y-16">
                    <div className="text-left">
                        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 tracking-tight">L'Éditorial Final</h2>
                        <div className="h-px w-16 sm:w-20 bg-black mb-6 sm:mb-8 opacity-20"></div>
                        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-light">
                            Le Shooting photo est réalisé. Le mannequin <span className="font-bold text-black">{state.avatar.name}</span> a été intégré dans l'environnement séléctionné <span className="font-bold text-black">{state.location?.name}</span> avec un style {state.renderStyle === 'studio' ? 'studio professionnel' : state.renderStyle === 'casual' ? 'décontractée et naturelle' : state.renderStyle === '3d_hyperrealistic' ? 'hyperréaliste multi-vues' : 'naturelle urbaine'}.
                        </p>
                    </div>

                    <div className="glass p-6 sm:p-8 lg:p-10 rounded-2xl space-y-6 sm:space-y-8">
                        <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-gray-400 border-b border-gray-200 pb-3 sm:pb-4">
                            <span>Méta-données</span>
                            <span>#VA-{Math.floor(Math.random()*10000)}</span>
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex justify-between text-[11px] sm:text-xs">
                                <span className="text-gray-400">Resolution</span>
                                <span className="font-bold">2K High Fidelity</span>
                            </div>
                            <div className="flex justify-between text-[11px] sm:text-xs">
                                <span className="text-gray-400">Process</span>
                                <span className="font-bold">AI Professional Studio</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:gap-5">
                        <a href={state.generatedImageUrl} download={`vogue-ai-${state.avatar.name}.png`}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg text-center">
                          Exporter le Rendu
                        </a>
                        <button onClick={saveMontageAsAvatar}
                          disabled={state.isProcessing}
                          className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-all shadow-lg">
                          Sauvegarder le Montage
                        </button>
                        <button onClick={() => setState(p => ({ ...p, step: 'garment', generatedImageUrl: null }))}
                          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors">
                          Nouvelle Création
                        </button>
                    </div>
                </div>
             </div>
          </div>
        )}

        {state.step === 'gallery' && (
          <div className="animate-in fade-in duration-700">
            <SectionHeader title="Modèle" subtitle="Définissez par défaut le modèle qui portera vos articles sur les annonces de vente :)
" />

            {isLoadingGallery ? (
              <GalleryLoader />
            ) : (
              <>
                {/* Filtres */}
                <div className="mb-8 sm:mb-12 max-w-7xl mx-auto px-4">
                  <CollapsibleFilterSection
                    title="Filtres de recherche"
                    subtitle={`${getFilteredAvatars().length} modèle${getFilteredAvatars().length > 1 ? 's' : ''} trouvé${getFilteredAvatars().length > 1 ? 's' : ''}`}
                    icon={<Filter className="w-5 h-5" />}
                    defaultOpen={false}
                    variant="primary"
                  >
                    {/* Filtre Genre */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Genre</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, gender: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.gender === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, gender: 'masculine' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.gender === 'masculine'
                              ? 'bg-blue-600 text-white shadow-lg scale-105'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          Homme
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, gender: 'feminine' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.gender === 'feminine'
                              ? 'bg-pink-600 text-white shadow-lg scale-105'
                              : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                          }`}
                        >
                          Femme
                        </button>
                      </div>
                    </div>

                    {/* Filtre Couleur de cheveux */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Couleur de cheveux</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'blonde' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'blonde'
                              ? 'bg-yellow-500 text-white shadow-lg scale-105'
                              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                          }`}
                        >
                          Blond
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'brown' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'brown'
                              ? 'bg-amber-700 text-white shadow-lg scale-105'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          Brun
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'black' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'black'
                              ? 'bg-gray-900 text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Noir
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'red' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'red'
                              ? 'bg-red-600 text-white shadow-lg scale-105'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          Roux
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, hairColor: 'grey' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.hairColor === 'grey'
                              ? 'bg-slate-500 text-white shadow-lg scale-105'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Gris
                        </button>
                      </div>
                    </div>

                    {/* Filtre Âge */}
                    <div className="mb-6">
                      <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-700 mb-3">Groupe d'âge</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'all' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'all'
                              ? 'bg-black text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Tous
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'baby' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'baby'
                              ? 'bg-emerald-600 text-white shadow-lg scale-105'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Bébé
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'child' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'child'
                              ? 'bg-teal-600 text-white shadow-lg scale-105'
                              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                          }`}
                        >
                          Enfant
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'teen' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'teen'
                              ? 'bg-sky-600 text-white shadow-lg scale-105'
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                        >
                          Ado
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'adult' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'adult'
                              ? 'bg-cyan-600 text-white shadow-lg scale-105'
                              : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                          }`}
                        >
                          Adulte
                        </button>
                        <button
                          onClick={() => setAvatarFilters(prev => ({ ...prev, ageGroup: 'senior' }))}
                          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                            avatarFilters.ageGroup === 'senior'
                              ? 'bg-orange-600 text-white shadow-lg scale-105'
                              : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                          }`}
                        >
                          Senior
                        </button>
                      </div>
                    </div>

                    {/* Bouton de réinitialisation */}
                    {(avatarFilters.gender !== 'all' || avatarFilters.hairColor !== 'all' || avatarFilters.ageGroup !== 'all') && (
                      <div className="pt-4 border-t border-gray-100">
                        <button
                          onClick={() => setAvatarFilters({ gender: 'all', hairColor: 'all', ageGroup: 'all' })}
                          className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 rounded-xl transition-all shadow-md hover:shadow-lg"
                        >
                          Réinitialiser tous les filtres
                        </button>
                      </div>
                    )}
                  </CollapsibleFilterSection>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
              {getFilteredAvatars().map(ava => (
                <div key={ava.id} className="group space-y-3 sm:space-y-4">
                   <div
                      onClick={() => { setAvatarImage(ava.photoBase64!); setState(p => ({ ...p, avatar: ava })); }}
                      className={`studio-card relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-lg cursor-pointer transition-all duration-500 ${state.avatar?.id === ava.id ? 'ring-4 ring-black ring-offset-4 scale-[0.97] shadow-2xl' : 'grayscale hover:grayscale-0 hover:scale-[1.02]'}`}>
                      <img src={ava.photoBase64} className={`w-full h-full object-cover transition-all duration-700 ${state.avatar?.id === ava.id ? '' : 'grayscale group-hover:grayscale-0'}`} alt={ava.name} />
                      <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-2 sm:gap-3 ${state.avatar?.id === ava.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                         <button onClick={(e) => { e.stopPropagation(); setEnlargedImage({ url: ava.photoBase64!, name: ava.name }); }} className="hidden md:flex w-10 h-10 md:w-12 md:h-12 bg-purple-600 rounded-xl items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95" title="Agrandir">
                           <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); setAvatarImage(ava.photoBase64!); setState(p => ({ ...p, avatar: ava, step: 'backgrounds' })); }} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center text-black font-bold shadow-xl hover:scale-110 active:scale-95 text-base sm:text-lg">&#10140;</button>
                         <button onClick={(e) => { e.stopPropagation(); toggleDefaultAvatar(ava.id!); }} className={`w-10 h-10 sm:w-12 sm:h-12 ${defaultAvatarId === ava.id ? 'bg-yellow-400' : 'bg-gray-600'} rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95`}>
                           <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${defaultAvatarId === ava.id ? 'fill-white' : ''}`} />
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); openAvatarEditModal(ava); }} className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95">
                           <Pencil className="w-5 h-5 sm:w-6 sm:h-6" />
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm('avatar', ava.id!, ava.name); }} className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-xl flex items-center justify-center text-white font-bold shadow-xl hover:scale-110 active:scale-95">
                           <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                         </button>
                      </div>
                      {defaultAvatarId === ava.id && (
                        <div className="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl animate-in zoom-in-95 flex items-center gap-1.5">
                          <Star className="w-3 h-3 fill-black" />
                          Par défaut
                        </div>
                      )}
                      {state.avatar?.id === ava.id && (
                        <div className="absolute top-4 left-4 bg-black text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl animate-in zoom-in-95">
                          Sélectionné
                        </div>
                      )}
                      {ava.generationPrompt && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openPromptModal(ava); }}
                          className="absolute bottom-4 left-4 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider shadow-xl flex items-center gap-1.5 hover:scale-105 transition-all"
                          title="Consulter le prompt du modèle"
                        >
                          <Info className="w-3 h-3" />
                          <span>Prompt</span>
                        </button>
                      )}
                   </div>
                   <div className="px-1 sm:px-2">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest truncate">{ava.name}</p>
                      <p className="text-[7px] sm:text-[8px] text-gray-400 uppercase tracking-wider sm:tracking-widest">{new Date(ava.created_at!).toLocaleDateString()}</p>
                   </div>
                </div>
              ))}
            </div>

            {getFilteredAvatars().length === 0 && savedAvatars.length > 0 && (
              <div className="py-16 sm:py-24 text-center space-y-4 sm:space-y-6">
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Aucun modèle ne correspond aux filtres sélectionnés
                </p>
                <button
                  onClick={() => setAvatarFilters({ gender: 'all', hairColor: 'all', ageGroup: 'all' })}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-black text-white rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-all"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}

            {savedAvatars.length > 0 && getFilteredAvatars().length > 0 && (
              <div className="mt-12 sm:mt-16 lg:mt-20 space-y-4">
                <button onClick={() => setState(p => ({ ...p, step: 'backgrounds' }))} disabled={!state.avatar}
                  className={`group ${actionBtnClass(!state.avatar)} relative overflow-hidden`}>
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    Passer à l'étape suivante
                    <span className="text-lg">→</span>
                  </span>
                  {state.avatar && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  )}
                </button>

                {!state.avatar && (
                  <p className="text-center text-[9px] sm:text-[10px] text-gray-400 italic">
                    Veuillez sélectionner un modèle pour continuer
                  </p>
                )}
              </div>
            )}

            {savedAvatars.length === 0 && (
              <div className="py-24 sm:py-32 lg:py-40 text-center space-y-6 sm:space-y-8">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-gray-300">Votre archive est vide</p>
                <button onClick={reset} className="px-8 sm:px-12 py-4 sm:py-5 border border-gray-200 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest hover:bg-black hover:text-white transition-all">Commencer</button>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>

      {showDressingPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowDressingPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Mon Dressing Easyvinted</h3>
                <p className="text-xs text-gray-400 mt-1">{dressingArticles.length} article{dressingArticles.length > 1 ? 's' : ''} disponible{dressingArticles.length > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowDressingPicker(false)} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-lg transition-colors">
                x
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ overflowY: 'scroll' }}>
              {dressingArticles.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-4">Aucun article dans votre dressing</p>
                  <p className="text-xs text-gray-400">Ajoutez des articles via Easyvinted pour les utiliser ici</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {dressingArticles.map(article => (
                    <button
                      key={article.id}
                      onClick={() => selectArticleFromDressing(article)}
                      className="group text-left bg-gray-50 hover:bg-gray-100 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="aspect-square bg-white relative overflow-hidden">
                        {article.photos && article.photos.length > 0 ? (
                          <img src={article.photos[0]} alt={article.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <span className="text-3xl">?</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                            <span className="text-lg">+</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider truncate">{article.title}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] text-gray-400 uppercase tracking-wider">{article.brand}</p>
                          <p className="text-[9px] font-black text-emerald-600">{article.price}EUR</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAvatarImportModal && avatarImportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowAvatarImportModal(false); setAvatarImportData(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-wider">Importer un modele</h3>
              <button onClick={() => { setShowAvatarImportModal(false); setAvatarImportData(null); }} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="aspect-[3/4] max-h-64 mx-auto rounded-xl overflow-hidden border border-gray-200">
                <img src={avatarImportData.photoBase64} alt="Preview" className="w-full h-full object-cover" />
              </div>

              {/* Information sur l'analyse IA */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-purple-900 mb-1">Analyse IA automatique</p>
                  <p className="text-xs text-purple-700">
                    L'IA analysera cette image et générera automatiquement un prompt détaillé pour reproduire ce modèle à l'identique dans vos futures créations.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-700 mb-2 block">Nom du modele</label>
                <input
                  type="text"
                  value={avatarImportData.name}
                  onChange={e => setAvatarImportData(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Ex: Sophie, Model Paris..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={handleAvatarImportSave}
                disabled={!avatarImportData.name.trim()}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  avatarImportData.name.trim()
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Analyser et enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocationImportModal && locationImportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowLocationImportModal(false); setLocationImportData(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-sm font-black uppercase tracking-wider">Importer une scene</h3>
              <button onClick={() => { setShowLocationImportModal(false); setLocationImportData(null); }} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="aspect-[3/4] max-h-64 mx-auto rounded-xl overflow-hidden border border-gray-200">
                <img src={locationImportData.photoBase64} alt="Preview" className="w-full h-full object-cover" />
              </div>

              {/* Information sur l'analyse IA */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-purple-900 mb-1">Analyse IA automatique</p>
                  <p className="text-xs text-purple-700">
                    L'IA analysera cette image et générera automatiquement un prompt détaillé pour reproduire ce fond à l'identique dans vos futures créations.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-700 mb-2 block">Nom de la scene</label>
                <input
                  type="text"
                  value={locationImportData.name}
                  onChange={e => setLocationImportData(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Ex: Studio Paris, Plage tropicale..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={handleLocationImportSave}
                disabled={!locationImportData.name.trim()}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  locationImportData.name.trim()
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Analyser et enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarEditModal && avatarEditData && (
        <AvatarEditModal
          avatar={avatarEditData}
          onClose={() => {
            setShowAvatarEditModal(false);
            setAvatarEditData(null);
            setShowAvatarEditInfo(false);
          }}
          onSave={handleAvatarEditSave}
          isProcessing={state.isProcessing}
        />
      )}

      {showLocationEditModal && locationEditData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 lg:p-8"
          onClick={() => { setShowLocationEditModal(false); setShowLocationEditInfo(false); setLocationEditData(null); }}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                    Éditer le fond
                  </h2>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-gray-400">
                    Modifier les informations
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLocationEditInfo(!showLocationEditInfo)}
                    className={`p-2.5 rounded-xl transition-all ${
                      showLocationEditInfo
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                    }`}
                    title="Informations"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => { setShowLocationEditModal(false); setShowLocationEditInfo(false); setLocationEditData(null); }}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all text-gray-600 hover:text-gray-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Info Banner */}
              {showLocationEditInfo && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed text-blue-900">
                      <p className="font-bold mb-1.5">Prompt IA détaillé</p>
                      <p>
                        La description contient le prompt généré par l'IA pour reproduire ce fond. Vous pouvez le modifier selon vos besoins dans le champ "Prompt de génération" ci-dessous.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Preview Sidebar */}
              <div className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 border-r border-gray-200 p-4 overflow-y-auto">
                <div className="sticky top-0 space-y-3 w-full">
                  {locationEditData.photoBase64 && (
                    <>
                      <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-xl ring-1 ring-black/5">
                        <img
                          src={locationEditData.photoBase64}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs font-bold text-gray-900 truncate">{locationEditData.name || 'Sans nom'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Form Area */}
              <div className="flex-1 overflow-y-auto">
                {/* Form Fields */}
                <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8">

                  {/* Identity Section */}
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                      <span className="text-2xl">🎬</span>
                      <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                        Informations
                      </h3>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
                        Nom du fond
                      </label>
                      <input
                        type="text"
                        value={locationEditData.name}
                        onChange={e => setLocationEditData(prev => prev ? { ...prev, name: e.target.value } : null)}
                        placeholder="Ex: Studio Paris, Plage tropicale..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
                        Prompt de génération
                      </label>
                      <textarea
                        value={locationEditData.description}
                        onChange={e => setLocationEditData(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Ex: Studio lumineux avec fond blanc, ideal pour les photos produit..."
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                        rows={8}
                      />
                      <p className="mt-2 text-[10px] sm:text-xs text-gray-400">
                        Description détaillée utilisée pour générer ou reproduire ce fond
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleLocationEditSave}
                  disabled={!locationEditData.name.trim()}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[11px] sm:text-xs uppercase tracking-wide transition-all ${
                    locationEditData.name.trim()
                      ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {avatarEditData && (
        <NewVersionModal
          isOpen={showNewVersionModal}
          onClose={() => setShowNewVersionModal(false)}
          originalAvatar={avatarEditData}
          onConfirm={handleConfirmNewVersion}
        />
      )}

      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900">
                    Supprimer {deleteTarget.type === 'avatar' ? 'le modele' : 'la scene'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Etes-vous sur de vouloir supprimer "{deleteTarget.name}" ?
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cette action est irreversible.
                  </p>
                </div>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 px-4 bg-red-500 rounded-xl text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showPromptModal && selectedPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6"
          onClick={() => setShowPromptModal(false)}
        >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-t-xl sm:rounded-t-2xl flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <Info className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-black uppercase tracking-wide sm:tracking-wider truncate">Prompt de génération</h3>
                  <p className="text-xs sm:text-sm opacity-90 mt-0.5 truncate">{selectedPrompt.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors shrink-0"
                aria-label="Fermer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4">
                <p className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{selectedPrompt.prompt}</p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedPrompt.prompt);
                  const btn = document.activeElement as HTMLButtonElement;
                  const originalText = btn.innerHTML;
                  btn.innerHTML = '<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg><span>Copié !</span>';
                  setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                }}
                className="w-full py-2.5 sm:py-3 px-4 sm:px-6 bg-purple-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-bold uppercase tracking-wide sm:tracking-wider hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                Copier le prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-0 right-0 sm:top-4 sm:right-4 p-3 sm:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all backdrop-blur-sm z-10"
              title="Réduire"
            >
              <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs sm:text-sm font-medium">
              {enlargedImage.name} - Cliquez en dehors pour fermer
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
