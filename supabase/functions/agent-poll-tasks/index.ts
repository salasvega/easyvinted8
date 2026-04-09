import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Agent-Api-Key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const agentApiKey = req.headers.get("X-Agent-Api-Key") ?? "";

    let userId: string | null = null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (agentApiKey && agentApiKey === (Deno.env.get("AGENT_API_KEY") ?? "")) {
      const url = new URL(req.url);
      userId = url.searchParams.get("user_id");
      if (!userId && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        userId = body.user_id ?? null;
      }
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (authHeader.startsWith("Bearer ")) {
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
    } else {
      return new Response(
        JSON.stringify({ error: "Authorization requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pending tasks for this user
    const { data: tasks, error: tasksError } = await supabase
      .from("task_queue")
      .select("id, command_type, seller_name, seller_id, article_id, article_title, params, natural_input, status, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (tasksError) throw tasksError;

    // Also fetch the next ready article (for context)
    const { data: nextArticle } = await supabase
      .from("articles")
      .select("id, title, price, status, description, brand, size, condition, color, material, photos")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Fetch scheduled articles whose scheduled_for date has passed
    const now = new Date().toISOString();
    const { data: overdueArticles } = await supabase
      .from("articles")
      .select("id, title, price, status, scheduled_for, description, brand, size, condition, color, material, photos")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    const pendingCount = tasks?.length ?? 0;

    const agentInstructions = pendingCount === 0
      ? "Aucune tâche en attente. Tu peux interroger à nouveau dans quelques secondes."
      : buildAgentInstructions(tasks ?? [], nextArticle, overdueArticles ?? []);

    return new Response(
      JSON.stringify({
        pending_count: pendingCount,
        tasks: tasks ?? [],
        next_ready_article: nextArticle ?? null,
        overdue_scheduled_articles: overdueArticles ?? [],
        agent_instructions: agentInstructions,
        runner_endpoint: `${SUPABASE_URL}/functions/v1/agent-task-runner`,
        polled_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAgentInstructions(
  tasks: Record<string, unknown>[],
  nextArticle: Record<string, unknown> | null,
  overdueArticles: Record<string, unknown>[]
): string {
  const lines: string[] = [
    `Tu as ${tasks.length} tâche(s) en attente à exécuter.`,
    "",
    "TÂCHES À EXÉCUTER (dans l'ordre) :",
  ];

  tasks.forEach((task, i) => {
    lines.push(`\n[${i + 1}] task_id: ${task.id}`);
    lines.push(`    command_type: ${task.command_type}`);
    if (task.seller_name) lines.push(`    seller_name: ${task.seller_name}`);
    if (task.article_title) lines.push(`    article_title: ${task.article_title}`);
    if (task.params && Object.keys(task.params as object).length > 0) {
      lines.push(`    params: ${JSON.stringify(task.params)}`);
    }
    lines.push(`    instruction originale: "${task.natural_input}"`);
  });

  lines.push("");
  lines.push("POUR EXÉCUTER CHAQUE TÂCHE, envoie un POST à runner_endpoint avec :");
  lines.push('  { "task_id": "<id>", "command_type": "<type>", "seller_name": "...", "article_title": "...", "params": {...} }');
  lines.push("  Header: Authorization: Bearer <user_jwt>");

  if (overdueArticles.length > 0) {
    lines.push("");
    lines.push(`ARTICLES PLANIFIÉS À PUBLIER MAINTENANT (${overdueArticles.length}) :`);
    lines.push("⚠️ Ces articles ont une date de publication dépassée — ils doivent être publiés en priorité.");
    overdueArticles.forEach((article, i) => {
      lines.push(`\n[${i + 1}] id: ${article.id}`);
      lines.push(`    titre: ${article.title}`);
      lines.push(`    prix: ${article.price}€`);
      lines.push(`    statut: ${article.status}`);
      lines.push(`    planifié pour: ${article.scheduled_for}`);
    });
  }

  if (nextArticle) {
    lines.push("");
    lines.push("PROCHAIN ARTICLE READY :");
    lines.push(`  id: ${nextArticle.id}`);
    lines.push(`  titre: ${nextArticle.title}`);
    lines.push(`  prix: ${nextArticle.price}€`);
    lines.push(`  statut: ${nextArticle.status}`);
  }

  return lines.join("\n");
}
