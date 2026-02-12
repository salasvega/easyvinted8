import { GoogleGenAI, Type } from "@google/genai";
import { AvatarProfile, LocationProfile, RenderStyle } from '../types';

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is not configured");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
    }
    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error(`Image at ${url} is empty`);
    }

    if (blob.size > 10 * 1024 * 1024) {
      console.warn(`Image at ${url} is large (${(blob.size / 1024 / 1024).toFixed(2)}MB), this may cause issues`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw new Error(`Failed to load image from URL: ${url}`);
  }
};

const ensureBase64 = async (imageData: string): Promise<string> => {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return await urlToBase64(imageData);
  }
  return imageData;
};

const getMimeTypeFromBase64 = (base64Data: string): string => {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/^data:(image\/[a-z]+);base64,/);
    if (match) return match[1];
  }
  return 'image/png';
};

const PRIORITY_INDICATORS = {
  CRITICAL: '🔴 CRITICAL (MUST match exactly)',
  IMPORTANT: '🟠 IMPORTANT (high priority)',
  SECONDARY: '🟡 SECONDARY (maintain if possible)',
  OPTIONAL: '🟢 OPTIONAL (bonus detail)'
} as const;

export const buildAvatarPromptFromProfile = (profile: AvatarProfile): string => {
  const criticalFeatures: string[] = [];
  const importantFeatures: string[] = [];
  const secondaryFeatures: string[] = [];
  const optionalFeatures: string[] = [];

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

  if (profile.gender) {
    criticalFeatures.push(`Gender: ${genderMap[profile.gender] || 'person'}`);
  }

  if (profile.build) {
    criticalFeatures.push(`Body Type/Silhouette: ${buildMap[profile.build]} - THIS DIRECTLY AFFECTS GARMENT FIT AND DRAPING`);
  }

  if (profile.skinTone) {
    const skinToneDetailed = profile.skinTone.replace('_', ' ');
    criticalFeatures.push(`Skin Tone/Complexion: ${skinToneDetailed} - EXACT MATCH REQUIRED FOR REALISM`);
  }

  if (profile.ageGroup) {
    importantFeatures.push(`Age Appearance: ${ageMap[profile.ageGroup]}`);
  }

  if (profile.hairColor) {
    importantFeatures.push(`Hair Color: ${profile.hairColor}`);
  }

  if (profile.hairCut) {
    importantFeatures.push(`Hair Length/Style: ${cutMap[profile.hairCut]}`);
  }

  if (profile.origin) {
    secondaryFeatures.push(`Ethnic Background: ${originMap[profile.origin]} for facial structure coherence`);
  }

  if (profile.hairTexture && profile.hairCut !== 'bald') {
    secondaryFeatures.push(`Hair Texture: ${textureMap[profile.hairTexture]}`);
  }

  if (profile.eyeColor) {
    secondaryFeatures.push(`Eye Color: ${profile.eyeColor} (if visible in frame)`);
  }

  if (profile.additionalFeatures && profile.additionalFeatures.trim()) {
    optionalFeatures.push(`Distinctive Features: ${profile.additionalFeatures.trim()}`);
  }

  if (profile.modelSignature && profile.modelSignature.trim()) {
    optionalFeatures.push(`Special Characteristics: ${profile.modelSignature.trim()}`);
  }

  let prompt = `AVATAR/MODEL REFERENCE - HIERARCHICAL CHARACTERISTICS:\n\n`;

  if (criticalFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.CRITICAL}\n`;
    prompt += criticalFeatures.map(f => `  • ${f}`).join('\n');
    prompt += '\n\n';
  }

  if (importantFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.IMPORTANT}\n`;
    prompt += importantFeatures.map(f => `  • ${f}`).join('\n');
    prompt += '\n\n';
  }

  if (secondaryFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.SECONDARY}\n`;
    prompt += secondaryFeatures.map(f => `  • ${f}`).join('\n');
    prompt += '\n\n';
  }

  if (optionalFeatures.length > 0) {
    prompt += `${PRIORITY_INDICATORS.OPTIONAL}\n`;
    prompt += optionalFeatures.map(f => `  • ${f}`).join('\n');
    prompt += '\n\n';
  }

  prompt += `VALIDATION REQUIREMENT:\n`;
  prompt += `Compare the generated image with the reference photo provided.\n`;
  prompt += `The physical appearance MUST be identical, especially:\n`;
  prompt += `  ✓ Body type and proportions (affects how clothing fits)\n`;
  prompt += `  ✓ Skin tone (exact color match for photorealism)\n`;
  prompt += `  ✓ Facial structure coherence (even if partially obscured)\n`;
  prompt += `  ✓ Hair color and style consistency\n`;

  return prompt;
};

export const buildLocationPromptFromProfile = (location: LocationProfile): string => {
  const prompt = `ENVIRONMENT/LOCATION REFERENCE - DETAILED CHARACTERISTICS:

${PRIORITY_INDICATORS.CRITICAL}
  • Location Type: ${location.name}
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

