import { supabase } from './supabase';
import { TaskQueueRow, ParsedCommand } from '../types/taskQueue';

export async function enqueueTask(
  userId: string,
  sellerId: string | null,
  sellerName: string,
  parsed: ParsedCommand,
  naturalInput: string
): Promise<TaskQueueRow> {
  const { data, error } = await supabase
    .from('task_queue')
    .insert({
      user_id: userId,
      seller_id: sellerId,
      seller_name: sellerName,
      command_type: parsed.command_type,
      article_title: parsed.article_title ?? '',
      params: parsed.params ?? {},
      natural_input: naturalInput,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as TaskQueueRow;
}

export async function loadRecentTasks(userId: string): Promise<TaskQueueRow[]> {
  const { data, error } = await supabase
    .from('task_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as TaskQueueRow[];
}

export async function updateTaskStatus(
  taskId: string,
  status: 'done' | 'error' | 'running',
  resultMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('task_queue')
    .update({ status, result_message: resultMessage ?? null })
    .eq('id', taskId);

  if (error) throw error;
}

export async function updatePendingTask(
  taskId: string,
  updates: {
    natural_input?: string;
    seller_name?: string;
    article_title?: string;
    command_type?: string;
  }
): Promise<TaskQueueRow> {
  const { data, error } = await supabase
    .from('task_queue')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;
  return data as TaskQueueRow;
}

export async function deletePendingTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('task_queue')
    .delete()
    .eq('id', taskId)
    .eq('status', 'pending');

  if (error) throw error;
}

export function subscribeToTask(
  taskId: string,
  onUpdate: (row: TaskQueueRow) => void
) {
  return supabase
    .channel(`task_queue:${taskId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'task_queue',
        filter: `id=eq.${taskId}`,
      },
      (payload) => onUpdate(payload.new as TaskQueueRow)
    )
    .subscribe();
}
