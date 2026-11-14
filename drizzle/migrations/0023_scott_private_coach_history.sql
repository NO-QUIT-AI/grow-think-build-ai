CREATE TABLE public.scott_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role text NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.scott_messages TO authenticated;
GRANT ALL ON public.scott_messages TO service_role;
ALTER TABLE public.scott_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own Scott chat" ON public.scott_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Save own Scott chat" ON public.scott_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own Scott chat" ON public.scott_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX scott_messages_user_created_idx ON public.scott_messages(user_id,created_at);