export const generateBaseAvatar = async (
  profile: AvatarProfile,
  renderStyle?: RenderStyle,
  customPrompt?: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  let styleInstructions = "";
  if (renderStyle) {
    const styleMap: Record<string, string> = {
      studio: "Professional studio photography, high-end fashion shoot quality, controlled studio lighting with soft boxes and fill lights, crisp details, premium editorial quality, clean white or gradient background, flawless professional finish",
      casual: "Natural casual photography, soft natural lighting, relaxed and comfortable atmosphere, iPhone-style photo quality, authentic and approachable feel, lifestyle photography aesthetic",
      realistic_photo: "Ultra-realistic photograph, professional portrait photography, natural lighting, high resolution, photorealistic details",
      illustrated_modern: "Modern digital illustration, clean vector style, vibrant colors, contemporary fashion illustration aesthetic",
      cartoon_fun: "Playful cartoon style, fun and colorful, simplified features, cheerful expression, animated character design",
      fashion_sketch: "Fashion design sketch, elegant line art, watercolor touches, haute couture aesthetic, professional fashion illustration",
      minimalist: "Minimalist style, simple clean lines, neutral colors, elegant simplicity, modern minimalist portrait",
      '3d_hyperrealistic': "Hyperrealistic 3D render, studio lighting, perfect skin detail, professional CGI quality, ultra-high resolution, lifelike textures"
    };
    styleInstructions = styleMap[renderStyle] || styleMap.realistic_photo;
  } else {
    styleInstructions = "Ultra-realistic photograph, professional portrait photography, natural lighting";
  }

  const basePrompt = customPrompt || buildAvatarPromptFromProfile(profile);

  const prompt = `Generate a high-quality portrait of: ${basePrompt}

Style: ${styleInstructions}

Technical requirements:
- Full body or upper body portrait
- Neutral expression, looking at camera
- Plain background (solid color or simple gradient)
- Professional lighting
- High detail and clarity
- Fashion-appropriate pose

Important: Create a realistic, natural-looking person suitable for virtual fashion try-on demonstrations.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }],
      },
    });

    // Log de debug pour comprendre la structure de la réponse
    console.log('Gemini response structure:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length,
      firstCandidate: response.candidates?.[0],
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    // Vérifier si la génération a été bloquée pour des raisons de sécurité
    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`La génération a été arrêtée: ${firstCandidate.finishReason}. Essayez de simplifier votre description ou modifiez les caractéristiques.`);
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response. Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Avatar generation failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. La génération d'avatars nécessite un compte avec facturation activée sur Google Cloud."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error(
        "Clé API Gemini invalide ou manquante. Vérifiez VITE_GEMINI_API_KEY dans votre fichier .env"
      );
    }

    throw error;
  }
};

export const generateAvatarFromReferencePhoto = async (
  referencePhotoBase64: string,
  renderStyle?: RenderStyle,
  customInstructions?: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  let styleInstructions = "";
  if (renderStyle) {
    const styleMap: Record<string, string> = {
      studio: "Professional studio photography, high-end fashion shoot quality, controlled studio lighting with soft boxes and fill lights, crisp details, premium editorial quality, clean white or gradient background, flawless professional finish",
      casual: "Natural casual photography, soft natural lighting, relaxed and comfortable atmosphere, iPhone-style photo quality, authentic and approachable feel, lifestyle photography aesthetic",
      realistic_photo: "Ultra-realistic photograph, professional portrait photography, natural lighting, high resolution, photorealistic details",
      illustrated_modern: "Modern digital illustration, clean vector style, vibrant colors, contemporary fashion illustration aesthetic",
      cartoon_fun: "Playful cartoon style, fun and colorful, simplified features, cheerful expression, animated character design",
      fashion_sketch: "Fashion design sketch, elegant line art, watercolor touches, haute couture aesthetic, professional fashion illustration",
      minimalist: "Minimalist style, simple clean lines, neutral colors, elegant simplicity, modern minimalist portrait",
      '3d_hyperrealistic': "Hyperrealistic 3D render, studio lighting, perfect skin detail, professional CGI quality, ultra-high resolution, lifelike textures"
    };
    styleInstructions = styleMap[renderStyle] || styleMap.realistic_photo;
  } else {
    styleInstructions = "Ultra-realistic photograph, professional portrait photography, natural lighting";
  }

  const prompt = `🎯 CRITICAL MISSION: REPRODUCE THIS EXACT PERSON

REFERENCE PHOTO PROVIDED: Analyze the person in this photo carefully.

YOUR TASK:
Create a new portrait of this EXACT SAME PERSON with these requirements:

${PRIORITY_INDICATORS.CRITICAL} - PHYSICAL IDENTITY (MUST BE IDENTICAL)
  • Facial features: Reproduce the exact face shape, nose, eyes, mouth, cheekbones, jawline
  • Body type and build: Match the exact body proportions and silhouette
  • Skin tone: Use the EXACT skin tone from the reference photo
  • Overall appearance: This must be the SAME identifiable person

${PRIORITY_INDICATORS.IMPORTANT} - DISTINCTIVE FEATURES
  • Hair: Match color, length, texture, and style exactly
  • Eyes: Match exact eye color and shape
  • Unique characteristics: Include any tattoos, scars, beauty marks, or other distinctive features

${PRIORITY_INDICATORS.SECONDARY} - PRESENTATION
  • Pose: Full body or upper body portrait, neutral pose
  • Expression: Neutral, natural expression, looking at camera
  • Background: Plain background (solid color or simple gradient)
  • Lighting: Professional, flattering lighting

STYLE INSTRUCTIONS:
${styleInstructions}

${customInstructions ? `ADDITIONAL REQUIREMENTS:\n${customInstructions}\n\n` : ''}

✅ VALIDATION CHECKLIST:
  ✓ If someone who knows this person saw the generated image, would they recognize them? (CRITICAL)
  ✓ Does the face match exactly? (CRITICAL)
  ✓ Does the body type match exactly? (CRITICAL)
  ✓ Does the skin tone match exactly? (CRITICAL)
  ✓ Are all distinctive features included? (IMPORTANT)
  ✓ Is the style and lighting appropriate? (SECONDARY)

⚠️ CRITICAL: This person will be used for virtual fashion try-on. The physical accuracy is ESSENTIAL because clothing fit depends on body proportions, and customers need to recognize themselves or their intended model.`;

  const base64Image = referencePhotoBase64.startsWith('data:')
    ? referencePhotoBase64.split(',')[1]
    : referencePhotoBase64;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    });

    console.log('Gemini response (reference photo):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`La génération a été arrêtée: ${firstCandidate.finishReason}. Essayez avec une autre photo de référence.`);
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response (reference photo). Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Avatar generation from reference photo failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. La génération d'avatars nécessite un compte avec facturation activée sur Google Cloud."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error(
        "Clé API Gemini invalide ou manquante. Vérifiez VITE_GEMINI_API_KEY dans votre fichier .env"
      );
    }

    throw error;
  }
};

export const generateBackground = async (location: LocationProfile): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  // Utiliser le prompt optimisé si disponible, sinon la description de base
  const detailedDescription = location.generationPrompt || location.description || location.name;

  const prompt = `🎯 GENERATE THIS EXACT SCENE: ${location.name}

DETAILED DESCRIPTION (FOLLOW THIS PRECISELY):
${detailedDescription}

CRITICAL REQUIREMENTS:
✓ Generate EXACTLY what is described above - be faithful to every detail
✓ If a specific place is mentioned (beach, forest, studio, street, etc.), generate that exact type of environment
✓ If a specific time/lighting is mentioned (sunset, dawn, night, etc.), match that exact mood
✓ If specific colors/materials are mentioned (white walls, brick, wood, sand, etc.), include them prominently
✓ Match the atmosphere and style described (minimalist, rustic, urban, natural, etc.)

TECHNICAL SPECS:
- Photorealistic quality
- Natural lighting that fits the described environment
- High resolution and sharp details
- No people or mannequins in the scene
- Empty scene ready for fashion photography

IMPORTANT: Do NOT default to a generic studio/loft if something else is described. Create the EXACT environment requested.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }],
      },
    });

    console.log('Gemini response (background):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`La génération a été arrêtée: ${firstCandidate.finishReason}. Essayez de modifier votre description de lieu.`);
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response (background). Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Background generation failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. La génération de backgrounds nécessite un compte avec facturation activée."
      );
    }

    throw error;
  }
};

