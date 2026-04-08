import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, X, Send, Copy, Check, Clock,
  Loader2, CheckCircle, AlertCircle, ListTodo
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { parseUserInstruction, describeCommand, commandToClaudeCodeString } from '../lib/chatbotService';
import { enqueueTask, loadRecentTasks, updateTaskStatus } from '../lib/taskQueueService';
import type { ChatMessage, TaskQueueRow, ParsedCommand, TaskStatus } from '../types/taskQueue';

interface FamilyMember {
  id: string;
  name: string;
  user_id: string;
}

function resolveSellerByName(
  name: string | null,
  members: FamilyMember[]
): { id: string | null; name: string } {
  if (!name) return { id: null, name: '' };
  const lower = name.toLowerCase();
  const match = members.find(m => m.name.toLowerCase().includes(lower));
  return match ? { id: match.id, name: match.name } : { id: null, name };
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { icon: React.ReactNode; label: string; className: string }> = {
    pending: {
      icon: <Clock className="w-3 h-3" />,
      label: 'En attente',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    running: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'En cours',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    done: {
      icon: <CheckCircle className="w-3 h-3" />,
      label: 'Terminé',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Erreur',
      className: 'bg-red-100 text-red-700 border-red-200',
    },
  };
  const { icon, label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function CommandTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    finalise_and_draft: 'Finaliser → Brouillon',
    finalise_and_publish: 'Finaliser → En ligne',
    finalise_only: 'Finaliser fiche',
    publish_next_draft: 'Publier prochain',
    publish_next_live: 'Mettre en ligne',
    list_articles: 'Lister articles',
    publish_all_ready_draft: 'Tout publier (brouillon)',
    publish_all_ready_live: 'Tout mettre en ligne',
    change_status: 'Changer statut',
  };
  return (
    <span className="text-xs font-medium text-indigo-700">
      {labels[type] ?? type}
    </span>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatBotModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'queue'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour ! Dis-moi ce que tu veux faire en langage naturel.\n\nExemple : "Publie le prochain article pour Seb" ou "Finalise et mets en ligne la robe bleue pour Seb"',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [tasks, setTasks] = useState<TaskQueueRow[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('family_members')
      .select('id, name, user_id')
      .then(({ data }) => setFamilyMembers((data ?? []) as FamilyMember[]));
  }, [user]);

  useEffect(() => {
    if (activeTab === 'queue' && user) {
      loadRecentTasks(user.id).then(setTasks).catch(console.error);
    }
  }, [activeTab, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const refreshTasks = useCallback(() => {
    if (user) loadRecentTasks(user.id).then(setTasks).catch(console.error);
  }, [user]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !user) return;
    const userText = input.trim();
    setInput('');
    setSending(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const parsed: ParsedCommand = await parseUserInstruction(userText);

      if (parsed.error || parsed.confidence < 0.5) {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'error',
            content:
              parsed.error ??
              "Je n'ai pas compris cette instruction. Peux-tu reformuler ?",
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const seller = resolveSellerByName(parsed.seller_name, familyMembers);
      let taskRow: TaskQueueRow;

      if (
        parsed.command_type === 'change_status' &&
        parsed.article_title &&
        parsed.params?.target_status
      ) {
        taskRow = await enqueueTask(user.id, seller.id, seller.name, parsed, userText);
        try {
          await supabase
            .from('articles')
            .update({ status: parsed.params.target_status })
            .ilike('title', `%${parsed.article_title}%`);
          await updateTaskStatus(
            taskRow.id,
            'done',
            `Statut mis à jour → ${parsed.params.target_status}`
          );
          taskRow = { ...taskRow, status: 'done' };
        } catch {
          await updateTaskStatus(taskRow.id, 'error', 'Erreur lors de la mise à jour du statut');
          taskRow = { ...taskRow, status: 'error' };
        }
      } else {
        taskRow = await enqueueTask(user.id, seller.id, seller.name, parsed, userText);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: describeCommand(parsed),
          timestamp: new Date().toISOString(),
          taskId: taskRow.id,
          parsed,
        },
      ]);

      setTasks(prev => [taskRow, ...prev.slice(0, 19)]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          content: `Erreur : ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, user, familyMembers]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[61]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed z-[62] bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[400px] h-[85vh] sm:h-[620px] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Assistant EasyVinted</h2>
              <p className="text-xs text-indigo-200">Commandes en langage naturel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'chat'
                ? 'text-indigo-600 border-b-2 border-indigo-500 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => { setActiveTab('queue'); refreshTasks(); }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'queue'
                ? 'text-indigo-600 border-b-2 border-indigo-500 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            File d'attente
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : msg.role === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {msg.role === 'assistant' && msg.parsed && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1.5">Commande Claude Code :</p>
                        <div className="bg-indigo-50 rounded-lg p-2 flex items-start gap-2">
                          <code className="text-xs text-indigo-800 flex-1 leading-relaxed">
                            {commandToClaudeCodeString(msg.parsed)}
                          </code>
                          <button
                            onClick={() => handleCopy(commandToClaudeCodeString(msg.parsed!), msg.id)}
                            className="flex-shrink-0 p-1 hover:bg-indigo-100 rounded transition-colors"
                            title="Copier la commande"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                            )}
                          </button>
                        </div>
                        {msg.taskId && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <StatusBadge
                              status={
                                tasks.find(t => t.id === msg.taskId)?.status ?? 'pending'
                              }
                            />
                            <span className="text-xs text-gray-400">ajouté à la file</span>
                          </div>
                        )}
                      </div>
                    )}

                    <p
                      className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    <span className="text-xs text-gray-500">Analyse en cours…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div
              className="flex-shrink-0 p-3 bg-white border-t border-gray-100 flex items-end gap-2"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Publie le prochain article pour Seb…"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-50 overflow-y-auto"
                style={{ minHeight: '42px', maxHeight: '112px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex-shrink-0 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
                <ListTodo className="w-10 h-10 text-gray-300" />
                <p className="text-sm">Aucune tâche dans la file</p>
                <p className="text-xs">Envoie une commande dans le chat pour commencer</p>
              </div>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <CommandTypeLabel type={task.command_type} />
                    <StatusBadge status={task.status} />
                  </div>
                  {task.seller_name && (
                    <p className="text-xs text-gray-600 mb-0.5">
                      Vendeur :{' '}
                      <span className="font-medium">{task.seller_name}</span>
                    </p>
                  )}
                  {task.article_title && (
                    <p className="text-xs text-gray-600 mb-0.5">
                      Article :{' '}
                      <span className="font-medium">"{task.article_title}"</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 italic mt-1 truncate">
                    "{task.natural_input}"
                  </p>
                  {task.result_message && (
                    <p
                      className={`text-xs mt-1.5 ${
                        task.status === 'error'
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {task.result_message}
                    </p>
                  )}
                  <p className="text-xs text-gray-300 mt-1.5">
                    {new Date(task.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
