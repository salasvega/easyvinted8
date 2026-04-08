import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── helpers ────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

async function resolveArticleId(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerId: string | null,
  articleTitle: string | null
): Promise<string | null> {
  if (!articleTitle) return null;

  let q = supabase
    .from("articles")
    .select("id, title")
    .eq("user_id", userId)
    .ilike("title", `%${articleTitle}%`)
    .limit(1);

  if (sellerId) q = q.eq("seller_id", sellerId);

  const { data } = await q.maybeSingle();
  return data?.id ?? null;
}

async function resolveSellerIdByName(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerName: string | null
): Promise<string | null> {
  if (!sellerName) return null;
  const { data } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", `%${sellerName}%`)
    .maybeSingle();
  return data?.id ?? null;
}

// ── command handlers ───────────────────────────────────────────────────────

async function handleListArticles(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerId: string | null
) {
  let q = supabase
    .from("articles")
    .select("id, title, status, price, seller_id")
    .eq("user_id", userId)
    .in("status", ["ready", "draft", "scheduled"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (sellerId) q = q.eq("seller_id", sellerId);

  const { data, error } = await q;
  if (error) throw error;

  const count = data?.length ?? 0;
  const lines = (data ?? []).map((a) => `- [${a.status}] ${a.title} (${a.price}€)`).join("\n");
  return {
    count,
    result_message: count === 0
      ? "Aucun article ready/draft/scheduled trouvé."
      : `${count} article(s) trouvé(s):\n${lines}`,
    articles: data,
  };
}

async function handleChangeStatus(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  articleId: string | null,
  targetStatus: string
) {
  if (!articleId) throw new Error("article_id requis pour change_status");

  const validStatuses = [
    "draft", "ready", "scheduled", "published",
    "vinted_draft", "sold", "vendu_en_lot", "reserved",
    "processing", "error",
  ];
  if (!validStatuses.includes(targetStatus)) {
    throw new Error(`Statut invalide: ${targetStatus}. Valides: ${validStatuses.join(", ")}`);
  }

  const { data, error } = await supabase
    .from("articles")
    .update({ status: targetStatus, updated_at: nowIso() })
    .eq("id", articleId)
    .eq("user_id", userId)
    .select("id, title, status")
    .single();

  if (error) throw error;
  return {
    result_message: `Statut de "${data.title}" changé → ${data.status}`,
    article: data,
  };
}

async function handleFinaliseOnly(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerId: string | null,
  articleTitle: string | null
) {
  const articleId = await resolveArticleId(supabase, userId, sellerId, articleTitle);
  if (!articleId) throw new Error(`Article introuvable: "${articleTitle}"`);

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "ready", updated_at: nowIso() })
    .eq("id", articleId)
    .eq("user_id", userId)
    .select("id, title, status")
    .single();

  if (error) throw error;
  return {
    result_message: `Article "${data.title}" finalisé (status → ready). Prêt pour publication.`,
    article: data,
  };
}

async function handlePublishNextDraft(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerId: string | null
) {
  let q = supabase
    .from("articles")
    .select("id, title, price, description, brand, size, condition, color, material, photos")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(1);

  if (sellerId) q = q.eq("seller_id", sellerId);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Aucun article ready trouvé pour publication.");

  await supabase
    .from("articles")
    .update({ status: "processing", updated_at: nowIso() })
    .eq("id", data.id);

  return {
    result_message: `Article "${data.title}" (${data.price}€) mis en processing. Prêt pour publication sur Vinted.`,
    article: data,
    next_action: "navigate_to_vinted_and_publish",
  };
}

async function handlePublishAllReady(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  sellerId: string | null,
  publishMode: "draft" | "live"
) {
  let q = supabase
    .from("articles")
    .select("id, title, price")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(50);

  if (sellerId) q = q.eq("seller_id", sellerId);

  const { data, error } = await q;
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Aucun article ready trouvé.");

  const ids = data.map((a) => a.id);
  await supabase
    .from("articles")
    .update({ status: "processing", updated_at: nowIso() })
    .in("id", ids);

  const lines = data.map((a) => `- ${a.title} (${a.price}€)`).join("\n");
  return {
    result_message: `${data.length} article(s) passé(s) en processing (mode: ${publishMode}):\n${lines}`,
    articles: data,
    publish_mode: publishMode,
    count: data.length,
  };
}

// ── main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth: accept Bearer token (user JWT or service role key)
    const authHeader = req.headers.get("Authorization") ?? "";
    const agentApiKey = req.headers.get("X-Agent-Api-Key") ?? "";

    let userId: string | null = null;
    let supabase: ReturnType<typeof adminClient>;

    if (agentApiKey === (Deno.env.get("AGENT_API_KEY") ?? "")) {
      // Trusted agent key — get userId from body
      supabase = adminClient();
      const body = await req.json();
      userId = body.user_id ?? null;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id requis avec X-Agent-Api-Key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return await dispatchCommand(supabase, userId, body);
    }

    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: "Utilisateur non authentifié" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = user.id;
      supabase = adminClient();
      const body = await req.json();
      return await dispatchCommand(supabase, userId, body);
    }

    return new Response(
      JSON.stringify({ error: "Authorization requise (Bearer JWT ou X-Agent-Api-Key)" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function dispatchCommand(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  body: Record<string, unknown>
) {
  const { task_id, command_type, seller_name, article_title, params } = body as {
    task_id?: string;
    command_type: string;
    seller_name?: string | null;
    article_title?: string | null;
    params?: Record<string, unknown>;
  };

  if (!command_type) {
    return new Response(
      JSON.stringify({ error: "command_type requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mark task as running if task_id provided
  if (task_id) {
    await supabase
      .from("task_queue")
      .update({ status: "running", updated_at: nowIso() })
      .eq("id", task_id);
  }

  try {
    const sellerId = await resolveSellerIdByName(supabase, userId, seller_name ?? null);
    let result: Record<string, unknown>;

    switch (command_type) {
      case "list_articles":
        result = await handleListArticles(supabase, userId, sellerId);
        break;

      case "change_status": {
        const articleId = (body.article_id as string | null)
          ?? await resolveArticleId(supabase, userId, sellerId, article_title ?? null);
        const targetStatus = (params?.target_status as string) ?? "ready";
        result = await handleChangeStatus(supabase, userId, articleId, targetStatus);
        break;
      }

      case "finalise_only":
        result = await handleFinaliseOnly(supabase, userId, sellerId, article_title ?? null);
        break;

      case "finalise_and_draft":
      case "publish_next_draft":
        result = await handlePublishNextDraft(supabase, userId, sellerId);
        break;

      case "finalise_and_publish":
      case "publish_next_live":
        result = await handlePublishNextDraft(supabase, userId, sellerId);
        break;

      case "publish_all_ready_draft":
        result = await handlePublishAllReady(supabase, userId, sellerId, "draft");
        break;

      case "publish_all_ready_live":
        result = await handlePublishAllReady(supabase, userId, sellerId, "live");
        break;

      default:
        throw new Error(`Commande inconnue: ${command_type}`);
    }

    // Update task status to done
    if (task_id) {
      await supabase
        .from("task_queue")
        .update({
          status: "done",
          result_message: result.result_message as string,
          updated_at: nowIso(),
        })
        .eq("id", task_id);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (task_id) {
      await supabase
        .from("task_queue")
        .update({ status: "error", result_message: message, updated_at: nowIso() })
        .eq("id", task_id);
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