export const performVirtualTryOn = async (
  avatarBase64: string,
  clothingBase64: string,
  backgroundBase64?: string,
  avatarProfile?: AvatarProfile,
  locationProfile?: LocationProfile
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const hasAvatar = avatarBase64 && avatarBase64.trim() !== '';
  const hasClothing = clothingBase64 && clothingBase64.trim() !== '';
  const hasBackground = backgroundBase64 && backgroundBase64.trim() !== '';

  if (!hasAvatar && hasClothing && hasBackground) {
    const locationDescription = locationProfile
      ? buildLocationPromptFromProfile(locationProfile)
      : 'Authentic casual environment with natural lighting';

    const prompt = `═══ REFERENCE ENVIRONMENT (EXACT MATCH REQUIRED) ═══

${hasBackground ? `REFERENCE IMAGE #1: Environment/Location Photo
This image shows the EXACT environment where the garment should be placed.
${locationDescription}

` : ''}═══ PRODUCT TO INTEGRATE ═══

REFERENCE IMAGE #2: Clothing Item
This is the garment to naturally place into the environment above.

═══ GENERATION INSTRUCTIONS ═══

Create a hyper-realistic product photography showing the clothing item naturally integrated into the environment scene.

CRITICAL REALISM REQUIREMENTS:
- Analyze the clothing type and place it on the most appropriate support (hanger with visible rack/hook, professional mannequin, draped on furniture, laid flat on surface, etc.)
- The clothing MUST appear physically supported and gravity-compliant (no floating items!)
- Match ALL lighting conditions from the reference environment: direction, intensity, color temperature, shadows, highlights
- Perfectly harmonize textures, grain, and photographic style between clothing and environment
- Use realistic proportions and scale - the clothing should fit naturally in the space

PRESERVE CLOTHING AUTHENTICITY:
- Keep exact colors, patterns, and all visual details of the original garment
- Maintain fabric texture, wrinkles, folds, and material appearance
- Preserve any logos, prints, embroidery, or distinctive features
- Show realistic fabric draping based on material type

PHOTOGRAPHY STYLE:
- Natural iPhone-style photography aesthetic
- Realistic depth of field and focus
- No artificial or fake-looking effects
- Professional but authentic look
- Seamless integration - should look like a single photograph taken in one shot

TECHNICAL EXECUTION:
- Match color grading between clothing and environment
- Ensure consistent lighting angles and shadow directions
- Apply natural ambient occlusion where clothing contacts surfaces
- Add subtle reflections or color bounce from environment if appropriate
- The final result must be indistinguishable from a real photograph

═══ QUALITY CONTROL CHECKLIST ═══
Before finalizing, verify:
  ✓ Environment matches reference photo lighting exactly
  ✓ Garment appears physically supported (not floating)
  ✓ Lighting direction and shadows are consistent
  ✓ Color temperature matches throughout
  ✓ Result looks like a single authentic photograph

The goal is a perfectly believable, professional product photo where an expert cannot detect it's a composition. Think high-end e-commerce photography with natural styling.`;

    try {
      const clothingData = await ensureBase64(clothingBase64);
      const backgroundData = await ensureBase64(backgroundBase64);

      const clothingMimeType = getMimeTypeFromBase64(clothingData);
      const backgroundMimeType = getMimeTypeFromBase64(backgroundData);
      const clothingClean = clothingData.includes('base64,') ? clothingData.split('base64,')[1] : clothingData;
      const backgroundClean = backgroundData.includes('base64,') ? backgroundData.split('base64,')[1] : backgroundData;

      const parts: any[] = [
        { text: `REFERENCE IMAGE #1 - ENVIRONMENT/LOCATION (match this exactly):` },
        {
          inlineData: {
            mimeType: backgroundMimeType,
            data: backgroundClean,
          },
        },
        { text: `\nREFERENCE IMAGE #2 - CLOTHING ITEM (integrate this into the environment):` },
        {
          inlineData: {
            mimeType: clothingMimeType,
            data: clothingClean,
          },
        },
        { text: `\n\n${prompt}` }
      ];

      const response = await getAI().models.generateContent({
        model: model,
        contents: { parts },
      });

      console.log('Gemini response (product composition):', {
        hasCandidates: !!response.candidates,
        finishReason: response.candidates?.[0]?.finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings
      });

      const firstCandidate = response.candidates?.[0];
      if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
        console.error('Generation stopped with reason:', firstCandidate.finishReason);
        throw new Error(`La composition a été arrêtée: ${firstCandidate.finishReason}. Essayez avec d'autres images.`);
      }

      const responseParts = response.candidates?.[0]?.content?.parts;
      if (responseParts) {
        for (const part of responseParts) {
          if (part.inlineData && part.inlineData.data) {
            return part.inlineData.data;
          }
        }
      }

      console.error('No image data in response (product composition). Full response:', JSON.stringify(response, null, 2));
      throw new Error("No image data found in response");
    } catch (error: any) {
      console.error("Product composition failed:", error);
      if (
        error?.message?.includes("quota") ||
        error?.message?.includes("RESOURCE_EXHAUSTED")
      ) {
        throw new Error(
          "Quota Gemini dépassé. La composition nécessite un compte avec facturation activée."
        );
      }
      throw error;
    }
  }

  if (!hasAvatar) {
    throw new Error("Un modèle est requis pour l'essayage virtuel");
  }

  const hasReferencePhoto = !!(avatarProfile?.referencePhotoBase64);

  const avatarDescription = avatarProfile
    ? buildAvatarPromptFromProfile(avatarProfile)
    : 'Match the physical characteristics of the reference person exactly';

  const locationDescription = locationProfile && hasBackground
    ? buildLocationPromptFromProfile(locationProfile)
    : 'Neutral background appropriate for fashion photography';

  const prompt = hasClothing
    ? `═══ REFERENCE AVATAR/MODEL (EXACT MATCH REQUIRED) ═══

REFERENCE IMAGE #1: Model/Avatar Photo
This image shows the EXACT person who should wear the garment.

${hasReferencePhoto ? `⚠️ CRITICAL: A REFERENCE PHOTO IS PROVIDED (IMAGE #1-REF).
This is a REAL PERSON. You MUST reproduce this EXACT person's physical appearance:
- Facial features must be IDENTICAL (face shape, nose, eyes, mouth, cheekbones, jawline)
- Body type and proportions must MATCH EXACTLY (affects garment fit)
- Skin tone must be an EXACT color match
- Hair color, style, and texture must match
- All distinctive features must be preserved (tattoos, scars, beauty marks, etc.)

The person in the generated image must be RECOGNIZABLE as the same individual from the reference photo.
` : ''}
${avatarDescription}

${hasBackground ? `═══ REFERENCE ENVIRONMENT (EXACT MATCH REQUIRED) ═══

REFERENCE IMAGE #3: Environment/Location Photo
This shows the EXACT environment for the final composition.

${locationDescription}

` : ''}═══ GARMENT TO WEAR ═══

REFERENCE IMAGE #2: Clothing Item
This is the garment that the model should wear naturally.

═══ GENERATION INSTRUCTIONS ═══

Create a photorealistic image showing the person from REFERENCE IMAGE #1 wearing the clothing from REFERENCE IMAGE #2${hasBackground ? ' in the environment from REFERENCE IMAGE #3' : ''}.

ABSOLUTE REQUIREMENTS FOR MODEL FIDELITY:
- The person's physical appearance MUST be IDENTICAL to REFERENCE IMAGE #1
- Body type and proportions MUST match exactly (this affects garment fit)
- Skin tone MUST be an EXACT color match (critical for photorealism)
- Facial structure coherence maintained (even if partially obscured)
- Hair color, style, and texture matching
- Overall physique and build identical

GARMENT INTEGRATION:
- Place the clothing item naturally on the person
- Maintain realistic proportions and fit appropriate for the body type
- Keep the clothing item's colors, patterns, and details exactly as shown in REFERENCE IMAGE #2
- Ensure natural draping and wrinkles appropriate for the fabric and body shape
- The garment should fit the specific body type shown in the reference

LIGHTING & ATMOSPHERE:
- ${hasBackground ? 'Match lighting from REFERENCE IMAGE #3: direction, intensity, color temperature' : 'Use natural, soft lighting appropriate for casual fashion photography'}
- Ensure consistent shadow directions and ambient light
- Harmonize all elements to create a cohesive, believable photograph

PHOTOGRAPHY STYLE:
- Natural iPhone-style casual photography aesthetic
- Realistic depth of field and focus
- No artificial or over-processed effects
- Authentic, approachable feel
- Should look like a real photo taken by a real person

═══ QUALITY CONTROL CHECKLIST ═══
Before finalizing, verify:
  ✓ Model's body type matches REFERENCE IMAGE #1 exactly
  ✓ Skin tone is identical to reference (not lighter, not darker)
  ✓ Hair and facial features match
  ✓ Garment fits naturally on this specific body type
  ✓ Lighting is consistent across all elements${hasBackground ? '\n  ✓ Environment matches REFERENCE IMAGE #3' : ''}
  ✓ Result looks like a single authentic photograph

The result should look like a natural fashion photograph where this specific person is genuinely wearing this clothing item${hasBackground ? ' in this exact location' : ''}.`
    : `═══ REFERENCE AVATAR/MODEL (EXACT MATCH REQUIRED) ═══

REFERENCE IMAGE #1: Model/Avatar Photo
This image shows the EXACT person to place in the scene.

${hasReferencePhoto ? `⚠️ CRITICAL: A REFERENCE PHOTO IS PROVIDED (IMAGE #1-REF).
This is a REAL PERSON. You MUST reproduce this EXACT person's physical appearance:
- Facial features must be IDENTICAL (face shape, nose, eyes, mouth, cheekbones, jawline)
- Body type and proportions must MATCH EXACTLY
- Skin tone must be an EXACT color match
- Hair color, style, and texture must match
- All distinctive features must be preserved

The person in the generated image must be RECOGNIZABLE as the same individual from the reference photo.
` : ''}
${avatarDescription}

═══ REFERENCE ENVIRONMENT (EXACT MATCH REQUIRED) ═══

REFERENCE IMAGE #2: Environment/Location Photo
This shows the EXACT environment for composition.

${locationDescription}

═══ GENERATION INSTRUCTIONS ═══

Create a photorealistic image of the person from REFERENCE IMAGE #1 naturally placed in the environment from REFERENCE IMAGE #2.

ABSOLUTE REQUIREMENTS FOR MODEL FIDELITY:
- The person's physical appearance MUST be IDENTICAL to REFERENCE IMAGE #1
- Body type and proportions exactly matching
- Skin tone exact color match
- Facial structure, hair, and overall physique identical

ENVIRONMENT INTEGRATION:
- Place the person naturally in the background environment
- Match lighting from REFERENCE IMAGE #2: direction, intensity, shadows
- Ensure perspective and spatial relationships look realistic
- The person should fit naturally within the scene

PHOTOGRAPHY STYLE:
- Natural casual photography aesthetic
- Realistic depth of field and authentic look
- Should appear as a single photograph taken in one shot

═══ QUALITY CONTROL CHECKLIST ═══
Before finalizing, verify:
  ✓ Model matches REFERENCE IMAGE #1 exactly (body, skin tone, features)
  ✓ Environment matches REFERENCE IMAGE #2 (lighting, atmosphere)
  ✓ Lighting is consistent and believable
  ✓ Result looks like an authentic photograph

The result should look like a natural photograph taken in this location with this specific person.`;

  try {
    const avatarData = await ensureBase64(avatarBase64);
    const avatarMimeType = getMimeTypeFromBase64(avatarData);
    const avatarClean = avatarData.includes('base64,') ? avatarData.split('base64,')[1] : avatarData;

    const parts: any[] = [];

    if (hasReferencePhoto && avatarProfile?.referencePhotoBase64) {
      const refPhotoData = await ensureBase64(avatarProfile.referencePhotoBase64);
      const refPhotoMimeType = getMimeTypeFromBase64(refPhotoData);
      const refPhotoClean = refPhotoData.includes('base64,') ? refPhotoData.split('base64,')[1] : refPhotoData;

      parts.push({ text: `REFERENCE IMAGE #1-REF - REAL PERSON REFERENCE (this is the actual person to reproduce):` });
      parts.push({
        inlineData: {
          mimeType: refPhotoMimeType,
          data: refPhotoClean,
        },
      });
    }

    parts.push({ text: `REFERENCE IMAGE #1 - MODEL/AVATAR (match this person exactly):` });
    parts.push({
      inlineData: {
        mimeType: avatarMimeType,
        data: avatarClean,
      },
    });

    if (hasClothing) {
      const clothingData = await ensureBase64(clothingBase64);
      const clothingMimeType = getMimeTypeFromBase64(clothingData);
      const clothingClean = clothingData.includes('base64,') ? clothingData.split('base64,')[1] : clothingData;

      parts.push({ text: `\nREFERENCE IMAGE #2 - CLOTHING ITEM (the person should wear this):` });
      parts.push({
        inlineData: {
          mimeType: clothingMimeType,
          data: clothingClean,
        },
      });
    }

    if (hasBackground) {
      const backgroundData = await ensureBase64(backgroundBase64);
      const backgroundMimeType = getMimeTypeFromBase64(backgroundData);
      const backgroundClean = backgroundData.includes('base64,') ? backgroundData.split('base64,')[1] : backgroundData;

      parts.push({ text: `\nREFERENCE IMAGE #${hasClothing ? '3' : '2'} - ENVIRONMENT/LOCATION (match this setting exactly):` });
      parts.push({
        inlineData: {
          mimeType: backgroundMimeType,
          data: backgroundClean,
        },
      });
    }

    parts.push({ text: `\n\n${prompt}` });

    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts,
      },
    });

    console.log('Gemini response (virtual try-on):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`L'essayage virtuel a été arrêté: ${firstCandidate.finishReason}. Essayez avec d'autres images.`);
    }

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response (virtual try-on). Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Virtual try-on failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. L'essayage virtuel nécessite un compte avec facturation activée."
      );
    }

    throw error;
  }
};

