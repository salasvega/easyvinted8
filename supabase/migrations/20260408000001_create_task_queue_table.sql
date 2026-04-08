/*
  # Create task_queue table for ChatBot feature
*/

CREATE TABLE IF NOT EXISTS task_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  seller_name text DEFAULT '',
  command_type text NOT NULL CHECK (command_type IN (
    'finalise_and_draft',
    'finalise_and_publish',
    'finalise_only',
    'publish_next_draft',
    'publish_next_live',
    'list_articles',
    'publish_all_ready_draft',
    'publish_all_ready_live',
    'change_status'
  )),
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  article_title text DEFAULT '',
  params jsonb DEFAULT '{}',
  natural_input text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  result_message text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_queue_user_id ON task_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_created_at ON task_queue(created_at DESC);

ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON task_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON task_queue FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON task_queue FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON task_queue FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_task_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_queue_updated_at
  BEFORE UPDATE ON task_queue
  FOR EACH ROW EXECUTE FUNCTION update_task_queue_updated_at();
