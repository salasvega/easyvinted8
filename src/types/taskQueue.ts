export type CommandType =
  | 'finalise_and_draft'
  | 'finalise_and_publish'
  | 'finalise_only'
  | 'publish_next_draft'
  | 'publish_next_live'
  | 'list_articles'
  | 'publish_all_ready_draft'
  | 'publish_all_ready_live'
  | 'change_status'
  | 'update_price'
  | 'update_condition'
  | 'update_season'
  | 'mark_sold'
  | 'mark_reserved'
  | 'schedule_article'
  | 'count_articles'
  | 'update_publish_mode'
  | 'update_brand'
  | 'update_title'
  | 'update_description'
  | 'create_lot'
  | 'update_lot_price'
  | 'update_lot_status'
  | 'schedule_lot'
  | 'mark_lot_sold';

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
    new_price?: number;
    new_condition?: string;
    new_season?: string;
    sold_price?: number;
    buyer_name?: string;
    scheduled_date?: string;
    target_status_filter?: string;
    new_brand?: string;
    new_title?: string;
    new_description?: string;
    lot_name?: string;
    lot_article_titles?: string[];
    lot_price?: number;
    lot_discount?: number;
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