export const analyzePhotoForAvatar = async (
  base64Image: string
): Promise<Partial<AvatarProfile>> => {
  const model = "gemini-2.5-flash";

  const prompt = `Analyze this photo of a person and extract their physical characteristics for creating a virtual avatar.

Identify:
1. Gender (female, male, non_binary)
2. Age group (baby, child, teen, young_adult, adult, middle_aged, senior)
3. Origin (african, east_asian, south_asian, caucasian, hispanic, middle_eastern)
4. Skin tone (very_fair, fair, light, medium, olive, tan, brown, dark_brown, deep)
5. Hair color (blonde, brown, black, red, gray, white, auburn, other)
6. Hair cut (short, medium, long, bald, buzz_cut, pixie, bob, shoulder_length, waist_length)
7. Hair texture (straight, wavy, curly, coily, kinky)
8. Eye color (blue, green, brown, hazel, gray, amber)
9. Build (slim, athletic, average, curvy, plus_size)

Provide accurate descriptions based on what you see in the photo.`;

  const imageData = await ensureBase64(base64Image);
  const cleanBase64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
  const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING },
            age_group: { type: Type.STRING },
            origin: { type: Type.STRING },
            skin_tone: { type: Type.STRING },
            hair_color: { type: Type.STRING },
            hair_cut: { type: Type.STRING },
            hair_texture: { type: Type.STRING },
            eye_color: { type: Type.STRING },
            build: { type: Type.STRING },
          },
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Photo analysis failed:", error);
    throw error;
  }
};

