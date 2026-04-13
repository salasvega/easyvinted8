import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI, Type } from "npm:@google/genai@1.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FUNCTION_VERSION = "3.3.0-GEMINI-2.5-FLASH-USER-KEY-ONLY";

interface AnalysisResult {
  title: string;
  description: string;
  brand: string;
  color: string;
  material?: string;
  size?: string;
  condition: string;
  season: string;
  suggestedPeriod?: string;
  estimatedPrice?: number;
  seoKeywords?: string[];
  hashtags?: string[];
  searchTerms?: string[];
  confidenceScore?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header manquant" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifie" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .maybeSingle();

    const GEMINI_API_KEY = userProfile?.gemini_api_key;

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Aucune cle API Gemini configuree. Veuillez renseigner votre cle API dans votre profil."
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { imageUrls, sellerId, isLot, lotArticles, usefulInfo, articleId } = await req.json();

    console.log(`🚀 EDGE FUNCTION VERSION: ${FUNCTION_VERSION}`);
    console.log("📥 Request received:", {
      imageCount: imageUrls?.length,
      usefulInfo,
      isLot,
      sellerId,
      articleId
    });

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Au moins une URL d'image est requise" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let writingStyle = "Description detaillee et attractive";
    let sellerTopSize: string | null = null;
    let sellerBottomSize: string | null = null;
    let sellerShoeSize: string | null = null;

