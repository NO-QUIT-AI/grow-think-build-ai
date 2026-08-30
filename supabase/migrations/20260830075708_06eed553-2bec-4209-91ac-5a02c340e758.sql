CREATE TABLE public.mind_thoughts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  thought TEXT NOT NULL,
  source_chat TEXT,
  is_auto BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mind_thoughts TO authenticated;
GRANT ALL ON public.mind_thoughts TO service_role;

ALTER TABLE public.mind_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own mind thoughts"
ON public.mind_thoughts FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX mind_thoughts_user_created_idx ON public.mind_thoughts (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mind_thoughts;