export const analyzePhotoForLocation = async (
  base64Image: string
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const prompt = `Analyze this photo of a location/background scene in extreme detail and create a comprehensive, structured prompt that could be used to regenerate this exact scene with AI image generation.

Your description must be extremely detailed and structured to capture ALL visual elements:

1. ENVIRONMENT TYPE & SETTING:
   - Indoor/outdoor classification
   - Specific location type (loft, beach, studio, street, park, etc.)
   - Time of day and lighting conditions
   - Weather conditions (if applicable)
   - Season indicators

2. LIGHTING & ATMOSPHERE:
   - Light sources (natural/artificial)
   - Light direction and quality (soft, harsh, diffused)
   - Shadow characteristics
   - Color temperature (warm/cool)
   - Atmospheric effects (fog, haze, sun rays, etc.)

3. SPATIAL CHARACTERISTICS:
   - Composition and framing
   - Depth of field
   - Perspective and viewing angle
   - Scale and proportions

4. VISUAL ELEMENTS:
   - Background elements (walls, sky, buildings, landscape)
   - Middle ground elements
   - Foreground elements
   - Architectural details
   - Natural elements (trees, water, mountains, etc.)

5. COLORS & TEXTURES:
   - Dominant color palette
   - Material textures (wood, concrete, fabric, metal, etc.)
   - Surface qualities (smooth, rough, glossy, matte)

6. STYLE & MOOD:
   - Overall aesthetic (minimalist, rustic, modern, vintage, etc.)
   - Emotional atmosphere
   - Photography/rendering style

Create a detailed, professional prompt in French that captures every important visual detail. The prompt should be precise enough that an AI could recreate this scene very accurately.

Return ONLY the optimized descriptive prompt text, nothing else. Write in French.`;

  const imageData = await ensureBase64(base64Image);
  const cleanBase64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
  const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    if (response.text) {
      return response.text.trim();
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Location photo analysis failed:", error);
    throw error;
  }
};