    if (sellerId) {
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("persona_id, writing_style, top_size, bottom_size, shoe_size")
        .eq("id", sellerId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (familyMember) {
        if (familyMember.writing_style) {
          writingStyle = familyMember.writing_style;
        } else if (familyMember.persona_id) {
          const personaStyles: Record<string, string> = {
            minimalist: "Descriptions courtes, claires et efficaces",
            enthusiast: "Dynamique, positive et pleine d'energie",
            professional: "Experte, technique et detaillee",
            friendly: "Chaleureuse, accessible et decontractee",
            elegant: "Raffinee, sophistiquee et chic",
            eco_conscious: "Responsable avec focus sur la durabilite",
            trendy: "Tendance et a la pointe de la mode",
            storyteller: "Raconte une histoire autour de l'article",
            custom: writingStyle
          };
          writingStyle = personaStyles[familyMember.persona_id] || writingStyle;
        }

        sellerTopSize = familyMember.top_size || null;
        sellerBottomSize = familyMember.bottom_size || null;
        sellerShoeSize = familyMember.shoe_size || null;
      }
    }

    const sellerSizeContext = (sellerTopSize || sellerBottomSize || sellerShoeSize)
      ? `\nTailles enregistrees pour ce vendeur (a utiliser comme valeur par defaut si la taille n'est pas visible sur les photos ni precisee dans les infos utiles) :
${sellerTopSize ? `- Haut / Robe / Veste / Manteau : ${sellerTopSize}` : ''}
${sellerBottomSize ? `- Bas (pantalon, jean, jupe, short) : ${sellerBottomSize}` : ''}
${sellerShoeSize ? `- Pointure (chaussures, bottes, baskets) : ${sellerShoeSize}` : ''}
Regle : si la taille est clairement visible sur une etiquette dans les photos OU precisee dans les infos utiles du vendeur, utiliser cette valeur. Sinon, utiliser la taille enregistree du vendeur correspondant au type de vetement identifie.\n`
      : '';

    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    for (const url of imageUrls) {
      try {
        const parsedUrl = new URL(url);
        const pathMatch = parsedUrl.pathname.match(/\/storage\/v1\/object\/public\/article-photos\/(.+)$/);

        if (!pathMatch) {
          console.error("Invalid storage URL format:", url);
          continue;
        }

        const filePath = pathMatch[1];
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("article-photos")
          .download(filePath);

        if (downloadError || !fileData) {
          console.error("Failed to download:", filePath, downloadError?.message);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let base64 = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = btoa(base64);

        const contentType = fileData.type || "image/jpeg";

        imageParts.push({
          inlineData: {
            mimeType: contentType,
            data: base64
          }
        });
      } catch (imgError) {
        console.error("Error processing image:", imgError);
      }
    }

    if (imageParts.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Impossible de charger les images"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Successfully processed ${imageParts.length} images`);

    const prompt = `Tu es KELLY, experte Vinted avec 8 ans d'experience.

${usefulInfo ? `🚨 INFORMATIONS IMPORTANTES DU VENDEUR 🚨
"${usefulInfo}"

Ces informations du vendeur sont prioritaires et doivent guider l'integralite de l'analyse.

` : ''}${sellerSizeContext}Analyse ces ${imageUrls.length} photo(s) et retourne un JSON avec les champs suivants:

- title: Titre accrocheur max 60 caracteres
- description: Description de l'article en respectant strictement ce style de redaction : "${writingStyle}". Ne pas imposer de longueur fixe — la description doit etre naturelle et coherente avec le style. Mettre en valeur les points forts de l'article (matiere, etat, coupe, usage) sans inventer d'informations non visibles sur les photos.
- brand: Marque visible sur l'article ou "Sans marque"
- color: Couleur principale
- material: Matiere principale si identifiable
- size: Taille de l'article. REGLE DE PRIORITE STRICTE — appliquer dans cet ordre exact :
  1. Etiquette de taille clairement lisible sur l'une des photos (priorite absolue).
  2. Taille explicitement mentionnee dans les informations du vendeur (ex: "taille 38", "pointure 42", "M", "XL") — si presente dans les infos utiles, utiliser cette valeur MEME si elle differe de la taille enregistree du vendeur.
  3. Taille enregistree du vendeur pour le type de vetement identifie (voir section tailles vendeur ci-dessus) — uniquement si aucune des deux sources precedentes ne fournit de taille.
  Retourner une chaine vide uniquement si aucune de ces trois sources ne permet de determiner la taille. Ne jamais inventer une taille.
- condition: Etat de l'article — retourner exactement l'une de ces valeurs: "new_with_tags", "new_without_tags", "very_good", "good", "satisfactory"
- season: Saison adaptee — retourner exactement l'une de ces valeurs: "spring", "summer", "autumn", "winter", "all-seasons"
- suggestedPeriod: Meilleure periode de vente en francais (ex: "Mars - Mai", "Toute l'annee")
- estimatedPrice: Prix de revente estime en euros (nombre entier)
- seoKeywords: 8 mots-cles pour le referencement
- hashtags: 10 hashtags pertinents
- searchTerms: 5 termes de recherche probables d'un acheteur
- confidenceScore: Score de confiance de l'analyse entre 0 et 100`;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const parts: any[] = [
        { text: prompt },
        ...imageParts
      ];

      console.log("🤖 Calling Gemini API...");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              brand: { type: Type.STRING },
              color: { type: Type.STRING },
              material: { type: Type.STRING },
              size: { type: Type.STRING },
              condition: { type: Type.STRING },
              season: { type: Type.STRING },
              suggestedPeriod: { type: Type.STRING },
              estimatedPrice: { type: Type.NUMBER },
              seoKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              searchTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              confidenceScore: { type: Type.NUMBER }
            },
            required: ["title", "description", "brand", "color", "condition", "season"]
          }
        }
      });

      if (!response.text) {
        console.error("❌ Empty Gemini response");
        return new Response(
          JSON.stringify({ error: "L'IA n'a pas pu analyser les images" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("✅ Gemini response received");
      const parsedResponse = JSON.parse(response.text);

      console.log("📊 RAW Gemini Response:", JSON.stringify(parsedResponse, null, 2));

      const result: AnalysisResult = {
        title: parsedResponse.title || "Article à vendre",
        description: parsedResponse.description || "Article en bon état",
        brand: parsedResponse.brand || "Sans marque",
        color: parsedResponse.color || "Multicolore",
        material: parsedResponse.material,
        size: parsedResponse.size,
        condition: parsedResponse.condition || "good",
        season: parsedResponse.season || "all-seasons",
        suggestedPeriod: parsedResponse.suggestedPeriod,
        estimatedPrice: parsedResponse.estimatedPrice,
        seoKeywords: parsedResponse.seoKeywords || [],
        hashtags: parsedResponse.hashtags || [],
        searchTerms: parsedResponse.searchTerms || [],
        confidenceScore: parsedResponse.confidenceScore || 80,
      };

      console.log("📤 FINAL RESULT - Full object:", JSON.stringify(result, null, 2));

      // Save analysis to cache if articleId provided
      if (articleId) {
        try {
          const { error: updateError } = await supabase
            .from('articles')
            .update({
              image_analysis_raw: parsedResponse,
              image_analysis_photo_urls: imageUrls,
              image_analyzed_at: new Date().toISOString(),
              image_analysis_confidence: result.confidenceScore
            })
            .eq('id', articleId)
            .eq('user_id', user.id);

          if (updateError) {
            console.error('Failed to cache analysis:', updateError);
          } else {
            console.log('Analysis cached successfully for article:', articleId);
          }
        } catch (cacheError) {
          console.error('Error caching analysis:', cacheError);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (geminiError: any) {
      console.error("❌ Gemini API error:", geminiError);

      let errorMessage = "Erreur lors de l'analyse avec Gemini";

      if (geminiError?.message?.includes('quota') || geminiError?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Quota Gemini depasse. Veuillez reessayer plus tard.";
      } else if (geminiError?.message?.includes('API key')) {
        errorMessage = "Cle API Gemini invalide.";
      } else if (geminiError?.message) {
        errorMessage += `: ${geminiError.message}`;
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("❌ Error in analyze-article-image:", error);
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${error?.message || "Unknown error"}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
