import { callGeminiProxy } from './geminiProxy';

const HUMAN_IPHONE_CONSTRAINTS =
  "Output must look like an ordinary iPhone photo taken by a real person: natural ambient light, slightly imperfect framing, faithful colors, mild sensor grain, no studio look, no editorial styling, no seamless/gradient background, no HDR/glow, no over-sharpening, no AI-smoothed/plastic textures, no obvious AI artifacts. Keep it believable.";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SAFETY_SETTINGS_PROD = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
] as const;

type GeminiFinishReason = "STOP" | "SAFETY" | "IMAGE_SAFETY" | "IMAGE_OTHER" | "RECITATION" | "OTHER" | string;

function finishReasonToCode(fr?: GeminiFinishReason) {
  if (!fr || fr === "STOP") return null;
  if (fr === "SAFETY" || fr === "IMAGE_SAFETY") return "GEMINI_BLOCKED_SAFETY";
  if (fr === "IMAGE_OTHER") return "GEMINI_IMAGE_OTHER";
  return "GEMINI_" + fr;
}

function normalizeBase64Data(data: string): string {
  if (!data) return data;
  const idx = data.indexOf("base64,");
  return idx >= 0 ? data.slice(idx + "base64,".length) : data;
}

function normalizeMimeType(mimeType: string): string {
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
        "La génération d'image a échoué pour une raison technique (IMAGE_OTHER). " +
          "Essayez une image plus nette, un cadrage moins serré (éviter gros plans), ou réessayez."
      );
    default:
      return new Error("Impossible de générer l'image pour le moment.");
  }
}

async function generateImageWithProxy(args: { model: string; parts: any[]; label: string }): Promise<string> {
  const result = await callGeminiProxy(args.model, { parts: args.parts }, {
    safetySettings: SAFETY_SETTINGS_PROD,
  });

  if ('imageData' in result && result.imageData) return result.imageData;

  const finishReason = 'finishReason' in result ? result.finishReason : undefined;
  const code = finishReasonToCode(finishReason);
  if (code) throw new Error(code);

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
         writingStyle ? " - IMPORTANT: Use the writing style provided above for the description" : ""
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
    const result = await callGeminiProxy(
      "gemini-2.5-flash",
      {
        parts: [
          { inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } },
          { text: prompt },
        ],
      },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            products: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  features: { type: "ARRAY", items: { type: "STRING" } },
                  category: { type: "STRING" },
                  priceEstimate: { type: "STRING" },
                  brand: { type: "STRING" },
                  size: { type: "STRING" },
                  color: { type: "STRING" },
                  material: { type: "STRING" },
                  condition: { type: "STRING" },
                  gender: { type: "STRING" },
                  season: { type: "STRING" },
                  suggestedPeriod: { type: "STRING" },
                  marketing: {
                    type: "OBJECT",
                    properties: {
                      instagramCaption: { type: "STRING" },
                      hashtags: { type: "ARRAY", items: { type: "STRING" } },
                      salesEmail: { type: "STRING" },
                      seoKeywords: { type: "ARRAY", items: { type: "STRING" } },
                    },
                  },
                },
                required: ["title", "description", "features"],
              },
            },
          },
        },
      }
    );

    if ('text' in result && result.text) {
      const parsed = JSON.parse(result.text);
      return parsed.products || [];
    }
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Analysis failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé pour l'analyse. Veuillez réessayer plus tard ou activer la facturation sur Google Cloud.");
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
  const enhancedInstruction = instruction + "\n" + HUMAN_IPHONE_CONSTRAINTS + "\nPreserve product details perfectly (logos/text/labels), keep product as focal point, no distortions.";

  try {
    const parts: any[] = [
      { inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } },
    ];

    if (referenceImages && referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        parts.push({ text: refImage.description });
        parts.push({ inlineData: { mimeType: "image/png", data: normalizeBase64Data(refImage.data) } });
      }
    }

    parts.push({ text: enhancedInstruction });

    return await generateImageWithProxy({ model: "gemini-2.5-flash-image", parts, label: "editProductImage" });
  } catch (error: any) {
    console.error("Editing failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé. L'édition d'images nécessite un compte avec facturation activée sur Google Cloud.");
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
  field: "title" | "description" | "price" | "brand" | "size" | "color" | "material" | "condition";
  currentValue: string | number;
  suggestedValue: string | number;
  reason: string;
}

