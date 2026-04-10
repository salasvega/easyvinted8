import { useEffect, useState, useCallback } from 'react';
import {
  Copy, RefreshCw, Zap, ChevronDown, ChevronUp,
  Package, ShoppingBag, Calendar, CheckCircle2,
  FileText, Send, ToggleLeft, ToggleRight, AlertCircle,
  Sparkles, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type PublishMode = 'draft' | 'live';

interface ReadyItem {
  id: string;
  type: 'article' | 'lot';
  title: string;
  price: number;
  status: string;
  scheduled_for?: string | null;
  brand?: string;
  size?: string;
  reference_number?: string;
  isOverdue?: boolean;
}

type ItemModeMap = Record<string, PublishMode>;

type PollResult = {
  pending_count: number;
  next_ready_article: Record<string, unknown> | null;
  ready_articles: Record<string, unknown>[];
  ready_lots: Record<string, unknown>[];
  overdue_scheduled_articles: Record<string, unknown>[];
  overdue_scheduled_lots: Record<string, unknown>[];
  agent_instructions: string;
  runner_endpoint: string;
  polled_at: string;
};

function buildCustomInstructions(
  items: ReadyItem[],
  itemModes: ItemModeMap,
  runnerEndpoint: string,
  pendingCount: number
): string {
  const lines: string[] = [];

  const draftItems = items.filter(i => itemModes[i.id] === 'draft');
  const liveItems = items.filter(i => itemModes[i.id] === 'live');

  lines.push('# INSTRUCTIONS POUR L\'AGENT EASYVINTED');
  lines.push('');
  lines.push(`Runner endpoint: ${runnerEndpoint}`);
  lines.push(`Header requis: Authorization: Bearer <user_jwt>`);
  lines.push('');

  if (pendingCount > 0) {
    lines.push(`⚠️  ${pendingCount} tâche(s) en file d'attente — à exécuter en priorité.`);
    lines.push('');
  }

  lines.push(`## RÉSUMÉ DE LA SESSION`);
  lines.push(`- Total items à traiter : ${items.length}`);
  lines.push(`- À sauvegarder en brouillon Vinted : ${draftItems.length}`);
  lines.push(`- À mettre en vente sur Vinted : ${liveItems.length}`);
  lines.push('');

  if (liveItems.length > 0) {
    lines.push('## ITEMS À METTRE EN VENTE (publish_mode: live)');
    lines.push('Pour chaque item ci-dessous, tu dois :');
    lines.push('1. Ouvrir Vinted et créer l\'annonce');
    lines.push('2. Remplir tous les champs (titre, description, prix, photos, taille, marque, état, catégorie)');
    lines.push('3. Cliquer sur "Mettre en vente" (PAS "Enregistrer en brouillon")');
    lines.push('4. Appeler le runner avec command_type: "change_status", target_status: "published"');
    lines.push('');

    liveItems.forEach((item, i) => {
      lines.push(`### [LIVE ${i + 1}] ${item.type === 'lot' ? 'LOT' : 'ARTICLE'}: ${item.title}`);
      lines.push(`- id: ${item.id}`);
      lines.push(`- prix: ${item.price}€`);
      if (item.brand) lines.push(`- marque: ${item.brand}`);
      if (item.size) lines.push(`- taille: ${item.size}`);
      if (item.reference_number) lines.push(`- référence: ${item.reference_number}`);
      if (item.isOverdue && item.scheduled_for) lines.push(`- ⚠️  planifié pour: ${item.scheduled_for} (dépassé)`);
      lines.push(`- Action après publication: POST ${runnerEndpoint}`);
      lines.push(`  Body: { "command_type": "change_status", "article_id": "${item.id}", "params": { "target_status": "published" } }`);
      lines.push('');
    });
  }

  if (draftItems.length > 0) {
    lines.push('## ITEMS À SAUVEGARDER EN BROUILLON (publish_mode: draft)');
    lines.push('Pour chaque item ci-dessous, tu dois :');
    lines.push('1. Ouvrir Vinted et créer l\'annonce');
    lines.push('2. Remplir tous les champs (titre, description, prix, photos, taille, marque, état, catégorie)');
    lines.push('3. Cliquer sur "Enregistrer en brouillon" (PAS "Mettre en vente")');
    lines.push('4. Appeler le runner avec command_type: "change_status", target_status: "vinted_draft"');
    lines.push('');

    draftItems.forEach((item, i) => {
      lines.push(`### [DRAFT ${i + 1}] ${item.type === 'lot' ? 'LOT' : 'ARTICLE'}: ${item.title}`);
      lines.push(`- id: ${item.id}`);
      lines.push(`- prix: ${item.price}€`);
      if (item.brand) lines.push(`- marque: ${item.brand}`);
      if (item.size) lines.push(`- taille: ${item.size}`);
      if (item.reference_number) lines.push(`- référence: ${item.reference_number}`);
      if (item.isOverdue && item.scheduled_for) lines.push(`- ⚠️  planifié pour: ${item.scheduled_for} (dépassé)`);
      lines.push(`- Action après sauvegarde: POST ${runnerEndpoint}`);
      lines.push(`  Body: { "command_type": "change_status", "article_id": "${item.id}", "params": { "target_status": "vinted_draft" } }`);
      lines.push('');
    });
  }

  lines.push('## FORMAT DES APPELS API');
  lines.push('```');
  lines.push(`POST ${runnerEndpoint}`);
  lines.push('Authorization: Bearer <user_jwt>');
  lines.push('Content-Type: application/json');
  lines.push('');
  lines.push('{');
  lines.push('  "command_type": "change_status",');
  lines.push('  "article_id": "<id de l\'item>",');
  lines.push('  "params": {');
  lines.push('    "target_status": "published"  // ou "vinted_draft"');
  lines.push('  }');
  lines.push('}');
  lines.push('```');

  return lines.join('\n');
}

export default function AgentRunnerPage() {
  const { session } = useAuth();
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [itemModes, setItemModes] = useState<ItemModeMap>({});
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [copied, setCopied] = useState(false);

  async function pollTasks() {
    if (!session?.access_token) return;
    setPolling(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-poll-tasks`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      setPollResult(data);
    } finally {
      setPolling(false);
    }
  }

  useEffect(() => {
    pollTasks();
  }, [session?.access_token]);

  const allItems: ReadyItem[] = pollResult ? [
    ...(pollResult.ready_articles ?? []).map((a) => ({
      id: a.id as string,
      type: 'article' as const,
      title: a.title as string,
      price: a.price as number,
      status: a.status as string,
      brand: a.brand as string | undefined,
      size: a.size as string | undefined,
      isOverdue: false,
    })),
    ...(pollResult.ready_lots ?? []).map((l) => ({
      id: l.id as string,
      type: 'lot' as const,
      title: l.name as string,
      price: l.price as number,
      status: l.status as string,
      reference_number: l.reference_number as string | undefined,
      isOverdue: false,
    })),
    ...(pollResult.overdue_scheduled_articles ?? []).map((a) => ({
      id: a.id as string,
      type: 'article' as const,
      title: a.title as string,
      price: a.price as number,
      status: a.status as string,
      scheduled_for: a.scheduled_for as string | null,
      brand: a.brand as string | undefined,
      size: a.size as string | undefined,
      isOverdue: true,
    })),
    ...(pollResult.overdue_scheduled_lots ?? []).map((l) => ({
      id: l.id as string,
      type: 'lot' as const,
      title: l.name as string,
      price: l.price as number,
      status: l.status as string,
      scheduled_for: l.scheduled_for as string | null,
      reference_number: l.reference_number as string | undefined,
      isOverdue: true,
    })),
  ] : [];

  const toggleMode = useCallback((itemId: string) => {
    setItemModes(prev => ({
      ...prev,
      [itemId]: prev[itemId] === 'draft' ? 'live' : 'draft',
    }));
  }, []);

  const setAllModes = (mode: PublishMode) => {
    const newModes: ItemModeMap = {};
    allItems.forEach(item => { newModes[item.id] = mode; });
    setItemModes(newModes);
  };

  const getMode = (itemId: string): PublishMode => itemModes[itemId] ?? 'live';

  const generateInstructions = () => {
    if (!pollResult) return;
    const instructions = buildCustomInstructions(
      allItems,
      itemModes,
      pollResult.runner_endpoint,
      pollResult.pending_count
    );
    setCustomInstructions(instructions);
    setShowInstructions(true);
  };

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const draftCount = allItems.filter(i => getMode(i.id) === 'draft').length;
  const liveCount = allItems.filter(i => getMode(i.id) === 'live').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Agent Runner
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Configurez et générez les instructions pour l'agent Claude
          </p>
        </div>
        <button
          onClick={pollTasks}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tâches en attente</p>
          <p className="text-3xl font-bold text-slate-800">{pollResult?.pending_count ?? '—'}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">À mettre en vente</p>
          <p className="text-3xl font-bold text-emerald-600">{polling ? '—' : liveCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">À sauver en brouillon</p>
          <p className="text-3xl font-bold text-blue-600">{polling ? '—' : draftCount}</p>
        </div>
      </div>

      {/* Items list */}
      {allItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Items prêts à publier ({allItems.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllModes('live')}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors"
              >
                Tout mettre en vente
              </button>
              <button
                onClick={() => setAllModes('draft')}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition-colors"
              >
                Tout en brouillon
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-5">Item</div>
            <div className="col-span-2">Prix</div>
            <div className="col-span-2">Planification</div>
            <div className="col-span-3 text-center">Mode de publication</div>
          </div>

          <div className="divide-y divide-slate-100">
            {allItems.map((item) => {
              const mode = getMode(item.id);
              const isLive = mode === 'live';

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-3 px-5 py-4 items-center transition-colors ${
                    isLive ? 'hover:bg-emerald-50/40' : 'hover:bg-blue-50/40'
                  }`}
                >
                  {/* Item info */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.type === 'lot'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-teal-50 text-teal-600'
                    }`}>
                      {item.type === 'lot'
                        ? <Package className="w-4 h-4" />
                        : <ShoppingBag className="w-4 h-4" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 truncate max-w-[180px]">
                          {item.title}
                        </span>
                        {item.isOverdue && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                            <AlertCircle className="w-3 h-3" />
                            En retard
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          item.type === 'lot' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-600'
                        }`}>
                          {item.type === 'lot' ? 'Lot' : 'Article'}
                        </span>
                        {item.brand && <span>{item.brand}</span>}
                        {item.brand && item.size && <span>·</span>}
                        {item.size && <span>{item.size}</span>}
                        {item.reference_number && <span className="text-slate-300">· #{item.reference_number}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2">
                    <span className="font-bold text-slate-800 text-sm">{item.price}€</span>
                  </div>

                  {/* Schedule */}
                  <div className="col-span-2">
                    {item.scheduled_for ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-medium">
                          {new Date(item.scheduled_for).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Non planifié</span>
                    )}
                  </div>

                  {/* Mode toggle */}
                  <div className="col-span-3 flex items-center justify-center">
                    <button
                      onClick={() => toggleMode(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-semibold text-xs transition-all w-full justify-center ${
                        isLive
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {isLive ? (
                        <>
                          <ToggleRight className="w-4 h-4 flex-shrink-0" />
                          <Send className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Mettre en vente</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 flex-shrink-0" />
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Brouillon Vinted</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate button */}
          <div className="px-5 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-500">
                <span className="font-semibold text-emerald-600">{liveCount}</span> en vente ·{' '}
                <span className="font-semibold text-blue-600">{draftCount}</span> en brouillon
              </div>
              <button
                onClick={generateInstructions}
                disabled={allItems.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Zap className="w-4 h-4" />
                Générer les instructions Claude
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!polling && pollResult && allItems.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Tout est à jour</h3>
          <p className="text-sm text-slate-400">Aucun item prêt à publier pour le moment.</p>
        </div>
      )}

      {/* Generated instructions */}
      {showInstructions && customInstructions && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <button
              onClick={() => setShowInstructions(v => !v)}
              className="flex items-center gap-2 font-semibold text-slate-800 hover:text-slate-600 transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Instructions générées pour l'agent Claude
              {showInstructions
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />
              }
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {liveCount} en vente · {draftCount} en brouillon
              </span>
              <button
                onClick={() => copyText(customInstructions)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          {showInstructions && (
            <div className="px-5 pb-5 pt-4">
              <p className="text-sm text-slate-500 mb-3">
                Copiez ces instructions et collez-les dans Claude pour que l'agent exécute les tâches automatiquement.
              </p>
              <div className="relative">
                <pre className="bg-slate-900 text-emerald-300 text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
                  {customInstructions}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Default agent instructions (collapsible) */}
      {pollResult && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowInstructions(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm text-slate-500 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              Instructions brutes du serveur (debug)
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

    </div>
  );
}
