import { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw, Play, CheckCircle2, AlertCircle, Clock, Zap, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TaskQueueRow } from '../types/taskQueue';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type PollResult = {
  pending_count: number;
  tasks: TaskQueueRow[];
  next_ready_article: Record<string, unknown> | null;
  agent_instructions: string;
  runner_endpoint: string;
  polled_at: string;
};

type ExecLog = {
  id: string;
  task_id: string;
  command: string;
  status: 'running' | 'done' | 'error';
  message: string;
  timestamp: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
};

const COMMAND_LABELS: Record<string, string> = {
  finalise_and_draft: 'Finaliser + brouillon',
  finalise_and_publish: 'Finaliser + publier',
  finalise_only: 'Finaliser uniquement',
  publish_next_draft: 'Publier prochain (brouillon)',
  publish_next_live: 'Publier prochain (live)',
  list_articles: 'Lister articles',
  publish_all_ready_draft: 'Tout publier (brouillon)',
  publish_all_ready_live: 'Tout publier (live)',
  change_status: 'Changer statut',
};

export default function AgentRunnerPage() {
  const { session } = useAuth();
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [logs, setLogs] = useState<ExecLog[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const autoRunRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  autoRunRef.current = autoRun;

  function addLog(entry: Omit<ExecLog, 'id' | 'timestamp'>) {
    setLogs(prev => [{
      ...entry,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    }, ...prev].slice(0, 50));
  }

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

      if (autoRunRef.current && data.tasks?.length > 0) {
        await executeAllPendingTasks(data.tasks);
      }
    } finally {
      setPolling(false);
    }
  }

  async function executeTask(task: TaskQueueRow): Promise<void> {
    if (!session?.access_token) return;

    addLog({ task_id: task.id, command: COMMAND_LABELS[task.command_type] ?? task.command_type, status: 'running', message: 'Execution en cours...' });

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-task-runner`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: task.id,
          command_type: task.command_type,
          seller_name: task.seller_name,
          article_title: task.article_title,
          article_id: task.article_id,
          params: task.params,
        }),
      });

      const data = await res.json();

      if (data.success) {
        addLog({ task_id: task.id, command: COMMAND_LABELS[task.command_type] ?? task.command_type, status: 'done', message: data.result_message ?? 'Termine.' });
      } else {
        addLog({ task_id: task.id, command: COMMAND_LABELS[task.command_type] ?? task.command_type, status: 'error', message: data.error ?? 'Erreur inconnue' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog({ task_id: task.id, command: COMMAND_LABELS[task.command_type] ?? task.command_type, status: 'error', message: msg });
    }
  }

  async function executeAllPendingTasks(tasks: TaskQueueRow[]) {
    for (const task of tasks) {
      await executeTask(task);
    }
    await pollTasks();
  }

  async function handleRunAll() {
    if (!pollResult?.tasks?.length) return;
    await executeAllPendingTasks(pollResult.tasks);
  }

  async function handleRunOne(task: TaskQueueRow) {
    await executeTask(task);
    await pollTasks();
  }

  useEffect(() => {
    pollTasks();
  }, [session?.access_token]);

  useEffect(() => {
    if (autoRun) {
      intervalRef.current = window.setInterval(() => {
        pollTasks();
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRun, session?.access_token]);

  async function reloadTasks() {
    const { data } = await supabase
      .from('task_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    return data;
  }

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
            Interface de pilotage pour l'agent Claude — poll et execution des taches en attente
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-slate-600">Auto-run</span>
            <button
              onClick={() => setAutoRun(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${autoRun ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoRun ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
          <button
            onClick={pollTasks}
            disabled={polling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
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
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Mode</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${autoRun ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-sm font-medium text-slate-700">{autoRun ? 'Automatique (5s)' : 'Manuel'}</span>
          </div>
        </div>
      </div>

      {/* Tasks list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Taches en attente</h2>
          {pollResult?.tasks && pollResult.tasks.length > 0 && (
            <button
              onClick={handleRunAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Tout executer ({pollResult.tasks.length})
            </button>
          )}
        </div>

        {!pollResult?.tasks?.length ? (
          <div className="px-5 py-8 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Aucune tache en attente</p>
            <p className="text-xs mt-1">Utilisez le chatbot Kelly pour creer des commandes</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pollResult.tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {task.status}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {COMMAND_LABELS[task.command_type] ?? task.command_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">"{task.natural_input}"</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{task.id.slice(0, 12)}…</p>
                </div>
                <button
                  onClick={() => handleRunOne(task)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex-shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Executer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Journal d'execution
            </h2>
            <button onClick={() => setLogs([])} className="text-xs text-slate-400 hover:text-slate-600">
              Vider
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5">
                  {log.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {log.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {log.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{log.command}</span>
                    <span className="text-xs text-slate-400">{log.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{log.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
