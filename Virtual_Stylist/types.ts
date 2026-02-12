
export type Gender = 'masculine' | 'feminine';
export type AgeGroup = 'baby' | 'child' | 'teen' | 'adult' | 'senior';
export type Origin = 'african' | 'east_asian' | 'south_asian' | 'caucasian' | 'hispanic' | 'middle_eastern';
export type SkinTone = 'porcelain' | 'golden_fair' | 'fair' | 'light' | 'medium' | 'medium_cool' | 'light_tan' | 'tan' | 'bronze_medium' | 'bronze_dark' | 'dark' | 'deep';
export type HairColor = 'platinum' | 'blonde' | 'honey' | 'ginger' | 'red' | 'auburn' | 'chestnut' | 'brown' | 'chocolate' | 'black' | 'grey' | 'plum';
export type HairCut = 'bald' | 'short' | 'medium' | 'long';
export type HairTexture = 'straight' | 'wavy' | 'curly' | 'coily';
export type EyeColor = 'blue' | 'green' | 'brown' | 'grey' | 'honey' | 'black';
export type Build = 'slim' | 'average' | 'athletic' | 'curvy';
export type RenderStyle = 'studio' | 'casual' | '3d_hyperrealistic';

export interface AvatarProfile {
  id?: string;
  name: string;
  gender: Gender;
  ageGroup: AgeGroup;
  origin: Origin;
  skinTone: SkinTone;
  hairColor: HairColor;
  hairCut: HairCut;
  hairTexture: HairTexture;
  eyeColor: EyeColor;
  build: Build;
  additionalFeatures: string;
  renderStyle: RenderStyle | null;
  modelSignature?: string;
  photoBase64?: string;
  referencePhotoBase64?: string;
  created_at?: string;
  parentAvatarId?: string;
  generationPrompt?: string;
}

export interface LocationProfile {
  id?: string;
  name: string;
  description: string;
  photoBase64: string;
  created_at?: string;
  generationPrompt?: string;
  referencePhotoBase64?: string;
}

export interface Preset {
  id?: string;
  name: string;
  avatarId: string;
  locationId: string | null;
  renderStyle: RenderStyle;
  created_at?: string;
}

export interface StylistPhoto {
  id?: string;
  name: string;
  photoBase64: string;
  avatarId?: string | null;
  locationId?: string | null;
  articleId?: string | null;
  created_at?: string;
}

export interface AppState {
  step: 'setup' | 'gallery' | 'backgrounds' | 'garment' | 'result' | 'photos';
  avatar: AvatarProfile;
  location: LocationProfile | null;
  renderStyle: RenderStyle | null;
  modelSignature: string;
  garmentBase64: string | null;
  generatedImageUrl: string | null;
  isProcessing: boolean;
  error: string | null;
  loadingMessage?: string;
}
