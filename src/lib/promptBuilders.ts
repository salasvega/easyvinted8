type AvatarProfile = {
  gender?: string | null;
  age_group?: string | null;
  ageGroup?: string | null;
  origin?: string | null;
  skin_tone?: string | null;
  skinTone?: string | null;
  hair_color?: string | null;
  hairColor?: string | null;
  hair_cut?: string | null;
  hairCut?: string | null;
  hair_texture?: string | null;
  hairTexture?: string | null;
  eye_color?: string | null;
  eyeColor?: string | null;
  build?: string | null;
  additional_features?: string | null;
  additionalFeatures?: string | null;
};

type LocationProfile = {
  name?: string;
  description?: string | null;
};

const PRIORITY_INDICATORS = {
  CRITICAL: '🔴 CRITICAL (must match perfectly)',
  IMPORTANT: '🟠 IMPORTANT (high priority)',
  SECONDARY: '🟡 SECONDARY (maintain if possible)',
  OPTIONAL: '🟢 OPTIONAL (bonus detail)'
} as const;

const genderMap: Record<string, string> = {
  feminine: 'woman',
  masculine: 'man'
};

const ageMap: Record<string, string> = {
  baby: '0-2 years old baby',
  child: '8-12 years old child',
  teen: '13-17 years old teenager',
  adult: '26-40 years old adult',
  senior: '60+ years old senior'
};

const originMap: Record<string, string> = {
  african: 'African descent',
  east_asian: 'East Asian descent',
  south_asian: 'South Asian descent',
  caucasian: 'Caucasian descent',
  hispanic: 'Hispanic descent',
  middle_eastern: 'Middle Eastern descent'
};

const buildMap: Record<string, string> = {
  slim: 'slim build with delicate proportions',
  athletic: 'athletic build with toned muscle definition',
  average: 'average build with natural proportions',
  curvy: 'curvy build with fuller figure'
};

const cutMap: Record<string, string> = {
  bald: 'completely bald',
  short: 'short cropped hair',
  medium: 'medium-length hair',
  long: 'long flowing hair'
};

const textureMap: Record<string, string> = {
  straight: 'straight and sleek',
  wavy: 'wavy with natural movement',
  curly: 'curly with defined ringlets',
  coily: 'coily with tight texture'
};

