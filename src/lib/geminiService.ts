// src/lib/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";

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

// ✅ Shared constraint vocabulary (re-used across image features)
const HUMAN_IPHONE_CONSTRAINTS =
  "Output must look like an ordinary iPhone photo taken by a real person: natural ambient light, slightly imperfect framing, faithful colors, mild sensor grain, no studio look, no editorial styling, no seamless/gradient background, no HDR/glow, no over-sharpening, no AI-smoothed/plastic textures, no obvious AI artifacts. Keep it believable.";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** ---------------------------------------------------------
 * ✅ SAFETY + DIAGNOSTICS (prod-friendly, stable UX)
 * -------------------------------------------------------- */
const SAFETY_SETTINGS_PROD = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
] as const;

type GeminiFinishReason =
  | "STOP"
  | "SAFETY"
  | "IMAGE_SAFETY"
  | "IMAGE_OTHER"
  | "RECITATION"
  | "OTHER"
  | string;

function extractMeta(response: any) {
  const c = response?.candidates?.[0];
  return {
    hasCandidates: !!response?.candidates?.length,
    finishReason: (c?.finishReason as GeminiFinishReason) ?? undefined,
    // may be undefined for image models; that's okay
    safetyRatings: c?.safetyRatings,
    promptFeedback: response?.promptFeedback,
  };
}

function finishReasonToCode(fr?: GeminiFinishReason) {
  if (!fr || fr === "STOP") return null;
  if (fr === "SAFETY" || fr === "IMAGE_SAFETY") return "GEMINI_BLOCKED_SAFETY";
  if (fr === "IMAGE_OTHER") return "GEMINI_IMAGE_OTHER";
  return "GEMINI_" + fr;
}

function normalizeBase64Data(data: string): string {
  // accepts raw base64 or data:*;base64,xxx
  if (!data) return data;
  const idx = data.indexOf("base64,");
  return idx >= 0 ? data.slice(idx + "base64,".length) : data;
}

function normalizeMimeType(mimeType: string): string {
  // Keep as-is; if you want extra stability you can force "image/jpeg"
  return mimeType || "image/jpeg";
}

function buildUserError(code: string) {
  switch (code) {
    case "GEMINI_BLOCKED_SAFETY":
      return new Error(
        "La génération a été bloquée par les filtres de sécurité. " +
          "Essayez une photo plus neutre (cadrage plus large, pose face caméra, fond simple) ou un vêtement plus couvrant."
      );
    case "GEMINI_IMAGE_OTHER":
      return new Error(
        "La génération d’image a échoué pour une raison technique (IMAGE_OTHER). " +
          "Essayez une image plus nette, un cadrage moins serré (éviter gros plans), ou réessayez."
      );
    default:
      return new Error("Impossible de générer l’image pour le moment.");
  }
}

/** ---------------------------------------------------------
 * ✅ Image-call wrapper with meta checks + consistent errors
 * -------------------------------------------------------- */
async function generateImageWithMeta(args: {
  model: string;
  parts: any[];
  label: string;
}) {
  const response = await getAI().models.generateContent({
    model: args.model,
    contents: { parts: args.parts },
    config: {
      safetySettings: SAFETY_SETTINGS_PROD,
    },
  });

  const meta = extractMeta(response);
  console.error("[Gemini " + args.label + "] meta:", meta);

  const code = finishReasonToCode(meta.finishReason);
  if (code) throw new Error(code);

  // extract base64 image
  const outParts = response.candidates?.[0]?.content?.parts;
  if (outParts) {
    for (const part of outParts) {
      if (part.inlineData?.data) return part.inlineData.data as string;
    }
  }

  // no image even though STOP -> treat as technical
  throw new Error("GEMINI_IMAGE_OTHER");
}

export interface ProductData {
  title: string;
  description: string;
  features: string[];
  category?: string;
  priceEstimate?: string;
  brand?: string;
  size?: string;
  color?: string;
  material?: string;
  condition?: string;
  gender?: string;
  season?: string;
  suggestedPeriod?: string;
  marketing?: {
    instagramCaption: string;
    hashtags: string[];
    salesEmail: string;
    seoKeywords: string[];
  };
}