export const parseSuggestionValue = (field: string, value: string | number): string | number => {
  if (field === "price") {
    const stringValue = String(value);
    const numericValue = parseFloat(stringValue.replace(/[^0-9.,]/g, "").replace(",", "."));
    return isNaN(numericValue) ? "" : numericValue.toString();
  }
  return value;
};

export interface CoachAdvice {
  generalAdvice: string;
  suggestions: Suggestion[];
}

export const getListingCoachAdvice = async (article: any, activePhoto?: string): Promise<string> => {
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
      parts.unshift({ inlineData: { mimeType: "image/jpeg", data: normalizeBase64Data(base64Data) } });
    }

    const result = await callGeminiProxy("gemini-2.5-flash", { parts });
    if ('text' in result && result.text) return result.text;
    return "Désolé, je n'ai pas pu analyser votre annonce pour le moment.";
  } catch (error: any) {
    console.error("Listing coach analysis failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }
    if (error?.message?.includes("API_KEY_INVALID") || error?.message?.includes("API key") || error?.message?.includes("cle API") || error?.message?.includes("Aucune cle")) {
      throw new Error("API_KEY_INVALID:" + error.message);
    }
    throw new Error("Impossible d'analyser l'annonce pour le moment.");
  }
};

export const getStructuredCoachAdvice = async (article: any, activePhoto?: string): Promise<CoachAdvice> => {
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
      parts.unshift({ inlineData: { mimeType: "image/jpeg", data: normalizeBase64Data(base64Data) } });
    }

    const result = await callGeminiProxy("gemini-2.5-flash", { parts }, {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          generalAdvice: { type: "STRING" },
          suggestions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                field: { type: "STRING" },
                currentValue: { type: "STRING" },
                suggestedValue: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["field", "currentValue", "suggestedValue", "reason"],
            },
          },
        },
        required: ["generalAdvice", "suggestions"],
      },
    });

    if ('text' in result && result.text) return JSON.parse(result.text);
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Structured coach analysis failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé. Veuillez réessayer plus tard.");
    }
    if (error?.message?.includes("API_KEY_INVALID") || error?.message?.includes("API key") || error?.message?.includes("cle API") || error?.message?.includes("Aucune cle")) {
      throw new Error("API_KEY_INVALID:" + error.message);
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

export const analyzeDefects = async (base64Image: string, mimeType: string): Promise<DefectAnalysis> => {
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
    const result = await callGeminiProxy(
      "gemini-2.5-flash",
      { parts: [{ inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } }, { text: prompt }] },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            overallConditionScore: { type: "NUMBER" },
            defects: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING" },
                  severity: { type: "STRING" },
                  location: { type: "STRING" },
                  description: { type: "STRING" },
                  impactOnPrice: { type: "NUMBER" },
                },
                required: ["type", "severity", "location", "description", "impactOnPrice"],
              },
            },
            recommendations: { type: "ARRAY", items: { type: "STRING" } },
            suggestedDisclosure: { type: "STRING" },
            estimatedCondition: { type: "STRING" },
          },
          required: ["overallConditionScore", "defects", "recommendations", "suggestedDisclosure", "estimatedCondition"],
        },
      }
    );

    if ('text' in result && result.text) return JSON.parse(result.text);
    throw new Error("No text response from model");
  } catch (error: any) {
    console.error("Defect analysis failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
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
      { inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } },
      { text: basePrompt },
    ];

    try {
      return await generateImageWithProxy({ model: "gemini-2.5-flash-image", parts: partsA, label: "virtualTryOn-A" });
    } catch (e: any) {
      const code = String(e?.message || "");
      if (code === "GEMINI_IMAGE_OTHER" || code === "GEMINI_BLOCKED_SAFETY" || code === "GEMINI_IMAGE_SAFETY") {
        const partsB = [
          { inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } },
          { text: fallbackPrompt },
        ];
        return await generateImageWithProxy({ model: "gemini-2.5-flash-image", parts: partsB, label: "virtualTryOn-B" });
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Virtual try-on failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini depasse. L'essayage virtuel necessite un compte avec facturation activee.");
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
    | "seo_optimization"
    | "ready_to_publish"
    | "ready_to_list";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  actionLabel: string;
  articleIds?: string[];
  articleTitles?: string[];
  suggestedAction?: { type: string; value: any };
}