export const buildAvatarPromptFromProfile = (profile: AvatarProfile): string => {
  const criticalFeatures: string[] = [];
  const importantFeatures: string[] = [];
  const secondaryFeatures: string[] = [];
  const optionalFeatures: string[] = [];

  const gender = profile.gender || profile.gender;
  const ageGroup = profile.age_group || profile.ageGroup;
  const origin = profile.origin || profile.origin;
  const skinTone = profile.skin_tone || profile.skinTone;
  const hairColor = profile.hair_color || profile.hairColor;
  const hairCut = profile.hair_cut || profile.hairCut;
  const hairTexture = profile.hair_texture || profile.hairTexture;
  const eyeColor = profile.eye_color || profile.eyeColor;
  const build = profile.build || profile.build;
  const additionalFeatures = profile.additional_features || profile.additionalFeatures;

  if (gender) {
    criticalFeatures.push(`Gender: ${genderMap[gender] || 'person'}`);
  }

  if (build) {
    criticalFeatures.push(`Body Type/Silhouette: ${buildMap[build]} - THIS DIRECTLY AFFECTS GARMENT FIT AND DRAPING`);
  }

  if (skinTone) {
    criticalFeatures.push(`Skin Tone: ${skinTone.replace(/_/g, ' ')} - EXACT COLOR MATCH REQUIRED`);
  }

  if (ageGroup) {
    criticalFeatures.push(`Age: ${ageMap[ageGroup] || ageGroup}`);
  }

  if (origin) {
    importantFeatures.push(`Ethnic Background: ${originMap[origin] || origin}`);
  }

  if (hairColor && hairCut && hairTexture) {
    importantFeatures.push(`Hair: ${hairColor.replace(/_/g, ' ')} color, ${cutMap[hairCut] || hairCut}, ${textureMap[hairTexture] || hairTexture}`);
  } else {
    if (hairColor) importantFeatures.push(`Hair Color: ${hairColor.replace(/_/g, ' ')}`);
    if (hairCut) importantFeatures.push(`Hair Length: ${cutMap[hairCut] || hairCut}`);
    if (hairTexture) importantFeatures.push(`Hair Texture: ${textureMap[hairTexture] || hairTexture}`);
  }

  if (eyeColor) {
    secondaryFeatures.push(`Eye Color: ${eyeColor}`);
  }

  if (additionalFeatures) {
    optionalFeatures.push(`Additional Features: ${additionalFeatures}`);
  }

  let prompt = `AVATAR/MODEL REFERENCE - DETAILED CHARACTERISTICS:\n\n`;

  if (criticalFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.CRITICAL}\n`;
    prompt += criticalFeatures.map(f => `  • ${f}`).join('\n') + '\n\n';
  }

  if (importantFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.IMPORTANT}\n`;
    prompt += importantFeatures.map(f => `  • ${f}`).join('\n') + '\n\n';
  }

  if (secondaryFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.SECONDARY}\n`;
    prompt += secondaryFeatures.map(f => `  • ${f}`).join('\n') + '\n\n';
  }

  if (optionalFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.OPTIONAL}\n`;
    prompt += optionalFeatures.map(f => `  • ${f}`).join('\n') + '\n\n';
  }

  prompt += `VALIDATION REQUIREMENT:\n`;
  prompt += `Compare the generated person with the reference photo provided.\n`;
  prompt += `The model MUST match exactly in these aspects:\n`;
  prompt += `  ✓ Body type and proportions (affects how clothes fit)\n`;
  prompt += `  ✓ Skin tone accuracy (critical for realism)\n`;
  prompt += `  ✓ Overall physique and build\n`;
  prompt += `  ✓ Facial structure coherence\n`;
  prompt += `  ✓ Hair color and style consistency\n`;

  return prompt;
};

export const buildLocationPromptFromProfile = (location: LocationProfile): string => {
  const prompt = `ENVIRONMENT/LOCATION REFERENCE - DETAILED CHARACTERISTICS:

${PRIORITY_INDICATORS.CRITICAL}
  • Location Type: ${location.name || 'Neutral environment'}
  • Core Description: ${location.description || 'Authentic casual environment'}
  • LIGHTING SETUP: Analyze the reference photo for:
    - Light source direction (window left/right, overhead, diffuse)
    - Light intensity (soft/medium/bright)
    - Color temperature (warm 3000K / neutral 4000K / cool 5000K)
    - Shadow characteristics (hard/soft, direction, depth)

${PRIORITY_INDICATORS.IMPORTANT}
  • Surface Materials: Identify main surfaces visible (wall texture, floor type, furniture material)
  • Dominant Colors: Match the exact color palette of the environment
  • Spatial Depth: Maintain perspective and distance relationships
  • Background Elements: Include visible architectural elements (door frames, corners, baseboards)

${PRIORITY_INDICATORS.SECONDARY}
  • Ambient Details: Subtle imperfections that add realism (slight shadow variations, texture irregularities)
  • Atmosphere: Overall mood and feel (casual/formal, lived-in/pristine)

VALIDATION REQUIREMENT:
Compare the generated environment with the reference photo provided.
The setting MUST match exactly in terms of:
  ✓ Lighting conditions and tonality (most critical factor)
  ✓ Surface types and materials
  ✓ Color harmony and overall ambiance
  ✓ "Real home" authenticity (not studio-perfect)

CRITICAL: The environment should enhance the garment presentation while maintaining a natural, non-professional "iPhone photo" aesthetic.`;

  return prompt;
};