export const analyzeProductImage = async (
  base64Image: string,
  mimeType: string,
  writingStyle?: string
): Promise<ProductData[]> => {
  const model = "gemini-2.5-flash";

  const writingStyleInstruction = writingStyle
    ? "\n    WRITING STYLE: When generating the title and description, use this specific writing style:\n    " + writingStyle + "\n    "
    : "";

  const prompt = `
    You are an expert fashion analyst for a second-hand clothing marketplace (Vinted).
    Analyze this product image in detail and extract ALL visible information.

    IMPORTANT: Look carefully at any visible tags, labels, or etiquettes on the item to extract brand and size information.
${writingStyleInstruction}
    Identify ALL distinct fashion or accessory products visible in the image.
    If there is only one product, return a single entry.

    For EACH detected product, extract the following information:

    1. BASIC INFO:
       - title: A catchy, descriptive title in French (e.g., "Robe d'été fleurie Zara")
       - description: Detailed description in French highlighting condition, style, and key features (2-3 sentences)${
         writingStyle
           ? " - IMPORTANT: Use the writing style provided above for the description"
           : ""
       }
       - features: 5 key features or selling points in French

    2. BRAND & SIZE:
       - brand: The brand name if visible on tags/labels/logos (if not visible, return null)
       - size: The size if visible on tags/labels (e.g., "M", "38", "42", "S", "XL", etc. - if not visible, return null)

    3. PHYSICAL ATTRIBUTES:
       - color: The main color in French (e.g., "Bleu", "Rouge", "Noir", "Beige", "Multicolore", etc.)
       - material: The fabric/material if identifiable (e.g., "Coton", "Polyester", "Laine", "Jean", "Cuir", "Soie", etc. - if uncertain, return null)

    4. CONDITION:
       - condition: Assess the visible condition. Return ONE of these exact values:
         * "new_with_tags" - if tags are still attached
         * "new_without_tags" - if looks new but no tags
         * "very_good" - excellent condition, minimal wear
         * "good" - good condition, light wear
         * "satisfactory" - acceptable condition, visible wear

    5. TARGET AUDIENCE & CATEGORIZATION:
       - gender: ANALYZE CAREFULLY all visible details to determine target audience. Return ONE of these exact values:
         * "Femmes" - for ADULT women's clothing/accessories
         * "Hommes" - for ADULT men's clothing/accessories
         * "Enfants" - for CHILDREN's items
         * "Mixte" - ONLY if truly unisex adult item with no gender indicators
         * IMPORTANT: Do NOT default to "Femmes" - analyze objectively.

    6. SEASONALITY:
       - season: Return ONE of these exact values based on the item type:
         * "spring"
         * "summer"
         * "autumn"
         * "winter"
         * "all-seasons"
       - suggestedPeriod: The best months to sell this item in French (e.g., "Mars - Mai", "Juin - Août", "Toute l'année")

    7. PRICING:
       - priceEstimate: Estimated resale price in euros (format: "XX €" - consider condition and brand)

    8. CATEGORY:
       - category: The type of item in French (e.g., "Robe", "T-shirt", "Jean", "Basket", "Sac", "Manteau", etc.)

    9. MARKETING (optional):
       - instagramCaption: Caption with emojis
       - hashtags: 10 relevant hashtags
       - salesEmail: Short email draft
       - seoKeywords: 5 SEO keywords

    CRITICAL: Pay special attention to any visible labels, tags, or etiquettes to extract brand and size information accurately.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizeMimeType(mimeType),
              data: normalizeBase64Data(base64Image),
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
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  features: { type: Type.ARRAY, items: { type: Type.STRING } },
                  category: { type: Type.STRING },
                  priceEstimate: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  size: { type: Type.STRING },
                  color: { type: Type.STRING },
                  material: { type: Type.STRING },
                  condition: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  season: { type: Type.STRING },
                  suggestedPeriod: { type: Type.STRING },
                  marketing: {
                    type: Type.OBJECT,
                    properties: {
                      instagramCaption: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      salesEmail: { type: Type.STRING },
                      seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                  },
                },
                required: ["title", "description", "features"],
              },
            },
          },
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed.products || [];
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Analysis failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Quota Gemini dépassé pour l'analyse. Veuillez réessayer plus tard ou activer la facturation sur Google Cloud."
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

export const editProductImage = async (
  base64Image: string,
  mimeType: string,
  instruction: string,
  referenceImages?: { data: string; description: string }[]
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const enhancedInstruction = instruction + "\n" + HUMAN_IPHONE_CONSTRAINTS + "\nPreserve product details perfectly (logos/text/labels), keep product as focal point, no distortions.";

  try {
    const parts: any[] = [
      {
        inlineData: {
          mimeType: normalizeMimeType(mimeType),
          data: normalizeBase64Data(base64Image),
        },
      },
    ];

    if (referenceImages && referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        parts.push({ text: refImage.description });
        parts.push({
          inlineData: {
            // NOTE: ideally pass true mimeType per ref; keeping png for compatibility
            mimeType: "image/png",
            data: normalizeBase64Data(refImage.data),
          },
        });
      }
    }

    parts.push({ text: enhancedInstruction });

    return await generateImageWithMeta({
      model,
      parts,
      label: "editProductImage",
    });
  } catch (error: any) {
    console.error("Editing failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Quota Gemini dépassé. L'édition d'images nécessite un compte avec facturation activée sur Google Cloud. Consultez GEMINI_SETUP.md pour plus d'informations."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error(
        "Clé API Gemini invalide ou manquante. Vérifiez votre .env (VITE_GEMINI_API_KEY)."
      );
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw error;
  }
};

async function convertImageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image URL to base64:", error);
    throw error;
  }
}

export interface Suggestion {
  field:
    | "title"
    | "description"
    | "price"
    | "brand"
    | "size"
    | "color"
    | "material"
    | "condition";
  currentValue: string | number;
  suggestedValue: string | number;
  reason: string;
}

export const parseSuggestionValue = (
  field: string,
  value: string | number
): string | number => {
  if (field === "price") {
    const stringValue = String(value);
    const numericValue = parseFloat(
      stringValue.replace(/[^0-9.,]/g, "").replace(",", ".")
    );
    return isNaN(numericValue) ? "" : numericValue.toString();
  }
  return value;
};

export interface CoachAdvice {
  generalAdvice: string;
  suggestions: Suggestion[];
}

export const getListingCoachAdvice = async (
  article: any,
  activePhoto?: string
): Promise<string> => {
  const model = "gemini-2.5-flash";
  const photoPrompt = activePhoto ? "\n\nPhoto attached for visual analysis." : "";

  const prompt = `You are an expert Vinted sales coach. Analyze this listing and provide actionable advice to improve it and sell faster.

**LISTING DATA:**
- Title: ${article.title || "Not set"}
- Description: ${article.description || "Not set"}
- Brand: ${article.brand || "Not set"}
- Price: ${article.price ? article.price + "€" : "Not set"}
- Size: ${article.size || "Not set"}
- Condition: ${article.condition || "Not set"}
- Color: ${article.color || "Not set"}
- Material: ${article.material || "Not set"}
- Photos: ${article.photos?.length || 0} photos${photoPrompt}

**YOUR TASK:**
Provide personalized, actionable advice to improve this listing. Focus on:
1. Title Quality
2. Description
3. Pricing Strategy
4. Photo Quality
5. Missing Information
6. Quick Wins

Format your response in French with clear sections using **bold headers** for readability. Be specific and encouraging.`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (activePhoto) {
      let base64Data: string;

      if (activePhoto.startsWith("http://") || activePhoto.startsWith("https://")) {
        base64Data = await convertImageUrlToBase64(activePhoto);
      } else if (activePhoto.startsWith("data:")) {
        base64Data = activePhoto.split(",")[1];
      } else {
        base64Data = activePhoto;
      }

      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: normalizeBase64Data(base64Data),
        },
      });
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: { parts },
    });

    return response.text || "Désolé, je n'ai pas pu analyser votre annonce pour le moment.";
  } catch (error: any) {
    console.error("Listing coach analysis failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw new Error("Impossible d'analyser l'annonce pour le moment.");
  }
};

export const getStructuredCoachAdvice = async (
  article: any,
  activePhoto?: string
): Promise<CoachAdvice> => {
  const model = "gemini-2.5-flash";
  const photoPrompt = activePhoto ? "\n\nPhoto attached for visual analysis." : "";

  const prompt = `Tu es KELLY, une coach de vente EXPERTE sur Vinted avec 8 ans d'experience et plus de 50 000 ventes reussies.
Tu connais PARFAITEMENT l'algorithme Vinted et les meilleures pratiques SEO marketplace.

**DONNÉES DE L'ANNONCE:**
- Titre: ${article.title || "Non défini"}
- Description: ${article.description || "Non définie"}
- Marque: ${article.brand || "Non définie"}
- Prix: ${article.price ? article.price + "€" : "Non défini"}
- Taille: ${article.size || "Non définie"}
- État: ${article.condition || "Non défini"}
- Couleur: ${article.color || "Non défini"}
- Matière: ${article.material || "Non défini"}
- Photos: ${article.photos?.length || 0} photo(s)${photoPrompt}

**TA MISSION:**
1. Donner un conseil général encourageant et personnalisé
2. Proposer des suggestions CONCRÈTES

IMPORTANT:
- Sois SÉLECTIVE
- Utilise un ton chaleureux et motivant
- Réponds TOUJOURS en français`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (activePhoto) {
      let base64Data: string;

      if (activePhoto.startsWith("http://") || activePhoto.startsWith("https://")) {
        base64Data = await convertImageUrlToBase64(activePhoto);
      } else if (activePhoto.startsWith("data:")) {
        base64Data = activePhoto.split(",")[1];
      } else {
        base64Data = activePhoto;
      }

      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: normalizeBase64Data(base64Data),
        },
      });
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalAdvice: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  field: { type: Type.STRING },
                  currentValue: { type: Type.STRING },
                  suggestedValue: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["field", "currentValue", "suggestedValue", "reason"],
              },
            },
          },
          required: ["generalAdvice", "suggestions"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed;
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Structured coach analysis failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw new Error("Impossible d'analyser l'annonce pour le moment.");
  }
};

export interface DefectAnalysis {
  overallConditionScore: number;
  defects: {
    type: string;
    severity: "minor" | "moderate" | "severe";
    location: string;
    description: string;
    impactOnPrice: number;
  }[];
  recommendations: string[];
  suggestedDisclosure: string;
  estimatedCondition: string;
}

export const analyzeDefects = async (
  base64Image: string,
  mimeType: string
): Promise<DefectAnalysis> => {
  const model = "gemini-2.5-flash";

  const prompt = `Tu es un expert en inspection de vetements d'occasion pour la revente sur Vinted.
Analyse cette photo de vetement et detecte TOUS les defauts visibles avec precision.

TYPES DE DEFAUTS A DETECTER:
- Taches (huile, vin, encre, transpiration, moisissure...)
- Trous (accrocs, dechirures, usure...)
- Bouloches (pilling sur laine, coton, polyester...)
- Decoloration (delavage, jaunissement, blanchiment...)
- Usure (col use, manches usees, ourlet defait...)
- Coutures (fils tires, coutures defaites, boutons manquants...)
- Odeurs potentielles (traces de transpiration, moisissure visible...)
- Elastiques (etires, detendus...)

Pour chaque defaut detecte, indique:
- type
- severity: "minor" | "moderate" | "severe"
- location
- description
- impactOnPrice (en % négatif)

Fournis aussi:
- overallConditionScore (1 à 10)
- recommendations (max 3)
- suggestedDisclosure
- estimatedCondition: "new_with_tags" | "new_without_tags" | "very_good" | "good" | "satisfactory"

Si aucun defaut n'est visible, retourne defects=[] et score=10.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizeMimeType(mimeType),
              data: normalizeBase64Data(base64Image),
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
            overallConditionScore: { type: Type.NUMBER },
            defects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  location: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impactOnPrice: { type: Type.NUMBER },
                },
                required: ["type", "severity", "location", "description", "impactOnPrice"],
              },
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedDisclosure: { type: Type.STRING },
            estimatedCondition: { type: Type.STRING },
          },
          required: [
            "overallConditionScore",
            "defects",
            "recommendations",
            "suggestedDisclosure",
            "estimatedCondition",
          ],
        },
      },
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Defect analysis failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini depasse. Veuillez reessayer plus tard.");
    }

    throw new Error("Impossible d'analyser les defauts pour le moment.");
  }
};

