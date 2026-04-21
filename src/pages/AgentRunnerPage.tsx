import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Copy, RefreshCw, Zap, ChevronDown, ChevronUp,
  Calendar, CheckCircle2,
  ToggleLeft, ToggleRight, AlertCircle,
  Sparkles, Clock, GripVertical
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSeller } from '../contexts/SellerContext';

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
  pendingCount: number,
  vintedEmail: string | null,
  sellerName: string | null
): string {
  const lines: string[] = [];

  const getItemMode = (id: string): PublishMode => itemModes[id] ?? 'draft';

  if (vintedEmail || sellerName) {
    const parts: string[] = [];
    if (vintedEmail) parts.push(`Compte Vinted à utiliser : ${vintedEmail}`);
    if (sellerName) parts.push(`Vendeur: ${sellerName}`);
    lines.push(parts.join(', '));
    lines.push('');
  }

  if (pendingCount > 0) {
    lines.push(`Il y a ${pendingCount} tâche(s) en file d'attente — traite-les en priorité avant de commencer.`);
    lines.push('');
  }

  if (items.length === 0) {
    lines.push('Aucun item à traiter.');
    return lines.join('\n');
  }

  lines.push(`Traite les ${items.length} item(s) suivants dans l'ordre indiqué :`);
  lines.push('');

  items.forEach((item, idx) => {
    const mode = getItemMode(item.id);
    const action = mode === 'live' ? 'Mettre en vente (live)' : 'Sauvegarder en brouillon Vinted';
    let label = item.title;
    if (item.reference_number) label += ` (#${item.reference_number})`;
    if (item.isOverdue) label += ' [EN RETARD]';
    const typeLabel = item.type === 'lot' ? 'Lot' : 'Article';
    lines.push(`${idx + 1}. [${typeLabel}] ${label} — ${item.price}€ → ${action}`);
  });

  return lines.join('\n');
}

export default function AgentRunnerPage() {
  const { session } = useAuth();
  const { activeSeller } = useSeller();
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [itemModes, setItemModes] = useState<ItemModeMap>({});
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [vintedEmail, setVintedEmail] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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

  useEffect(() => {
    if (!session?.access_token || !session?.user?.id) return;
    fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${session.user.id}&select=vinted_email`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    })
      .then(r => r.json())
      .then(rows => {
        if (Array.isArray(rows) && rows.length > 0) {
          setVintedEmail(rows[0].vinted_email ?? null);
        }
      })
      .catch(() => {});
  }, [session?.access_token, session?.user?.id]);

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

  const toggleSelected = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (allItems.length === 0) return;
    setOrderedIds(prev => {
      const existingIds = new Set(prev);
      const newIds = allItems.map(i => i.id).filter(id => !existingIds.has(id));
      const pruned = prev.filter(id => allItems.some(i => i.id === id));
      return [...pruned, ...newIds];
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      allItems.forEach(i => next.add(i.id));
      return next;
    });
  }, [allItems]);

  const visibleItems = useMemo(() => {
    if (orderedIds.length === 0) return allItems;
    const idToItem = new Map(allItems.map(i => [i.id, i]));
    const ordered = orderedIds.filter(id => idToItem.has(id)).map(id => idToItem.get(id)!);
    const rest = allItems.filter(i => !orderedIds.includes(i.id));
    return [...ordered, ...rest];
  }, [allItems, orderedIds]);

  const selectedItems = useMemo(() =>
    visibleItems.filter(i => selectedIds.has(i.id)),
  [visibleItems, selectedIds]);

  const { draftCount, liveCount } = useMemo(() => ({
    draftCount: selectedItems.filter(i => (itemModes[i.id] ?? 'draft') === 'draft').length,
    liveCount: selectedItems.filter(i => (itemModes[i.id] ?? 'draft') === 'live').length,
  }), [selectedItems, itemModes]);

  const generateInstructions = useCallback(() => {
    if (!pollResult) return;
    const instructions = buildCustomInstructions(
      selectedItems,
      itemModes,
      pollResult.runner_endpoint,
      pollResult.pending_count,
      vintedEmail,
      activeSeller?.name ?? null
    );
    setCustomInstructions(instructions);
    setShowInstructions(true);
  }, [pollResult, selectedItems, itemModes, vintedEmail, activeSeller]);

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
              Items prêts à publier
              <span className="text-sm font-normal text-slate-400">
                {selectedItems.length}/{visibleItems.length} sélectionnés
              </span>
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
            <div className="col-span-1 flex items-center justify-center">
              <input
                type="checkbox"
                checked={visibleItems.length > 0 && visibleItems.every(i => selectedIds.has(i.id))}
                onChange={() => {
                  const allSelected = visibleItems.every(i => selectedIds.has(i.id));
                  if (allSelected) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(visibleItems.map(i => i.id)));
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 cursor-pointer"
              />
            </div>
            <div className="col-span-5">Item</div>
            <div className="col-span-2">Prix</div>
            <div className="col-span-1">Planif.</div>
            <div className="col-span-2 text-center">Mode</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleItems.map((item, index) => {
              const mode = getMode(item.id);
              const isLive = mode === 'live';
              const isSelected = selectedIds.has(item.id);

              const handleDragStart = (e: React.DragEvent) => {
                dragItem.current = index;
                e.dataTransfer.effectAllowed = 'move';
              };

              const handleDragEnter = (e: React.DragEvent) => {
                e.preventDefault();
                dragOverItem.current = index;
              };

              const handleDragOver = (e: React.DragEvent) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              };

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault();
                if (dragItem.current === null || dragOverItem.current === null) return;
                if (dragItem.current === dragOverItem.current) return;
                const ids = visibleItems.map(i => i.id);
                const reordered = [...ids];
                const [moved] = reordered.splice(dragItem.current, 1);
                reordered.splice(dragOverItem.current, 0, moved);
                setOrderedIds(reordered);
                dragItem.current = null;
                dragOverItem.current = null;
              };

              const handleDragEnd = () => {
                dragItem.current = null;
                dragOverItem.current = null;
              };

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  className={`grid grid-cols-12 gap-3 px-5 py-4 items-center transition-all cursor-grab active:cursor-grabbing select-none ${
                    !isSelected
                      ? 'opacity-40 hover:opacity-60'
                      : isLive ? 'hover:bg-emerald-50/40' : 'hover:bg-blue-50/40'
                  }`}
                >
                  {/* Checkbox + order number */}
                  <div className="col-span-1 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 cursor-pointer flex-shrink-0"
                    />
                    <span className={`text-xs font-bold tabular-nums ${isSelected ? 'text-slate-400' : 'text-slate-200'}`}>{index + 1}</span>
                  </div>

                  {/* Item info */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 truncate max-w-[220px]">
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
                  <div className="col-span-1">
                    {item.scheduled_for ? (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="font-medium">
                          {new Date(item.scheduled_for).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Mode toggle */}
                  <div className="col-span-2 flex items-center justify-center">
                    <button
                      onClick={() => toggleMode(item.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 font-semibold text-xs transition-all w-full justify-center ${
                        isLive
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {isLive ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>En vente</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Brouillon</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Drag handle */}
                  <div className="col-span-1 flex items-center justify-center">
                    <GripVertical className="w-4 h-4 text-slate-300" />
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
                disabled={selectedItems.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Zap className="w-4 h-4" />
                Générer les instructions ({selectedItems.length})
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
