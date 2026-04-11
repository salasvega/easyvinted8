import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Copy, RefreshCw, Zap, ChevronDown, ChevronUp,
  Package, ShoppingBag, Calendar, CheckCircle2,
  FileText, Send, ToggleLeft, ToggleRight, AlertCircle,
  Sparkles, Clock, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function savePublishMode(
  itemId: string,
  itemType: 'article' | 'lot',
  mode: PublishMode,
  token: string
): Promise<void> {
  const table = itemType === 'lot' ? 'lots' : 'articles';
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ publish_mode: mode }),
  });
}

async function revertItemToDraft(
  itemId: string,
  itemType: 'article' | 'lot',
  token: string
): Promise<void> {
  const table = itemType === 'lot' ? 'lots' : 'articles';
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'draft' }),
  });
}

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
  publish_mode?: 'live' | 'draft' | null;
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
  _runnerEndpoint: string,
  pendingCount: number
): string {
  const lines: string[] = [];

  const getItemMode = (id: string): PublishMode => itemModes[id] ?? 'draft';
  const draftItems = items.filter(i => getItemMode(i.id) === 'draft');
  const liveItems = items.filter(i => getItemMode(i.id) === 'live');

  if (pendingCount > 0) {
    lines.push(`Il y a ${pendingCount} tâche(s) en file d'attente — traite-les en priorité avant de commencer.`);
    lines.push('');
  }

  const parts: string[] = [];

  if (liveItems.length > 0) {
    const names = liveItems.map(i => {
      let label = i.title;
      if (i.reference_number) label += ` (#${i.reference_number})`;
      if (i.isOverdue) label += ' [EN RETARD]';
      return label;
    });
    if (liveItems.length === 1) {
      parts.push(`publie en live : ${names[0]}`);
    } else {
      parts.push(`publie en live : ${names.join(', ')}`);
    }
  }

  if (draftItems.length > 0) {
    const names = draftItems.map(i => {
      let label = i.title;
      if (i.reference_number) label += ` (#${i.reference_number})`;
      if (i.isOverdue) label += ' [EN RETARD]';
      return label;
    });
    if (draftItems.length === 1) {
      parts.push(`sauvegarde en brouillon Vinted : ${names[0]}`);
    } else {
      parts.push(`sauvegarde en brouillon Vinted : ${names.join(', ')}`);
    }
  }

  if (parts.length === 0) {
    lines.push('Aucun item à traiter.');
  } else {
    const sentence = parts.length === 1
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.'
      : parts.map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).join('. ') + '.';
    lines.push(sentence);
  }

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
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);

  const pollTasks = useCallback(async () => {
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
  }, [session?.access_token]);

  useEffect(() => {
    pollTasks();
  }, [pollTasks]);

  const allItems = useMemo<ReadyItem[]>(() => {
    if (!pollResult) return [];
    return [
      ...(pollResult.ready_articles ?? []).map((a) => ({
        id: a.id as string,
        type: 'article' as const,
        title: a.title as string,
        price: a.price as number,
        status: a.status as string,
        brand: a.brand as string | undefined,
        size: a.size as string | undefined,
        isOverdue: false,
        publish_mode: (a.publish_mode as 'live' | 'draft' | null) ?? null,
      })),
      ...(pollResult.ready_lots ?? []).map((l) => ({
        id: l.id as string,
        type: 'lot' as const,
        title: l.name as string,
        price: l.price as number,
        status: l.status as string,
        reference_number: l.reference_number as string | undefined,
        isOverdue: false,
        publish_mode: (l.publish_mode as 'live' | 'draft' | null) ?? null,
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
        publish_mode: (a.publish_mode as 'live' | 'draft' | null) ?? null,
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
        publish_mode: (l.publish_mode as 'live' | 'draft' | null) ?? null,
      })),
    ];
  }, [pollResult]);

  useEffect(() => {
    if (allItems.length === 0) return;
    setItemModes(prev => {
      const next = { ...prev };
      allItems.forEach(item => {
        if (!(item.id in next) && item.publish_mode != null) {
          next[item.id] = item.publish_mode;
        }
      });
      return next;
    });
  }, [allItems]);

  const toggleMode = useCallback((itemId: string) => {
    setItemModes(prev => {
      const next = { ...prev, [itemId]: prev[itemId] === 'draft' ? 'live' : 'draft' } as ItemModeMap;
      const newMode = next[itemId];
      const item = allItems.find(i => i.id === itemId);
      if (item && session?.access_token) {
        savePublishMode(itemId, item.type, newMode, session.access_token);
      }
      return next;
    });
  }, [allItems, session?.access_token]);

  const setAllModes = useCallback((mode: PublishMode) => {
    const newModes: ItemModeMap = {};
    allItems.forEach(item => { newModes[item.id] = mode; });
    setItemModes(newModes);
    if (session?.access_token) {
      allItems.forEach(item => {
        savePublishMode(item.id, item.type, mode, session.access_token!);
      });
    }
  }, [allItems, session?.access_token]);

  const getMode = useCallback((itemId: string): PublishMode => itemModes[itemId] ?? 'draft', [itemModes]);

  const removeItem = useCallback(async (item: ReadyItem) => {
    if (!session?.access_token) return;
    setRemovingId(item.id);
    try {
      await revertItemToDraft(item.id, item.type, session.access_token);
      setRemovedIds(prev => new Set([...prev, item.id]));
    } finally {
      setRemovingId(null);
    }
  }, [session?.access_token]);

  const visibleItems = useMemo(
    () => allItems.filter(i => !removedIds.has(i.id)),
    [allItems, removedIds]
  );

  const { draftCount, liveCount } = useMemo(() => ({
    draftCount: visibleItems.filter(i => (itemModes[i.id] ?? 'draft') === 'draft').length,
    liveCount: visibleItems.filter(i => (itemModes[i.id] ?? 'draft') === 'live').length,
  }), [visibleItems, itemModes]);

  const generateInstructions = useCallback(() => {
    if (!pollResult) return;
    const instructions = buildCustomInstructions(
      visibleItems,
      itemModes,
      pollResult.runner_endpoint,
      pollResult.pending_count
    );
    setCustomInstructions(instructions);
    setShowInstructions(true);
  }, [pollResult, visibleItems, itemModes]);

  const copyText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

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
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">À sauver en brouillon</p>
          <p className="text-3xl font-bold text-blue-600">{polling ? '—' : draftCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">À mettre en vente</p>
          <p className="text-3xl font-bold text-emerald-600">{polling ? '—' : liveCount}</p>
        </div>
      </div>

      {/* Items list */}
      {visibleItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Items prêts à publier ({visibleItems.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllModes('draft')}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition-colors"
              >
                Tout en brouillon
              </button>
              <button
                onClick={() => setAllModes('live')}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors"
              >
                Tout mettre en vente
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Prix</div>
            <div className="col-span-2">Planification</div>
            <div className="col-span-3 text-center">Mode de publication</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleItems.map((item) => {
              const mode = getMode(item.id);
              const isLive = mode === 'live';
              const isRemoving = removingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-3 px-5 py-4 items-center transition-colors ${
                    isLive ? 'hover:bg-emerald-50/40' : 'hover:bg-blue-50/40'
                  }`}
                >
                  {/* Item info */}
                  <div className="col-span-4 flex items-center gap-3">
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

                  {/* Remove button */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      onClick={() => removeItem(item)}
                      disabled={isRemoving}
                      title="Retirer de la liste (repasse en brouillon EasyVinted)"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRemoving
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />
                      }
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
                <span className="font-semibold text-blue-600">{draftCount}</span> en brouillon ·{' '}
                <span className="font-semibold text-emerald-600">{liveCount}</span> en vente
              </div>
              <button
                onClick={generateInstructions}
                disabled={visibleItems.length === 0}
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
      {!polling && pollResult && visibleItems.length === 0 && (
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
                {draftCount} en brouillon · {liveCount} en vente
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
