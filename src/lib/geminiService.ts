// src/lib/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not configured");
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
  return `GEMINI_${fr}`;
}

function normalizeBase64Data(data: string): string {
  // accepts raw base64 or data:*;base64,xxx
  if (!data) return data;
  const idx = data.indexOf("base64,");
  return idx >= 0 ? data.slice(idx + "base64,".length) : data;
}

function normalizeMimeType(mimeType: string): string {
  // Keep as-is, but you can force image/jpeg if you want extra stability:
  // return "image/jpeg";
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
          "Essayez une image plus nette, un cadrage moins serré (éviter gros plans), ou réessayez (les modèles image peuvent être instables)."
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
  console.error(`[Gemini ${args.label}] meta:`, meta);

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

/** ---------------------------------------------------------
 * ✅ Your existing interfaces + non-image functions remain unchanged
 * -------------------------------------------------------- */

// ... keep analyzeProductImage, coach, seo, etc. as-is ...

/** ---------------------------------------------------------
 * ✅ editProductImage (with safety + correct error mapping)
 * -------------------------------------------------------- */
export const editProductImage = async (
  base64Image: string,
  mimeType: string,
  instruction: string,
  referenceImages?: { data: string; description: string }[]
): Promise<string> => {
  const model = "gemini-2.5-flash-image";

  const enhancedInstruction = `${instruction}
${HUMAN_IPHONE_CONSTRAINTS}
Preserve product details perfectly (logos/text/labels), keep product as focal point, no distortions.`;

  try {
    const parts: any[] = [
      {
        inlineData: {
          mimeType: normalizeMimeType(mimeType),
          data: normalizeBase64Data(base64Image),
        },
      },
    ];

    if (referenceImages?.length) {
      for (const ref of referenceImages) {
        parts.push({ text: ref.description });
        parts.push({
          inlineData: {
            // Ideally store mimeType per ref; keep png for now
            mimeType: "image/png",
            data: normalizeBase64Data(ref.data),
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
        "Quota Gemini dépassé. L'édition d'images nécessite un compte avec facturation activée sur Google Cloud."
      );
    }
    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide ou manquante. Vérifiez votre .env (VITE_GEMINI_API_KEY).");
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw error;
  }
};

/** ---------------------------------------------------------
 * ✅ generateVirtualTryOn (adds: safety config + smart fallback retry)
 * -------------------------------------------------------- */
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

  // Fallback prompt: simpler + more “generate-friendly” (reduces IMAGE_OTHER / ambiguity)
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

    // 1st attempt
    try {
      return await generateImageWithMeta({ model, parts: partsA, label: "virtualTryOn-A" });
    } catch (e: any) {
      const code = String(e?.message || "");
      // Retry only for these “recoverable” cases
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
      throw new Error("Quota Gemini dépassé. L'essayage virtuel nécessite un compte avec facturation activée.");
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw new Error("Impossible de générer l’essayage virtuel pour le moment.");
  }
};

/** ---------------------------------------------------------
 * ✅ generatePoseVariation (adds safety + better errors)
 * -------------------------------------------------------- */
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
    console.error("Pose variation failed:", error);

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Quota Gemini dépassé. La génération d’images nécessite un compte avec facturation activée.");
    }
    if (error?.message?.includes("API key")) {
      throw new Error("Clé API Gemini invalide. Vérifiez votre configuration.");
    }

    const code = String(error?.message || "");
    if (code.startsWith("GEMINI_")) throw buildUserError(code);

    throw new Error("Impossible de générer la variation de pose pour le moment.");
  }
};