export const optimizeArticleSEO = async (article: any): Promise<{
  seo_keywords: string[];
  hashtags: string[];
  search_terms: string[];
}> => {
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
    const result = await callGeminiProxy(
      "gemini-2.5-flash",
      [{ parts: [{ text: prompt }] }],
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            seo_keywords: { type: "ARRAY", items: { type: "STRING" } },
            hashtags: { type: "ARRAY", items: { type: "STRING" } },
            search_terms: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["seo_keywords", "hashtags", "search_terms"],
        },
      }
    );

    if ('text' in result && result.text) {
      const parsed = JSON.parse(result.text);
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
  const seasonMap: Record<number, string> = {
    1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn",
    11: "autumn", 12: "winter",
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
        ? soldArticles.reduce((sum, a) => sum + (a.sold_price || a.price), 0) / soldArticles.length
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

TYPES D'INSIGHTS DISPONIBLES:

ACTIONS AUTO-EXECUTABLES (prioritaires) :
1. "ready_to_publish" : Articles brouillons complets (photos, description, prix) à passer en statut "Prêt" pour maximiser les ventes
2. "ready_to_list" : Articles qui peuvent passer en statut "prêt"
3. "price_drop" : Baisser le prix d'articles qui ne se vendent pas
4. "stale" : Articles publiés depuis longtemps sans vues/ventes
5. "bundle" : Créer un lot avec plusieurs articles similaires
6. "seo_optimization" : Optimiser mots-clés/hashtags/termes de recherche

CONSEILS (non auto-exécutables) :
1. "seasonal" : Articles à mettre en avant selon la saison
2. "incomplete" : Articles sans photos/description/infos manquantes
3. "opportunity" : Opportunités de vente basées sur les tendances

REGLES CRITIQUES:
- Maximum 5 insights, priorise ACTIONS AUTO-EXECUTABLES
- Privilégie "ready_to_publish" si brouillons complets trouvés
- Pour "ready_to_publish" : actionLabel doit être "Passer en Prêt"
- priority: "high" pour urgent, "medium" pour important, "low" pour conseil simple

REGLE IMPORTANTE POUR OPTIMISATION DE PRIX:
- NE suggère une optimisation de prix que SI l'écart entre optimal_price et price est SUPERIEUR à 10%`;

  try {
    const result = await callGeminiProxy(
      "gemini-2.5-flash",
      [{ parts: [{ text: prompt }] }],
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            insights: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING" },
                  priority: { type: "STRING" },
                  title: { type: "STRING" },
                  message: { type: "STRING" },
                  actionLabel: { type: "STRING" },
                  articleIds: { type: "ARRAY", items: { type: "STRING" } },
                  suggestedAction: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING" },
                      value: { type: "STRING" },
                    },
                  },
                },
                required: ["type", "priority", "title", "message", "actionLabel"],
              },
            },
          },
          required: ["insights"],
        },
      }
    );

    if ('text' in result && result.text) {
      const parsed = JSON.parse(result.text);
      return parsed.insights || [];
    }
    return [];
  } catch (error: any) {
    console.error("Proactive insights generation failed:", error);
    if (error?.message?.includes("API_KEY_INVALID") || error?.message?.includes("API key") || error?.message?.includes("cle API") || error?.message?.includes("Aucune cle")) {
      throw new Error("API_KEY_INVALID:" + error.message);
    }
    return [];
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  try {
    const result = await callGeminiProxy(
      "gemini-2.5-flash-preview-tts",
      [{ parts: [{ text }] }],
      {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      }
    );

    if ('audioData' in result && result.audioData) {
      const binaryString = atob(result.audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    throw new Error("No audio data found in response");
  } catch (error: any) {
    console.error("Speech generation failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé pour la synthèse vocale. Veuillez réessayer plus tard.");
    }
    throw error;
  }
};

export interface KellyChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface KellyArticleData {
  id: string;
  title?: string;
  category?: string;
  brand?: string;
  size?: string;
  price?: number;
  sold_price?: number;
  condition?: string;
  color?: string;
  material?: string;
  status?: string;
  seller_name?: string;
  season?: string;
  reference_number?: string;
  scheduled_for?: string;
  vinted_url?: string;
}

export interface KellyLotData {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  sold_price?: number;
  status?: string;
  reference_number?: string;
  seller_id?: string;
  scheduled_for?: string;
}

export interface KellyFamilyMemberData {
  id: string;
  name?: string;
  gender?: string;
  age?: number;
  size_top?: string;
  size_bottom?: string;
  size_shoes?: string;
}

export interface KellyChatContext {
  articlesCount?: number;
  lotsCount?: number;
  soldCount?: number;
  totalRevenue?: number;
  topCategories?: string[];
  recentActivity?: string;
  articles?: KellyArticleData[];
  soldArticles?: KellyArticleData[];
  lots?: KellyLotData[];
  soldLots?: KellyLotData[];
  familyMembers?: KellyFamilyMemberData[];
  sellerName?: string;
  pendingCount?: number;
  scheduledCount?: number;
  categoryBreakdown?: Record<string, number>;
  brandBreakdown?: Record<string, number>;
  avgPrice?: number;
  avgSoldPrice?: number;
}

const buildKellyContextSummary = (ctx: KellyChatContext): string => {
  const lines: string[] = [];

  if (ctx.sellerName) lines.push(`Nom du dressing : ${ctx.sellerName}`);

  lines.push(`\n=== INVENTAIRE ACTIF (${ctx.articlesCount ?? 0} articles, ${ctx.lotsCount ?? 0} lots) ===`);
  lines.push(`- En cours / brouillon : ${ctx.pendingCount ?? 0}`);
  lines.push(`- Programmés : ${ctx.scheduledCount ?? 0}`);
  lines.push(`- Prix moyen des articles actifs : ${ctx.avgPrice ? ctx.avgPrice.toFixed(2) + '€' : 'N/A'}`);

  if (ctx.categoryBreakdown && Object.keys(ctx.categoryBreakdown).length > 0) {
    const sorted = Object.entries(ctx.categoryBreakdown).sort((a, b) => b[1] - a[1]);
    lines.push(`- Répartition par catégorie : ${sorted.map(([cat, n]) => `${cat}(${n})`).join(', ')}`);
  }

  if (ctx.brandBreakdown && Object.keys(ctx.brandBreakdown).length > 0) {
    const sorted = Object.entries(ctx.brandBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
    lines.push(`- Marques présentes : ${sorted.map(([b, n]) => `${b}(${n})`).join(', ')}`);
  }

  if (ctx.articles && ctx.articles.length > 0) {
    lines.push(`\n--- ARTICLES ACTIFS DÉTAILLÉS ---`);
    ctx.articles.forEach(a => {
      const parts = [
        a.title || '(sans titre)',
        a.category,
        a.brand,
        a.size,
        a.condition,
        a.color,
        a.material,
        a.season,
        a.price ? `${a.price}€` : null,
        a.status,
        a.scheduled_for ? `programmé le ${new Date(a.scheduled_for).toLocaleDateString('fr-FR')}` : null,
        a.vinted_url ? `publié` : null,
        a.reference_number ? `ref:${a.reference_number}` : null,
      ].filter(Boolean);
      lines.push(`  • ${parts.join(' | ')}`);
    });
  }

  if (ctx.lots && ctx.lots.length > 0) {
    lines.push(`\n--- LOTS ACTIFS ---`);
    ctx.lots.forEach(l => {
      const parts = [
        l.title || '(sans titre)',
        l.price ? `${l.price}€` : null,
        l.status,
        l.reference_number ? `ref:${l.reference_number}` : null,
        l.scheduled_for ? `programmé le ${new Date(l.scheduled_for).toLocaleDateString('fr-FR')}` : null,
      ].filter(Boolean);
      lines.push(`  • ${parts.join(' | ')}`);
    });
  }

  lines.push(`\n=== HISTORIQUE DES VENTES (${ctx.soldCount ?? 0} articles vendus) ===`);
  lines.push(`- Revenus totaux : ${ctx.totalRevenue != null ? ctx.totalRevenue.toFixed(2) + '€' : 'N/A'}`);
  lines.push(`- Prix moyen de vente : ${ctx.avgSoldPrice ? ctx.avgSoldPrice.toFixed(2) + '€' : 'N/A'}`);

  if (ctx.soldArticles && ctx.soldArticles.length > 0) {
    lines.push(`\n--- ARTICLES VENDUS ---`);
    ctx.soldArticles.slice(0, 50).forEach(a => {
      const parts = [
        a.title || '(sans titre)',
        a.category,
        a.brand,
        a.size,
        a.color,
        a.sold_price ? `vendu ${a.sold_price}€` : a.price ? `prix ${a.price}€` : null,
        a.reference_number ? `ref:${a.reference_number}` : null,
      ].filter(Boolean);
      lines.push(`  • ${parts.join(' | ')}`);
    });
  }

  if (ctx.soldLots && ctx.soldLots.length > 0) {
    lines.push(`\n--- LOTS VENDUS ---`);
    ctx.soldLots.forEach(l => {
      const parts = [
        l.title || '(sans titre)',
        l.sold_price ? `vendu ${l.sold_price}€` : l.price ? `prix ${l.price}€` : null,
        l.reference_number ? `ref:${l.reference_number}` : null,
      ].filter(Boolean);
      lines.push(`  • ${parts.join(' | ')}`);
    });
  }

  if (ctx.familyMembers && ctx.familyMembers.length > 0) {
    lines.push(`\n=== MEMBRES DE LA FAMILLE ===`);
    ctx.familyMembers.forEach(m => {
      const parts = [
        m.name || '(sans nom)',
        m.gender,
        m.age ? `${m.age} ans` : null,
        m.size_top ? `haut:${m.size_top}` : null,
        m.size_bottom ? `bas:${m.size_bottom}` : null,
        m.size_shoes ? `chaussures:${m.size_shoes}` : null,
      ].filter(Boolean);
      lines.push(`  • ${parts.join(' | ')}`);
    });
  }

  return lines.join('\n');
};

export const chatWithKellyGlobal = async (
  userMessage: string,
  conversationHistory: KellyChatMessage[],
  siteContext: KellyChatContext
): Promise<string> => {
  const contextSummary = buildKellyContextSummary(siteContext);

  const historyText = conversationHistory.slice(-10).map(m =>
    `${m.role === 'user' ? 'Utilisateur' : 'Kelly'}: ${m.content}`
  ).join('\n');

  const prompt = `Tu es Kelly, une assistante IA experte en mode, vente de vêtements d'occasion et optimisation de dressing. Tu travailles sur une plateforme de gestion de dressing pour vendre sur Vinted et autres plateformes.

Tu as accès à l'intégralité des données du dressing de l'utilisateur ci-dessous. Utilise ces données pour répondre de façon précise, chiffrée et personnalisée. Quand l'utilisateur pose une question sur ses articles, ses ventes, ses lots ou ses membres de famille, base-toi EXCLUSIVEMENT sur les données fournies et donne des réponses exactes avec les titres, prix, marques, tailles, statuts réels.

${contextSummary}

${historyText ? `Historique de la conversation :\n${historyText}\n` : ''}

Question de l'utilisateur : ${userMessage}

Réponds de façon naturelle, bienveillante et experte. Sois précise et cite des données concrètes quand disponibles (noms d'articles, prix exacts, quantités réelles). Si la question porte sur les données du dressing, réponds avec les vrais chiffres. Si la question est générale (tendances, conseils, marques), utilise aussi tes connaissances générales. Limite ta réponse à 350 mots maximum.`;

  try {
    const result = await callGeminiProxy(
      "gemini-2.5-flash",
      { parts: [{ text: prompt }] },
      {}
    );

    if ('text' in result && result.text) {
      return result.text;
    }
    throw new Error("Pas de réponse de Kelly");
  } catch (error: any) {
    console.error("Kelly chat error:", error);
    if (error?.message?.includes("API_KEY_INVALID") || error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Configurez-la dans Paramètres > Profil.");
    }
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé. Réessayez plus tard.");
    }
    throw new Error("Kelly n'est pas disponible pour le moment. Réessayez.");
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
      { inlineData: { mimeType: normalizeMimeType(mimeType), data: normalizeBase64Data(base64Image) } },
      { text: prompt },
    ];
    return await generateImageWithProxy({ model: "gemini-2.5-flash-image", parts, label: "poseVariation" });
  } catch (error: any) {
    console.error("Pose variation generation failed:", error);
    if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
      throw new Error("Quota Gemini dépassé. La génération de variations de pose nécessite un compte avec facturation activée.");
    }
    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);
    throw new Error("Impossible de generer la variation de pose pour le moment.");
  }
};
