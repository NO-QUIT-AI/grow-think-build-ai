CREATE TABLE public.jalsa_messages (
 owner_id uuid NOT NULL,
 id uuid NOT NULL,
 peer_id uuid NOT NULL,
 sender_id uuid NOT NULL,
 text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
 delivery text NOT NULL CHECK (delivery IN ('queued','sent','received')),
 created_at timestamptz NOT NULL,
 PRIMARY KEY (owner_id,id)
);
GRANT SELECT,INSERT,UPDATE ON public.jalsa_messages TO authenticated;
GRANT ALL ON public.jalsa_messages TO service_role;
ALTER TABLE public.jalsa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY jalsa_select_own ON public.jalsa_messages FOR SELECT TO authenticated USING (owner_id=auth.uid());
CREATE POLICY jalsa_insert_own ON public.jalsa_messages FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid());
CREATE POLICY jalsa_update_own ON public.jalsa_messages FOR UPDATE TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE INDEX jalsa_owner_created ON public.jalsa_messages(owner_id,created_at);