export const generateVirtualTryOn = async (
  base64Image: string,
  mimeType: string,
  gender: "female" | "male" | "neutral" = "female"
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const genderSubjects = {
    female: "a real adult woman (everyday body, not a model)",
    male: "a real adult man (everyday body, not a model)",
    neutral: "a real adult person (everyday body, not a model)",
  } as const;

  const contexts = [
    "mirror selfie in a hallway near a door, casual posture, slightly off-center framing",
    "standing near a plain door or wardrobe in a bedroom, face out of frame, relaxed posture",
    "simple room background (bedroom/living room), crop from neck down, natural window light",
    "mirror selfie in a corridor/entryway, phone covering the face, slightly tilted horizon",
  ] as const;

  const chosenContext = pickRandom([...contexts]);

  const basePrompt = `
Transform this product photo into a REALISTIC casual iPhone photo showing the clothing item worn by ${genderSubjects[gender]}.

ABSOLUTE PRIORITY:
- Keep the EXACT SAME clothing item. Preserve ALL details perfectly (logos, labels, stitching, textures, patterns, colors).

SCENE / CONTEXT:
- ${chosenContext}

STYLE:
- Casual UGC iPhone photo (realistic, imperfect framing), natural ambient light.
- Never show an identifiable face: crop from neck down OR phone covering face.

BACKGROUND:
- Real everyday indoor background (door/wardrobe/plain wall), not studio.

GLOBAL:
${HUMAN_IPHONE_CONSTRAINTS}

OUTPUT:
- Photorealistic casual iPhone-like photo (UGC), item clearly visible.
`.trim();

  // Fallback prompt: simpler + more “generate-friendly”
  const fallbackPrompt = `
Create a photorealistic iPhone-like photo of the SAME clothing item being worn by ${genderSubjects[gender]}.

STRICT:
- Same garment, preserve details perfectly.
- Neutral stance, full torso visible (avoid close-ups).
- Plain indoor background (door/wardrobe/wall), natural light.
- No identifiable face (crop from neck down).

Keep it simple and realistic, like a quick personal photo.
`.trim();

  try {
    const partsA = [
      {
        inlineData: {
          mimeType: normalizeMimeType(mimeType),
          data: normalizeBase64Data(base64Image),
        },
      },
      { text: basePrompt },
    ];

    // Attempt A
    try {
      return await generateImageWithMeta({ model, parts: partsA, label: "virtualTryOn-A" });
    } catch (e: any) {
      const code = String(e?.message || "");
      // Retry only for recoverable cases
      if (code === "GEMINI_IMAGE_OTHER" || code === "GEMINI_BLOCKED_SAFETY" || code === "GEMINI_IMAGE_SAFETY") {
        const partsB = [
          {
            inlineData: {
              mimeType: normalizeMimeType(mimeType),
              data: normalizeBase64Data(base64Image),
            },
          },
          { text: fallbackPrompt },
        ];
        return await generateImageWithMeta({ model, parts: partsB, label: "virtualTryOn-B" });
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Virtual try-on failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Quota Gemini depasse. L'essayage virtuel necessite un compte avec facturation activee."
      );
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw new Error("Impossible de generer l'essayage virtuel pour le moment.");
  }
};

export interface ProactiveInsight {
  type:
    | "price_drop"
    | "seasonal"
    | "stale"
    | "incomplete"
    | "opportunity"
    | "bundle"
    | "seo_optimization";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  actionLabel: string;
  articleIds?: string[];
  articleTitles?: string[];
  suggestedAction?: {
    type: string;
    value: any;
  };
}

export const optimizeArticleSEO = async (
  article: any
): Promise<{
  seo_keywords: string[];
  hashtags: string[];
  search_terms: string[];
}> => {
  const model = "gemini-2.5-flash";

  const prompt = `Tu es un expert SEO pour Vinted. Optimise le référencement de cet article pour maximiser sa visibilité.

ARTICLE:
- Titre: ${article.title || "Non défini"}
- Description: ${article.description || "Non définie"}
- Marque: ${article.brand || "Non définie"}
- Taille: ${article.size || "Non définie"}
- Couleur: ${article.color || "Non définie"}
- Matière: ${article.material || "Non définie"}
- État: ${article.condition || "Non défini"}
- Saison: ${article.season || "Non définie"}

GÉNÈRE:
1. seo_keywords: 8-12 mots-clés
2. hashtags: 8-12 hashtags sans #
3. search_terms: 10-15 termes de recherche

RÈGLES:
- Termes recherchés par des acheteurs FR, variantes, occasions, style.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            seo_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            search_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["seo_keywords", "hashtags", "search_terms"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return {
        seo_keywords: parsed.seo_keywords || [],
        hashtags: parsed.hashtags || [],
        search_terms: parsed.search_terms || [],
      };
    }
    return { seo_keywords: [], hashtags: [], search_terms: [] };
  } catch (error: any) {
    console.error("SEO optimization failed:", error);
    return { seo_keywords: [], hashtags: [], search_terms: [] };
  }
};

export const generateProactiveInsights = async (
  articles: any[],
  soldArticles: any[],
  currentMonth: number
): Promise<ProactiveInsight[]> => {
  const model = "gemini-2.5-flash";

  const seasonMap: Record<number, string> = {
    1: "winter",
    2: "winter",
    3: "spring",
    4: "spring",
    5: "spring",
    6: "summer",
    7: "summer",
    8: "summer",
    9: "autumn",
    10: "autumn",
    11: "autumn",
    12: "winter",
  };
  const currentSeason = seasonMap[currentMonth];
  const nextMonthSeason = seasonMap[(currentMonth % 12) + 1];

  const articlesSummary = articles.map((a) => ({
    id: a.id,
    title: a.title,
    brand: a.brand,
    price: a.price,
    status: a.status,
    season: a.season,
    daysListed: a.published_at
      ? Math.floor((Date.now() - new Date(a.published_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    hasPhotos: a.photos?.length > 0,
    photoCount: a.photos?.length || 0,
    hasDescription: !!a.description && a.description.length > 50,
    hasSEO: !!(a.seo_keywords?.length > 0 || a.hashtags?.length > 0 || a.search_terms?.length > 0),
    seoKeywordsCount: a.seo_keywords?.length || 0,
    hashtagsCount: a.hashtags?.length || 0,
    searchTermsCount: a.search_terms?.length || 0,
  }));

  const soldSummary = {
    totalSold: soldArticles.length,
    averagePrice:
      soldArticles.length > 0
        ? soldArticles.reduce((sum, a) => sum + (a.sold_price || a.price), 0) /
          soldArticles.length
        : 0,
    recentSales: soldArticles.filter((a) => {
      const soldDate = new Date(a.sold_at || a.updated_at);
      return Date.now() - soldDate.getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  const prompt = `Tu es Kelly, une coach de vente experte sur Vinted. Analyse ce dressing et genere des insights PROACTIFS et ACTIONABLES.

CONTEXTE:
- Mois actuel: ${currentMonth} (saison: ${currentSeason})
- Prochaine saison: ${nextMonthSeason}
- Articles en vente: ${articlesSummary.length}
- Stats ventes: ${JSON.stringify(soldSummary)}

ARTICLES:
${JSON.stringify(articlesSummary, null, 2)}

REGLES:
- Maximum 5 insights, priorise fort impact.`;

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  title: { type: Type.STRING },
                  message: { type: Type.STRING },
                  actionLabel: { type: Type.STRING },
                  articleIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  suggestedAction: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      value: { type: Type.STRING },
                    },
                  },
                },
                required: ["type", "priority", "title", "message", "actionLabel"],
              },
            },
          },
          required: ["insights"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed.insights || [];
    }
    return [];
  } catch (error: any) {
    console.error("Proactive insights generation failed:", error);
    return [];
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64Data = part.inlineData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
      }
    }

    throw new Error("No audio data found in response");
  } catch (error: any) {
    console.error("Speech generation failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini dépassé pour la synthèse vocale. Veuillez réessayer plus tard.");
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    throw error;
  }
};

export const POSE_VARIATIONS = [
  { id: "frontal", label: "Vue Frontale", instruction: "Full frontal view, hands on hips" },
  { id: "three_quarter", label: "Vue 3/4", instruction: "Slightly turned, 3/4 view" },
  { id: "side_profile", label: "Profil", instruction: "Side profile view" },
  { id: "jumping", label: "En Action", instruction: "Jumping in the air, mid-action shot" },
  { id: "walking", label: "En Marche", instruction: "Walking towards camera" },
  { id: "leaning", label: "Appuyé", instruction: "Leaning against a wall" },
] as const;

export const generatePoseVariation = async (
  base64Image: string,
  mimeType: string,
  poseInstruction: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const prompt = `
Regenerate this image from a different perspective. The person, clothing, and background style must remain consistent.
New perspective/pose: "${poseInstruction}".

CRITICAL:
- Same person (body type/features/skin tone)
- Same clothing item (details/colors/logos)
- Similar lighting/background
- Casual iPhone photo look, not studio
- No identifiable face

${HUMAN_IPHONE_CONSTRAINTS}

Return ONLY the final image.
`.trim();

  try {
    const parts = [
      {
        inlineData: {
          mimeType: normalizeMimeType(mimeType),
          data: normalizeBase64Data(base64Image),
        },
      },
      { text: prompt },
    ];

    return await generateImageWithMeta({ model, parts, label: "poseVariation" });
  } catch (error: any) {
    console.error("Pose variation generation failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Quota Gemini dépassé. La génération de variations de pose nécessite un compte avec facturation activée."
      );
    }

    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw new Error("Impossible de generer la variation de pose pour le moment.");
  }
};
