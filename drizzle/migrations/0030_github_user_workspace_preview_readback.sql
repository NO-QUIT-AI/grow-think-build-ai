GRANT SELECT (user_id, repo, branch) ON public.github_workspaces TO authenticated;
CREATE POLICY user_reads_github_workspace ON public.github_workspaces FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS owner_reads_self_updates ON public.github_self_updates;
CREATE POLICY user_reads_self_updates ON public.github_self_updates FOR SELECT TO authenticated USING (user_id = auth.uid());