export const generateAvatarDescriptionFromPhoto = async (
  base64Image: string
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const prompt = `Analyze this photo of a person in extreme detail and create a comprehensive, structured prompt that could be used to regenerate this exact person/avatar with AI image generation.

Your description must be extremely detailed and structured to capture ALL physical and stylistic characteristics:

1. DEMOGRAPHIC & PHYSICAL CHARACTERISTICS:
   - Gender and age group (precise estimate)
   - Ethnic origin and skin tone (detailed description)
   - Overall build and body type
   - Height impression (tall, average, petite)

2. FACIAL FEATURES:
   - Face shape and structure
   - Eye characteristics (color, shape, size, expression)
   - Nose characteristics (shape, size)
   - Mouth and lips (shape, fullness)
   - Eyebrows (shape, thickness, color)
   - Facial structure (cheekbones, jawline, forehead)
   - Distinctive features (dimples, freckles, beauty marks, etc.)

3. HAIR:
   - Color (specific shade and highlights)
   - Cut and length (very precise)
   - Texture (straight, wavy, curly, coily)
   - Style (how it's worn, parting, etc.)
   - Volume and thickness

4. EXPRESSION & DEMEANOR:
   - Facial expression
   - Mood and energy conveyed
   - Posture and body language
   - Overall presence and character

5. STYLE & APPEARANCE:
   - Makeup style (if applicable, natural/elaborate)
   - Accessories visible (glasses, jewelry, etc.)
   - Clothing style visible
   - Overall aesthetic (elegant, casual, professional, artistic, etc.)

6. PHOTOGRAPHY & LIGHTING:
   - Lighting quality on the person
   - Camera angle and framing
   - Focus and depth of field
   - Overall photographic style

Create a detailed, professional prompt in French that captures every important physical and stylistic detail of this person. The prompt should be precise enough that an AI could recreate this person/avatar very accurately in future generations.

Return ONLY the optimized descriptive prompt text, nothing else. Write in French.`;

  const imageData = await ensureBase64(base64Image);
  const cleanBase64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
  const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    if (response.text) {
      return response.text.trim();
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Avatar photo analysis failed:", error);
    throw error;
  }
};

