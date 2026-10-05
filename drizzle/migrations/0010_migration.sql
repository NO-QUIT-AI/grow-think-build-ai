CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
INSERT INTO public.owners (email) VALUES ('noquitai1@gmail.com');

CREATE OR REPLACE FUNCTION public.is_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u JOIN public.owners o ON lower(o.email) = lower(u.email) WHERE u.id = _uid)
$$;

CREATE POLICY "Only owner reads owners" ON public.owners FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));

CREATE TABLE public.user_plans (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own plan or owner" ON public.user_plans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "Owner manages plans" ON public.user_plans FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE TABLE public.viral_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id uuid,
  title text NOT NULL DEFAULT '',
  r2_key text NOT NULL,
  url text NOT NULL,
  watermarked boolean NOT NULL DEFAULT true,
  views integer NOT NULL DEFAULT 0,
  bonus_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_videos TO authenticated;
GRANT ALL ON public.viral_videos TO service_role;
ALTER TABLE public.viral_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own videos read" ON public.viral_videos FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "Own videos delete" ON public.viral_videos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner updates videos" ON public.viral_videos FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));