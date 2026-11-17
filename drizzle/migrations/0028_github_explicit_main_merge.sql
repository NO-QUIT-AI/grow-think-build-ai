CREATE TABLE public.github_main_merges (
 preview_id uuid PRIMARY KEY REFERENCES public.github_self_updates(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 repo text NOT NULL,
 branch text NOT NULL,
 source_sha text NOT NULL,
 main_before_sha text NOT NULL,
 status text NOT NULL DEFAULT 'merging' CHECK (status IN ('merging','merged','failed','unknown')),
 merged_sha text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.github_main_merges TO authenticated;
GRANT ALL ON public.github_main_merges TO service_role;
ALTER TABLE public.github_main_merges ENABLE ROW LEVEL SECURITY;
CREATE POLICY github_main_merge_read_own ON public.github_main_merges FOR SELECT TO authenticated USING (auth.uid() = user_id);