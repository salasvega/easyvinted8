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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
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
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
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
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    console.log('Gemini response (background):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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

const handleSafetyError = (finishReason: string, safetyRatings?: any[]): Error => {
  console.error('Generation blocked - Safety ratings:', JSON.stringify(safetyRatings, null, 2));

  if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
    const blockedCategories = safetyRatings
      ?.filter(r => r.probability === 'HIGH' || r.probability === 'MEDIUM')
      .map(r => r.category)
      .join(', ');

    return new Error(
      `La génération a été bloquée par les filtres de sécurité Gemini (${finishReason}).\n\n` +
      `Catégories déclenchées: ${blockedCategories || 'Non spécifié'}\n\n` +
      `Solutions:\n` +
      `• Utilisez une photo de modèle avec plus de vêtements (débardeur + short)\n` +
      `• Essayez un cadrage différent (face caméra, bras le long du corps)\n` +
      `• Utilisez des images plus nettes et professionnelles\n` +
      `• Si vous essayez des maillots/lingerie, commencez par des vêtements couvrants\n\n` +
      `Note: Ces filtres sont appliqués par Google et échappent à notre contrôle.`
    );
  }

  if (finishReason === 'IMAGE_OTHER') {
    return new Error(
      `La génération a échoué pour des raisons techniques (${finishReason}).\n\n` +
      `Solutions:\n` +
      `• Vérifiez la qualité de vos images (résolution, netteté)\n` +
      `• Essayez de recompresser vos images\n` +
      `• Utilisez des images au format JPEG plutôt que PNG\n` +
      `• Réessayez dans quelques instants`
    );
  }

  return new Error(`La génération a été arrêtée: ${finishReason}. Essayez avec d'autres images ou paramètres.`);
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
        config: {
          safetySettings: [
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE',
            },
          ],
        },
      });

      console.log('Gemini response (product composition):', {
        hasCandidates: !!response.candidates,
        finishReason: response.candidates?.[0]?.finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings
      });

      const firstCandidate = response.candidates?.[0];
      if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
        throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
    ? `🎯 ULTRA-REALISTIC UGC FASHION PHOTO - VIRTUAL TRY-ON

YOU ARE CREATING: An authentic, natural photo that looks like a real person took a selfie or casual photo while wearing new clothes. This must be indistinguishable from a genuine photograph.

═══ STEP 1: ANALYZE THE PERSON (REFERENCE IMAGE #1) ═══

${hasReferencePhoto ? `CRITICAL: You have a REAL PERSON REFERENCE PHOTO (IMAGE #1-REF).
Study this person's EXACT physical characteristics:
- Precise face structure, features, expressions
- Exact body proportions, build, posture
- Accurate skin tone (match color precisely)
- Hair style, color, texture
- Height and body scale
- Any distinctive features

The generated person MUST be recognizable as this same individual.
` : ''}
From REFERENCE IMAGE #1 (avatar/model):
- Analyze the EXACT body proportions and scale
- Note the person's height, build, body type
- Observe their natural posture and stance
- Study skin tone, facial features, hair
- This person's appearance is LOCKED - reproduce exactly

${avatarDescription}

═══ STEP 2: ANALYZE THE CLOTHING (REFERENCE IMAGE #2) ═══

Study the garment carefully:
- What type of clothing is it? (t-shirt, dress, pants, etc.)
- What is its ACTUAL SIZE relative to a human body?
- Note fabric texture, weight, and how it drapes
- Observe colors, patterns, prints, logos
- Identify the garment's fit style (fitted, loose, oversized, etc.)

CRITICAL PROPORTION RULES:
- A t-shirt is roughly 60-70cm tall on an adult body
- Pants cover legs from waist to ankles
- A dress typically covers torso and extends down
- Sleeves should end at wrists (long) or shoulders (short)
- Collars sit at neck, waistbands at waist
- MAINTAIN REALISTIC HUMAN-TO-CLOTHING SCALE

═══ STEP 3: ANALYZE ENVIRONMENT ${hasBackground ? '(REFERENCE IMAGE #3)' : '(IF PROVIDED)'} ═══

${hasBackground ? `Study the background environment:
- What is the setting? (indoor, outdoor, street, home, etc.)
- Note lighting: direction, intensity, color temperature, time of day
- Observe depth, perspective, spatial relationships
- Study atmosphere, weather, ambient conditions
- Note any reflections, shadows, or lighting effects

${locationDescription}` : 'Use neutral, soft natural lighting with subtle depth of field'}

═══ STEP 4: COMPOSE THE ULTRA-REALISTIC PHOTO ═══

CREATE A SINGLE, SEAMLESS PHOTOGRAPH showing the person from IMAGE #1 wearing the garment from IMAGE #2${hasBackground ? ' in the environment from IMAGE #3' : ''}.

🎯 ABSOLUTE REALISM REQUIREMENTS:

PROPORTIONS & SCALE (CRITICAL):
- The person's body size MUST match IMAGE #1 exactly
- The garment MUST fit on the body at correct human scale
- A human head is roughly 20-25cm, body 160-180cm tall
- Clothing must drape and fit realistically for this body size
- No distorted proportions - arms, legs, torso must be anatomically correct
- The garment cannot be too large or too small - realistic fit only
- Maintain proper spatial relationships between person, clothes, and environment

BODY & APPEARANCE FIDELITY:
- Reproduce the EXACT person from IMAGE #1 (face, body, skin tone, hair)
- Body type, proportions, posture must be identical
- Skin tone must match precisely (no lightening or darkening)
- Facial features, expression, hair must be consistent
- Height and build must remain the same

GARMENT INTEGRATION:
- The clothing from IMAGE #2 sits ON the person at correct scale
- Fabric drapes naturally based on body shape and garment type
- Colors, patterns, textures match the original garment exactly
- Wrinkles, folds, and fabric behavior look realistic
- No extra clothing added - only the specified garment
- Garment sits at correct body locations (collar at neck, hem at proper length, etc.)

LIGHTING & ATMOSPHERE:
${hasBackground ? '- Match ALL lighting from IMAGE #3: direction, intensity, color, shadows' : '- Use soft, natural lighting like a casual photo'}
- Consistent light source across person, clothing, and environment
- Realistic shadows that match light direction
- Natural color temperature throughout the image
- Subtle ambient occlusion where clothing contacts body

UGC PHOTOGRAPHY STYLE:
- This looks like a REAL PHOTO taken with an iPhone or smartphone
- Natural, casual, authentic feeling - NOT studio professional
- Realistic focus with slight depth of field blur in background
- No artificial effects, filters, or over-processing
- Slight imperfections make it feel genuine (natural lighting variations, casual pose)
- Could be a selfie, mirror pic, or friend taking a casual photo
- Authentic, relatable, user-generated content aesthetic

COMPOSITION & FRAMING:
- Natural, casual framing (not perfectly centered like studio)
- Person positioned naturally within the scene
- Realistic perspective and camera angle (eye level or slightly above/below)
- Natural pose - relaxed, authentic, not overly posed
- Enough space to see the full garment on the person

═══ FINAL QUALITY VERIFICATION ═══

Before completing, verify:
  ✓ PROPORTIONS: Person and clothing are at correct realistic scale to each other
  ✓ PERSON: Matches IMAGE #1 exactly (face, body, skin tone, hair, build)
  ✓ GARMENT: Fits correctly on body, proper size, accurate colors/details
  ✓ ANATOMY: Body proportions are realistic (no distorted limbs, head, torso)
  ✓ SCALE: Clothing size makes sense for this person's body size
  ✓ LIGHTING: Consistent across person, clothes, and environment${hasBackground ? ' - matches IMAGE #3' : ''}
  ✓ REALISM: Looks like ONE real photograph, not a composite
  ✓ UGC STYLE: Authentic, casual, natural - could be posted on Instagram/TikTok
  ✓ NO ARTIFACTS: No blending issues, proportion errors, or obvious AI tells

FINAL INSTRUCTION: This must be indistinguishable from a real photograph of a real person wearing real clothes in a real place. Every viewer should believe this is authentic UGC content. Perfect proportions and natural realism are MANDATORY.`
    : `🎯 ULTRA-REALISTIC UGC LIFESTYLE PHOTO - MODEL IN ENVIRONMENT

YOU ARE CREATING: An authentic, natural photo that looks like a real person in a real place. This must be indistinguishable from a genuine photograph taken with a smartphone.

═══ STEP 1: ANALYZE THE PERSON (REFERENCE IMAGE #1) ═══

${hasReferencePhoto ? `CRITICAL: You have a REAL PERSON REFERENCE PHOTO (IMAGE #1-REF).
Study this person's EXACT physical characteristics:
- Precise face structure, features, expressions
- Exact body proportions, build, posture
- Accurate skin tone (match color precisely)
- Hair style, color, texture
- Height and body scale
- Any distinctive features
- Current clothing/outfit they're wearing

The generated person MUST be recognizable as this same individual.
` : ''}
From REFERENCE IMAGE #1 (avatar/model):
- Analyze the EXACT body proportions and scale
- Note the person's height, build, body type
- Observe their clothing, style, appearance
- Study skin tone, facial features, hair
- Note their posture and natural stance
- This person's complete appearance is LOCKED - reproduce exactly

${avatarDescription}

═══ STEP 2: ANALYZE THE ENVIRONMENT (REFERENCE IMAGE #2) ═══

Study the environment carefully:
- What is the setting? (indoor, outdoor, street, park, home, café, etc.)
- Note the SCALE of the space (small room, large outdoor area, etc.)
- Lighting: direction, intensity, color temperature, time of day
- Observe depth, perspective, spatial relationships
- Study atmosphere, weather, ambient conditions
- Note any objects, furniture, architectural elements
- Observe shadows, reflections, lighting quality

${locationDescription}

═══ STEP 3: COMPOSE THE ULTRA-REALISTIC PHOTO ═══

CREATE A SINGLE, SEAMLESS PHOTOGRAPH showing the person from IMAGE #1 naturally positioned in the environment from IMAGE #2.

🎯 ABSOLUTE REALISM REQUIREMENTS:

PROPORTIONS & SCALE (CRITICAL):
- The person's body size MUST match IMAGE #1 exactly
- The person must fit naturally in the environment at realistic human scale
- A human is typically 150-190cm tall - maintain this scale relative to surroundings
- Person should be appropriately sized relative to furniture, doors, trees, buildings
- No distorted proportions - body must be anatomically correct
- Spatial relationships between person and environment must make physical sense
- Person's distance from camera determines their size in frame

BODY & APPEARANCE FIDELITY:
- Reproduce the EXACT person from IMAGE #1 (face, body, skin tone, hair, outfit)
- Body type, proportions, posture must be identical
- Skin tone must match precisely (no lightening or darkening)
- Facial features, expression, hair must be consistent
- Clothing they're wearing in IMAGE #1 stays exactly the same
- Height and build must remain identical
- Any accessories, jewelry, or details are preserved

ENVIRONMENT INTEGRATION:
- Person is positioned naturally within the space
- They appear to genuinely BE in this location
- Lighting from IMAGE #2 illuminates the person naturally
- Person casts realistic shadows based on light direction
- Depth and perspective are correct (person at right distance from camera)
- Person interacts naturally with space (standing on ground, sitting on furniture, etc.)
- Scale matches - person isn't too big or small for the environment

LIGHTING & ATMOSPHERE:
- Match ALL lighting from IMAGE #2: direction, intensity, color, quality
- Consistent light source across person and environment
- Realistic shadows that match light direction and time of day
- Natural color temperature throughout the image
- Ambient lighting affects person the same way as the environment
- If outdoors, sun angle matches; if indoors, room lighting matches

UGC PHOTOGRAPHY STYLE:
- This looks like a REAL PHOTO taken with an iPhone or smartphone
- Natural, casual, authentic feeling - NOT studio professional
- Realistic focus with depth of field (slight background blur)
- No artificial effects, filters, or over-processing
- Slight imperfections make it feel genuine (natural lighting variations, casual composition)
- Could be a travel photo, lifestyle shot, or casual portrait
- Authentic, relatable, user-generated content aesthetic
- Normal smartphone photo quality and characteristics

COMPOSITION & FRAMING:
- Natural, casual framing (not perfectly centered like studio)
- Person positioned naturally within the scene (not awkwardly placed)
- Realistic perspective and camera angle (typical smartphone photo angle)
- Natural pose - relaxed, authentic, appropriate for the location
- Person scale and placement makes sense for the environment
- Camera distance from person feels natural (not too close or far)

═══ FINAL QUALITY VERIFICATION ═══

Before completing, verify:
  ✓ PROPORTIONS: Person is at correct realistic scale for the environment
  ✓ PERSON: Matches IMAGE #1 exactly (face, body, skin tone, hair, outfit)
  ✓ SCALE: Person's size makes sense relative to surroundings (doors, furniture, etc.)
  ✓ ANATOMY: Body proportions are realistic (no distorted limbs, head, torso)
  ✓ PLACEMENT: Person appears to genuinely be IN the space (not pasted on)
  ✓ LIGHTING: Consistent across person and environment - matches IMAGE #2
  ✓ SHADOWS: Person's shadows match the lighting direction and quality
  ✓ REALISM: Looks like ONE real photograph taken in one moment
  ✓ UGC STYLE: Authentic, casual, natural - could be posted on social media
  ✓ NO ARTIFACTS: No blending issues, proportion errors, or obvious compositing

FINAL INSTRUCTION: This must be indistinguishable from a real photograph of a real person in a real place. Every viewer should believe this person actually visited this location and someone took their photo. Perfect proportions, natural integration, and authentic UGC realism are MANDATORY.`;

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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    console.log('Gemini response (virtual try-on):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    console.log('Gemini response (text prompt):', {
      hasCandidates: !!response.candidates,
      finishReason: response.candidates?.[0]?.finishReason,
      safetyRatings: response.candidates?.[0]?.safetyRatings
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
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
      throw handleSafetyError(firstCandidate.finishReason, firstCandidate.safetyRatings);
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
