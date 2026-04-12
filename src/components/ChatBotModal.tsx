import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, X, Send, Copy, Check, Clock,
  Loader2, CheckCircle, AlertCircle, ListTodo, Package
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { parseUserInstruction, describeCommand, commandToClaudeCodeString, IMMEDIATE_COMMAND_TYPES } from '../lib/chatbotService';
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
    update_price: 'Modifier prix',
    update_condition: "Modifier l'état",
    update_season: 'Modifier saison',
    update_brand: 'Modifier marque',
    update_title: 'Modifier titre',
    update_description: 'Modifier description',
    mark_sold: 'Marquer vendu',
    mark_reserved: 'Marquer réservé',
    schedule_article: 'Programmer',
    count_articles: 'Compter articles',
    update_publish_mode: 'Mode publication',
    create_lot: 'Créer un lot',
    update_lot_price: 'Prix du lot',
    update_lot_status: 'Statut du lot',
    schedule_lot: 'Programmer lot',
    mark_lot_sold: 'Lot vendu',
  };
  const isImmediate = IMMEDIATE_COMMAND_TYPES.has(type);
  return (
    <span className={`text-xs font-medium ${isImmediate ? 'text-emerald-700' : 'text-slate-600'}`}>
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
        'Bonjour ! Dis-moi ce que tu veux que je fasse ?\n\nArticles :\n• "Passe le pull jacquard à 15€"\n• "Passe la robe bleue en Prêt"\n• "Change la marque du manteau en Zara"\n• "Marque la veste vendue à 25€ pour Marie"\n• "Réserve le pull gris pour Tom"\n• "Programme le jean pour le 15 janvier"\n\nLots :\n• "Crée un lot avec la robe florale et le pull rose"\n• "Passe le lot robes en Prêt"\n\nStats :\n• "Combien d\'articles ready pour Seb ?"',
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

  const executeImmediateCommand = useCallback(async (
    parsed: ParsedCommand,
    sellerId: string | null
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Utilisateur non authentifié.' };
    const uid = user.id;
    const titleFilter = parsed.article_title;

    const supaErrMsg = (e: unknown): string => {
      if (!e) return 'Erreur inconnue';
      if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
      if (typeof e === 'object' && 'details' in e) return String((e as { details: unknown }).details);
      return JSON.stringify(e);
    };

    switch (parsed.command_type) {
      case 'change_status': {
        if (!titleFilter || !parsed.params?.target_status) {
          return { success: false, message: 'Article ou statut manquant.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ status: parsed.params.target_status })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Statut mis à jour → ${parsed.params.target_status}` };
      }

      case 'update_price': {
        if (!titleFilter || parsed.params?.new_price == null) {
          return { success: false, message: 'Article ou prix manquant.' };
        }
        const updateData: Record<string, unknown> = { price: parsed.params.new_price };
        if (parsed.params?.target_status) {
          updateData.status = parsed.params.target_status;
        }
        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        const parts = [`Prix mis à jour → ${parsed.params.new_price}€`];
        if (parsed.params?.target_status) parts.push(`Statut → ${parsed.params.target_status}`);
        return { success: true, message: parts.join(' · ') };
      }

      case 'update_condition': {
        if (!titleFilter || !parsed.params?.new_condition) {
          return { success: false, message: 'Article ou état manquant.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ condition: parsed.params.new_condition })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `État mis à jour → ${parsed.params.new_condition}` };
      }

      case 'update_season': {
        if (!titleFilter || !parsed.params?.new_season) {
          return { success: false, message: 'Article ou saison manquante.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ season: parsed.params.new_season })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Saison mise à jour → ${parsed.params.new_season}` };
      }

      case 'mark_sold': {
        if (!titleFilter) return { success: false, message: 'Article manquant.' };
        const updateData: Record<string, unknown> = {
          status: 'sold',
          sold_at: new Date().toISOString(),
        };
        if (parsed.params?.sold_price != null) updateData.sold_price = parsed.params.sold_price;
        if (parsed.params?.buyer_name) updateData.buyer_name = parsed.params.buyer_name;
        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        const parts = ['Article marqué vendu'];
        if (parsed.params?.sold_price != null) parts.push(`à ${parsed.params.sold_price}€`);
        if (parsed.params?.buyer_name) parts.push(`pour ${parsed.params.buyer_name}`);
        return { success: true, message: parts.join(' ') };
      }

      case 'mark_reserved': {
        if (!titleFilter) return { success: false, message: 'Article manquant.' };
        const updateData: Record<string, unknown> = { status: 'reserved' };
        if (parsed.params?.buyer_name) updateData.buyer_name = parsed.params.buyer_name;
        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return {
          success: true,
          message: `Article réservé${parsed.params?.buyer_name ? ` pour ${parsed.params.buyer_name}` : ''}`,
        };
      }

      case 'schedule_article': {
        if (!titleFilter || !parsed.params?.scheduled_date) {
          return { success: false, message: 'Article ou date manquante.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ status: 'scheduled', scheduled_for: parsed.params.scheduled_date })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return {
          success: true,
          message: `Article programmé pour le ${new Date(parsed.params.scheduled_date).toLocaleDateString('fr-FR')}`,
        };
      }

      case 'count_articles': {
        let query = supabase
          .from('articles')
          .select('id, title, status', { count: 'exact', head: false })
          .eq('user_id', uid);
        if (sellerId) query = query.eq('seller_id', sellerId);
        if (parsed.params?.target_status_filter) {
          query = query.eq('status', parsed.params.target_status_filter);
        }
        const { data, count, error } = await query;
        if (error) return { success: false, message: supaErrMsg(error) };
        const statusLabel = parsed.params?.target_status_filter
          ? ` "${parsed.params.target_status_filter}"`
          : '';
        const sellerLabel = parsed.seller_name ? ` pour ${parsed.seller_name}` : '';
        const total = count ?? data?.length ?? 0;
        const preview = (data ?? []).slice(0, 5).map(a => `• ${a.title}`).join('\n');
        const suffix = total > 5 ? `\n…et ${total - 5} autre(s)` : '';
        return {
          success: true,
          message: `${total} article(s)${statusLabel}${sellerLabel}${preview ? '\n' + preview + suffix : ''}`,
        };
      }

      case 'update_publish_mode': {
        if (!titleFilter || !parsed.params?.publish_mode) {
          return { success: false, message: 'Article ou mode de publication manquant.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ publish_mode: parsed.params.publish_mode })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Mode de publication → ${parsed.params.publish_mode}` };
      }

      case 'update_brand': {
        if (!titleFilter || !parsed.params?.new_brand) {
          return { success: false, message: 'Article ou marque manquant.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ brand: parsed.params.new_brand })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Marque mise à jour → ${parsed.params.new_brand}` };
      }

      case 'update_title': {
        if (!titleFilter || !parsed.params?.new_title) {
          return { success: false, message: 'Article ou nouveau titre manquant.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ title: parsed.params.new_title })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Titre mis à jour → "${parsed.params.new_title}"` };
      }

      case 'update_description': {
        if (!titleFilter || !parsed.params?.new_description) {
          return { success: false, message: 'Article ou description manquante.' };
        }
        const { error } = await supabase
          .from('articles')
          .update({ description: parsed.params.new_description })
          .eq('user_id', uid)
          .ilike('title', `%${titleFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Description mise à jour` };
      }

      case 'create_lot': {
        const articleTitles = parsed.params?.lot_article_titles ?? [];
        if (articleTitles.length < 2) {
          return { success: false, message: 'Merci de mentionner au moins 2 articles pour créer un lot.' };
        }
        const lotName = parsed.params?.lot_name ?? `Lot du ${new Date().toLocaleDateString('fr-FR')}`;

        const articlePromises = articleTitles.map(title =>
          supabase
            .from('articles')
            .select('id, title, price, photos')
            .eq('user_id', uid)
            .ilike('title', `%${title}%`)
            .limit(1)
            .maybeSingle()
        );

        const articleResults = await Promise.all(articlePromises);
        const foundArticles = articleResults
          .filter(r => r.data != null)
          .map(r => r.data!);

        if (foundArticles.length < 2) {
          const notFound = articleTitles.filter((_, i) => articleResults[i].data == null);
          return {
            success: false,
            message: `Articles introuvables : ${notFound.join(', ')}. Vérifie les titres.`,
          };
        }

        const totalPrice = foundArticles.reduce((sum, a) => sum + (a.price ?? 0), 0);
        const discount = parsed.params?.lot_discount ?? 10;
        const lotPrice = parsed.params?.lot_price ?? Math.round(totalPrice * (1 - discount / 100));
        const coverPhoto = foundArticles[0].photos?.[0] ?? null;
        const allPhotos = foundArticles.flatMap(a => a.photos ?? []).slice(0, 10);

        const { data: newLot, error: lotError } = await supabase
          .from('lots')
          .insert({
            user_id: uid,
            seller_id: sellerId,
            name: lotName,
            price: lotPrice,
            original_total_price: totalPrice,
            discount_percentage: discount,
            status: 'draft',
            cover_photo: coverPhoto,
            photos: allPhotos,
          })
          .select('id')
          .single();

        if (lotError || !newLot) {
          return { success: false, message: supaErrMsg(lotError ?? 'Erreur lors de la création du lot') };
        }

        const lotItems = foundArticles.map(a => ({
          lot_id: newLot.id,
          article_id: a.id,
        }));

        const { error: itemsError } = await supabase.from('lot_items').insert(lotItems);
        if (itemsError) {
          return { success: false, message: `Lot créé mais erreur lors de l'ajout des articles : ${supaErrMsg(itemsError)}` };
        }

        const articleNames = foundArticles.map(a => `• ${a.title}`).join('\n');
        return {
          success: true,
          message: `Lot "${lotName}" créé avec succès !\n${articleNames}\nPrix : ${lotPrice}€ (remise ${discount}% sur ${totalPrice}€)`,
        };
      }

      case 'update_lot_price': {
        const lotNameFilter = parsed.params?.lot_name;
        const newLotPrice = parsed.params?.lot_price;
        if (!lotNameFilter || newLotPrice == null) {
          return { success: false, message: 'Nom du lot ou prix manquant.' };
        }
        const { error } = await supabase
          .from('lots')
          .update({ price: newLotPrice })
          .eq('user_id', uid)
          .ilike('name', `%${lotNameFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Prix du lot mis à jour → ${newLotPrice}€` };
      }

      case 'update_lot_status': {
        const lotNameFilter = parsed.params?.lot_name;
        if (!lotNameFilter || !parsed.params?.target_status) {
          return { success: false, message: 'Nom du lot ou statut manquant.' };
        }
        const { error } = await supabase
          .from('lots')
          .update({ status: parsed.params.target_status })
          .eq('user_id', uid)
          .ilike('name', `%${lotNameFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return { success: true, message: `Statut du lot mis à jour → ${parsed.params.target_status}` };
      }

      case 'schedule_lot': {
        const lotNameFilter = parsed.params?.lot_name;
        if (!lotNameFilter || !parsed.params?.scheduled_date) {
          return { success: false, message: 'Nom du lot ou date manquante.' };
        }
        const { error } = await supabase
          .from('lots')
          .update({ status: 'scheduled', scheduled_for: parsed.params.scheduled_date })
          .eq('user_id', uid)
          .ilike('name', `%${lotNameFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        return {
          success: true,
          message: `Lot programmé pour le ${new Date(parsed.params.scheduled_date).toLocaleDateString('fr-FR')}`,
        };
      }

      case 'mark_lot_sold': {
        const lotNameFilter = parsed.params?.lot_name;
        if (!lotNameFilter) {
          return { success: false, message: 'Nom du lot manquant.' };
        }
        const updateData: Record<string, unknown> = {
          status: 'sold',
          sold_at: new Date().toISOString(),
        };
        if (parsed.params?.sold_price != null) updateData.sold_price = parsed.params.sold_price;
        if (parsed.params?.buyer_name) updateData.buyer_name = parsed.params.buyer_name;
        const { error } = await supabase
          .from('lots')
          .update(updateData)
          .eq('user_id', uid)
          .ilike('name', `%${lotNameFilter}%`);
        if (error) return { success: false, message: supaErrMsg(error) };
        const parts = ['Lot marqué vendu'];
        if (parsed.params?.sold_price != null) parts.push(`à ${parsed.params.sold_price}€`);
        if (parsed.params?.buyer_name) parts.push(`pour ${parsed.params.buyer_name}`);
        return { success: true, message: parts.join(' ') };
      }

      default:
        return { success: false, message: 'Commande non reconnue.' };
    }
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

      if (IMMEDIATE_COMMAND_TYPES.has(parsed.command_type)) {
        taskRow = await enqueueTask(user.id, seller.id, seller.name, parsed, userText);
        try {
          const result = await executeImmediateCommand(parsed, seller.id);
          const newStatus = result.success ? 'done' : 'error';
          await updateTaskStatus(taskRow.id, newStatus, result.message);
          taskRow = { ...taskRow, status: newStatus, result_message: result.message };

          const SHOW_RESULT_COMMANDS = new Set(['count_articles', 'create_lot', 'update_title', 'update_description']);
          if (SHOW_RESULT_COMMANDS.has(parsed.command_type)) {
            setMessages(prev => [
              ...prev,
              {
                id: `ast-${Date.now()}`,
                role: result.success ? 'assistant' : 'error',
                content: result.message,
                timestamp: new Date().toISOString(),
                taskId: taskRow.id,
              },
            ]);
            setTasks(prev => [taskRow, ...prev.slice(0, 19)]);
            return;
          }
        } catch (execErr) {
          const errMsg =
            execErr instanceof Error
              ? execErr.message
              : typeof execErr === 'object' && execErr !== null && 'message' in execErr
              ? String((execErr as { message: unknown }).message)
              : JSON.stringify(execErr);
          await updateTaskStatus(taskRow.id, 'error', errMsg);
          taskRow = { ...taskRow, status: 'error', result_message: errMsg };
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
          parsed: IMMEDIATE_COMMAND_TYPES.has(parsed.command_type) ? undefined : parsed,
        },
      ]);

      setTasks(prev => [taskRow, ...prev.slice(0, 19)]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          content: `Erreur : ${msg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, user, familyMembers, executeImmediateCommand]);

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
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[61]"
        onClick={onClose}
      />

      <div className="fixed z-[62] bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[400px] h-[85vh] sm:h-[620px] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Assistant EasyVinted</h2>
              <p className="text-xs text-slate-300">Commandes en langage naturel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'chat'
                ? 'text-slate-700 border-b-2 border-slate-600 bg-white'
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
                ? 'text-slate-700 border-b-2 border-slate-600 bg-white'
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
                        ? 'bg-slate-700 text-white rounded-br-sm'
                        : msg.role === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {msg.role === 'assistant' && msg.parsed && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1.5">Commande Claude Code :</p>
                        <div className="bg-slate-50 rounded-lg p-2 flex items-start gap-2">
                          <code className="text-xs text-slate-700 flex-1 leading-relaxed">
                            {commandToClaudeCodeString(msg.parsed)}
                          </code>
                          <button
                            onClick={() => handleCopy(commandToClaudeCodeString(msg.parsed!), msg.id)}
                            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded transition-colors"
                            title="Copier la commande"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
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

                    {msg.role === 'assistant' && !msg.parsed && msg.taskId && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <StatusBadge
                          status={tasks.find(t => t.id === msg.taskId)?.status ?? 'done'}
                        />
                        <span className="text-xs text-gray-400">exécuté immédiatement</span>
                      </div>
                    )}

                    <p
                      className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-slate-300' : 'text-gray-400'
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
                    <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                    <span className="text-xs text-gray-500">Analyse en cours…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div
              className="flex-shrink-0 p-3 bg-white border-t border-gray-100 flex items-end gap-2"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Passe la robe bleue en Prêt à 15€…"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 disabled:opacity-50 overflow-y-auto"
                style={{ minHeight: '42px', maxHeight: '112px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex-shrink-0 p-2.5 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

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
