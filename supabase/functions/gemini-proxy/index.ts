import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai@1.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVER_GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifie" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Aucune cle API Gemini configuree. Veuillez renseigner votre cle API dans votre profil." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, payload } = body;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    if (action === "generateContent") {
      const { model, contents, config } = payload;

      const response = await ai.models.generateContent({ model, contents, config });

      if (config?.responseModalities?.includes("AUDIO")) {
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              return new Response(
                JSON.stringify({ audioData: part.inlineData.data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
        return new Response(
          JSON.stringify({ error: "Aucune donnee audio dans la reponse" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const outParts = response.candidates?.[0]?.content?.parts;
      if (outParts) {
        for (const part of outParts) {
          if (part.inlineData?.data) {
            const finishReason = response.candidates?.[0]?.finishReason;
            return new Response(
              JSON.stringify({
                imageData: part.inlineData.data,
                finishReason,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        return new Response(
          JSON.stringify({ finishReason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ text: response.text, finishReason }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Action inconnue: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("gemini-proxy error:", error);

    let errorMessage = "Erreur serveur Gemini";
    let statusCode = 500;

    if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "Quota Gemini depasse. Veuillez reessayer plus tard.";
      statusCode = 429;
    } else if (error?.message?.includes("API key") || error?.message?.includes("PERMISSION_DENIED")) {
      errorMessage = "Cle API Gemini invalide. Verifiez votre cle dans votre profil.";
      statusCode = 401;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
