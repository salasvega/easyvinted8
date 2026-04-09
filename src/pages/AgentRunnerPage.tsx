import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type PollResult = {
  pending_count: number;
  next_ready_article: Record<string, unknown> | null;
  agent_instructions: string;
  runner_endpoint: string;
  polled_at: string;
};

export default function AgentRunnerPage() {
  const { session } = useAuth();
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
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

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
  }

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
            Instructions pour l'agent Claude
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
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Taches en attente</p>
          <p className="text-3xl font-bold text-slate-800">{pollResult?.pending_count ?? '—'}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Article ready suivant</p>
          <p className="text-sm font-medium text-slate-700 truncate">
            {pollResult?.next_ready_article
              ? `${pollResult.next_ready_article.title} (${pollResult.next_ready_article.price}€)`
              : 'Aucun'}
          </p>
        </div>
      </div>

      {/* Agent instructions (collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowInstructions(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Instructions pour l'agent Claude
          </h2>
          {showInstructions ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showInstructions && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-sm text-slate-500">
              Copiez ces instructions et collez-les dans Claude pour que l'agent execute les taches automatiquement.
            </p>
            <div className="relative">
              <pre className="bg-slate-900 text-emerald-300 text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono">
                {pollResult?.agent_instructions ?? 'Chargement...'}
              </pre>
              <button
                onClick={() => copyText(pollResult?.agent_instructions ?? '')}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
