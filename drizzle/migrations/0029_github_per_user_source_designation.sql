DROP POLICY IF EXISTS owner_reads_self_repo ON public.github_self_repos;
CREATE POLICY user_reads_self_repo ON public.github_self_repos FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.github_self_repos IS 'Per-user explicitly designated source repository; not an app-owner role. Writes are server-validated against selected repository and GitHub push permission.';