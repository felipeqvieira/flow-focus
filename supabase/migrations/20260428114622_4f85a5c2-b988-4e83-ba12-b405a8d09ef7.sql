-- Extend chat_messages to support tool calls and confirmation flow

-- Allow tool role in messages
-- First, make role a proper enum-like check (keeping as text for flexibility)

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS tool_calls jsonb,
  ADD COLUMN IF NOT EXISTS tool_call_id text,
  ADD COLUMN IF NOT EXISTS tool_name text,
  ADD COLUMN IF NOT EXISTS tool_args jsonb,
  ADD COLUMN IF NOT EXISTS tool_result jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'complete';

-- status values: 'complete', 'pending_confirmation', 'confirmed', 'cancelled'

-- Allow content to be nullable (assistant tool-call turns may have no text)
ALTER TABLE public.chat_messages
  ALTER COLUMN content DROP NOT NULL;

-- Grant UPDATE so users can confirm/cancel proposed actions
CREATE POLICY "Users update own messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Helpful index for fetching user conversation in order
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON public.chat_messages (user_id, created_at);