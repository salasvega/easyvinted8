export type CommandType =
  | 'finalise_and_draft'
  | 'finalise_and_publish'
  | 'finalise_only'
  | 'publish_next_draft'
  | 'publish_next_live'
  | 'list_articles'
  | 'publish_all_ready_draft'
  | 'publish_all_ready_live'
  | 'change_status';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export interface TaskQueueRow {
  id: string;
  user_id: string;
  seller_id: string | null;
  seller_name: string;
  command_type: CommandType;
  article_id: string | null;
  article_title: string;
  params: Record<string, unknown>;
  natural_input: string;
  status: TaskStatus;
  result_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedCommand {
  command_type: CommandType;
  seller_name: string | null;
  article_title: string | null;
  params: {
    target_status?: string;
    publish_mode?: 'draft' | 'live';
  };
  confidence: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  taskId?: string;
  parsed?: ParsedCommand;
}
