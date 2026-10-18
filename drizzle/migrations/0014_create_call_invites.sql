CREATE TABLE public.call_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id text NOT NULL UNIQUE,
  call_type text NOT NULL CHECK (call_type IN ('audio','video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','rejected','ended','missed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.call_invites TO authenticated;
GRANT ALL ON public.call_invites TO service_role;
ALTER TABLE public.call_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_invites_select_own" ON public.call_invites FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "call_invites_insert_caller" ON public.call_invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY "call_invites_update_participants" ON public.call_invites FOR UPDATE TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_invites;