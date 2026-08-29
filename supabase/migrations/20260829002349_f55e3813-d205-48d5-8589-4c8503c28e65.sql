CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'website',
  code TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  liked BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX memories_user_created_idx ON public.memories (user_id, created_at DESC);
CREATE INDEX memories_parent_idx ON public.memories (parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories" ON public.memories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);