export const optimizeAvatarPromptFromText = async (
  userInput: string
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const prompt = `You are an expert at creating detailed prompts for AI image generation.

User input: "${userInput}"

Transform this into a detailed, optimized prompt for generating a realistic avatar/person portrait. Include:
- Physical characteristics (age, gender, ethnicity, build)
- Facial features (eyes, hair, skin tone)
- Style and presentation
- Photography/rendering style

Create a clear, detailed prompt that will generate a high-quality portrait suitable for virtual fashion try-on.

Return ONLY the optimized prompt text, nothing else.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || userInput;
  } catch (error: any) {
    console.error("Prompt optimization failed:", error);
    return userInput;
  }
};

export const optimizeLocationPromptFromText = async (
  userInput: string
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const prompt = `You are an expert at creating detailed prompts for AI background/environment image generation.

User input: "${userInput}"

Transform this into a detailed, optimized prompt for generating a realistic background/environment suitable for fashion photography. Include:
- Environment type and setting (indoor/outdoor, room type, location)
- Lighting characteristics (natural/artificial, soft/hard, direction, color temperature)
- Surface materials and textures (walls, floors, furniture)
- Color palette and atmosphere
- Spatial depth and perspective
- Key architectural or decorative elements
- Overall mood and authenticity (should feel like a real home/location, not a studio)

The background should enhance garment presentation while maintaining a natural, authentic "iPhone photo" aesthetic - not overly professional or studio-perfect.

Return ONLY the optimized prompt text, nothing else.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || userInput;
  } catch (error: any) {
    console.error("Location prompt optimization failed:", error);
    return userInput;
  }
};

export const generateAvatarFromTextPrompt = async (
  textPrompt: string,
  renderStyle?: RenderStyle
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const optimizedPrompt = await optimizeAvatarPromptFromText(textPrompt);

  let styleInstructions = "";
  if (renderStyle) {
    const styleMap: Record<string, string> = {
      studio: "Professional studio photography, high-end fashion shoot quality, controlled studio lighting with soft boxes and fill lights, crisp details, premium editorial quality, clean white or gradient background, flawless professional finish",
      casual: "Natural casual photography, soft natural lighting, relaxed and comfortable atmosphere, iPhone-style photo quality, authentic and approachable feel, lifestyle photography aesthetic",
      realistic_photo: "Ultra-realistic photograph, professional portrait photography, natural lighting, high resolution, photorealistic details",
      illustrated_modern: "Modern digital illustration, clean vector style, vibrant colors, contemporary fashion illustration aesthetic",
      cartoon_fun: "Playful cartoon style, fun and colorful, simplified features, cheerful expression, animated character design",
      fashion_sketch: "Fashion design sketch, elegant line art, watercolor touches, haute couture aesthetic, professional fashion illustration",
      minimalist: "Minimalist style, simple clean lines, neutral colors, elegant simplicity, modern minimalist portrait",
      '3d_hyperrealistic': "Hyperrealistic 3D render, studio lighting, perfect skin detail, professional CGI quality, ultra-high resolution, lifelike textures"
    };
    styleInstructions = styleMap[renderStyle] || styleMap.realistic_photo;
  } else {
    styleInstructions = "Ultra-realistic photograph, professional portrait photography, natural lighting";
  }

  const fullPrompt = `${optimizedPrompt}

Style: ${styleInstructions}

Technical requirements:
- Full body or upper body portrait
- Neutral expression, looking at camera
- Plain background (solid color or simple gradient)
- Professional lighting
- High detail and clarity
- Fashion-appropriate pose`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [{ text: fullPrompt }],
      },
    });

    console.log('Gemini response (text prompt):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`La génération a été arrêtée: ${firstCandidate.finishReason}. Essayez de modifier votre description.`);
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response (text prompt). Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Avatar generation from text failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. La génération d'avatars nécessite un compte avec facturation activée."
      );
    }

    throw error;
  }
};

