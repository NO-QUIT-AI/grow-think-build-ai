CREATE TABLE public.community_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_announcements TO authenticated;
GRANT ALL ON public.community_announcements TO service_role;
ALTER TABLE public.community_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read announcements" ON public.community_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner creates announcements" ON public.community_announcements FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Owner updates announcements" ON public.community_announcements FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner deletes announcements" ON public.community_announcements FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));