export const enhanceImportedPhoto = async (
  base64Image: string,
  renderStyle?: RenderStyle | null,
  modelSignature?: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  let styleInstructions = "Enhance this photo while maintaining a natural, realistic look";
  let technicalRequirements = "";

  if (renderStyle) {
    const styleMap: Record<string, { style: string; technical: string }> = {
      studio: {
        style: "Professional studio photography with high-end fashion shoot quality",
        technical: `- Apply controlled studio lighting with soft boxes and fill lights
- Create crisp, sharp details throughout
- Use clean white or subtle gradient background
- Achieve premium editorial quality with flawless finish
- Apply professional color grading for magazine-quality look
- Enhance clarity and sharpness for maximum detail
- Maintain perfect exposure and white balance`
      },
      casual: {
        style: "Natural casual photography with soft, comfortable atmosphere",
        technical: `- Use soft, natural lighting that feels authentic
- Apply iPhone-style photo quality with lifestyle aesthetic
- Create relaxed, approachable atmosphere
- Maintain natural colors with subtle warmth
- Keep authentic feel without over-processing
- Use simple, uncluttered background
- Preserve candid, comfortable expression`
      },
      realistic_photo: {
        style: "Ultra-realistic photograph with professional portrait photography quality",
        technical: `- Use natural, soft lighting that enhances facial features
- Apply subtle color grading for a warm, natural look
- Maintain photorealistic skin texture with natural imperfections
- Create a shallow depth of field with subject in sharp focus
- Use professional photography techniques (proper exposure, white balance)
- Preserve authentic human characteristics and expressions
- Avoid over-smoothing or artificial enhancement`
      },
      illustrated_modern: {
        style: "Modern digital illustration with clean vector aesthetic",
        technical: `- Convert to clean, vibrant illustration style
- Use bold, saturated colors with clear outlines
- Simplify features while maintaining recognizability
- Apply contemporary fashion illustration techniques
- Create smooth, polished surfaces`
      },
      cartoon_fun: {
        style: "Playful cartoon style with cheerful, animated character design",
        technical: `- Transform into fun, colorful cartoon character
- Simplify and exaggerate features for charm
- Use bright, cheerful color palette
- Add playful expressions and energy
- Create animated character aesthetic`
      },
      fashion_sketch: {
        style: "Elegant fashion design sketch with haute couture aesthetic",
        technical: `- Convert to fashion illustration style
- Use elegant line art with watercolor touches
- Apply artistic, hand-drawn quality
- Emphasize fashion-forward presentation
- Create sophisticated, editorial look`
      },
      minimalist: {
        style: "Minimalist style with simple, elegant simplicity",
        technical: `- Strip down to essential elements
- Use clean lines and neutral color palette
- Create elegant, modern minimalist portrait
- Focus on form and simplicity
- Reduce visual complexity`
      },
      '3d_hyperrealistic': {
        style: "Hyperrealistic 3D render with professional CGI quality",
        technical: `- Create ultra-realistic 3D rendered appearance
- Apply studio-quality lighting setup (key, fill, rim lights)
- Achieve perfect skin detail and subsurface scattering
- Use high-resolution textures and materials
- Render with professional CGI quality
- Maintain lifelike proportions and features`
      }
    };

    const selectedStyle = styleMap[renderStyle] || styleMap.realistic_photo;
    styleInstructions = `Transform this photo using the following style: ${selectedStyle.style}`;
    technicalRequirements = selectedStyle.technical;
  }

  const signatureBlock = modelSignature && modelSignature.trim()
    ? `\n\nCRITICAL: Apply these specific characteristics and details to the portrait:
${modelSignature}

These details are ESSENTIAL and must be clearly visible in the final result.`
    : '';

  const prompt = `${styleInstructions}

STYLE-SPECIFIC TECHNICAL REQUIREMENTS:
${technicalRequirements}

GENERAL REQUIREMENTS:
- Remove or replace background with a clean, neutral backdrop (solid color or subtle gradient)
- Enhance overall image quality and clarity
- Keep the person's natural features, proportions, and identity
- Ensure proper lighting that complements the chosen style
- Create a professional portrait optimized for fashion photography and virtual try-on
- Maintain natural pose and expression${signatureBlock}

IMPORTANT: The final portrait must be clean, high-quality, and suitable for virtual fashion styling with a neutral background that doesn't distract from the subject.`;

  const imageData = await ensureBase64(base64Image);
  const cleanBase64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
  const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    console.log('Gemini response (photo enhancement):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      console.error('Generation stopped with reason:', firstCandidate.finishReason);
      throw new Error(`L'amélioration a été arrêtée: ${firstCandidate.finishReason}. Essayez avec une autre photo.`);
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    console.error('No image data in response (photo enhancement). Full response:', JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Photo enhancement failed:", error);

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "Quota Gemini dépassé. L'amélioration de photos nécessite un compte avec facturation activée."
      );
    }

    throw error;
  }
};
